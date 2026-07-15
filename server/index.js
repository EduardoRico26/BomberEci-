const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const logger     = require('./logger');
const LobbyManager = require('./lobby/LobbyManager');
const GameRoom     = require('./game/GameRoom');
const cookieParser = require('cookie-parser');
const authRoutes   = require('./auth/authRoutes');
require('dotenv').config();
const metrics = require('./metrics');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, '../client-react/dist')));
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);

const COLORES_VALIDOS = ['azul', 'verde', 'rosado', 'morado'];
const lobby = new LobbyManager();
const rooms = new Map();

// ── RUTA PRINCIPAL ──────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client-react/dist/index.html'));
});

// ── HEALTH CHECK (para Load Balancer AWS) ───────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    servicio: 'BomberEci Arena',
    timestamp: new Date().toISOString(),
    salasActivas: rooms.size,
    jugadoresConectados: io.engine.clientsCount
  });
});

// ── MÉTRICAS PROMETHEUS ─────────────────────────────────
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// ── WEBSOCKET ───────────────────────────────────────────
io.on('connection', (socket) => {
  metrics.jugadoresConectados.inc();
  logger.info({ event: 'player_connected', socketId: socket.id });
  socket.emit('lista_salas', lobby.getSalasDisponibles());

  socket.on('pedir_salas', () => {
    socket.emit('lista_salas', lobby.getSalasDisponibles());
  });

  // ── CREAR SALA ────────────────────────────────────────
  socket.on('crear_sala', ({ nombre, nombreSala, color }) => {
    if (!COLORES_VALIDOS.includes(color)) {
      socket.emit('error_sala', 'Elige un color válido.');
      return;
    }
    const resultado = lobby.crearSala(nombreSala);
    if (resultado.error) {
      socket.emit('error_sala', resultado.error);
      return;
    }
    const salaId = resultado.salaId;
    const room = new GameRoom(salaId, io, logger);
    rooms.set(salaId, room);
    metrics.salaCreada.inc();
    metrics.salasActivas.set(rooms.size);
    lobby.unirseASala(salaId, { id: socket.id, nombre, color });
    room.agregarJugador(socket.id, nombre, color);
    socket.join(salaId);
    socket.salaId = salaId;
    socket.nombre = nombre;
    socket.emit('sala_creada', { salaId });
    io.emit('lista_salas', lobby.getSalasDisponibles());
    logger.info({ event: 'sala_creada', salaId, creador: nombre });
  });

  // ── UNIRSE A SALA ─────────────────────────────────────
  socket.on('unirse_sala', ({ salaId, nombre, color }) => {
    if (!COLORES_VALIDOS.includes(color)) {
      socket.emit('error_sala', 'Elige un color válido.');
      return;
    }
    const sala = lobby.getSala(salaId);
    if (!sala) { socket.emit('error_sala', 'Sala no encontrada'); return; }
    if (sala.jugadores.length >= LobbyManager.MAX_JUGADORES) {
      socket.emit('error_sala', 'Sala llena'); return;
    }
    if (sala.jugadores.some(j => j.color === color)) {
      socket.emit('error_sala', 'Ese color ya está tomado en esta sala.');
      return;
    }
    lobby.unirseASala(salaId, { id: socket.id, nombre, color });
    const room = rooms.get(salaId);
    room.agregarJugador(socket.id, nombre, color);
    socket.join(salaId);
    socket.salaId = salaId;
    socket.nombre = nombre;
    io.emit('lista_salas', lobby.getSalasDisponibles());
  });

  // ── INICIAR PARTIDA MANUAL ────────────────────────────
  socket.on('iniciar_partida_manual', () => {
    const salaId = socket.salaId;
    if (!salaId) return;

    const sala = lobby.getSala(salaId);
    const room = rooms.get(salaId);
    if (!sala || !room) return;

    const dueñoId = sala.jugadores[0]?.id;
    if (socket.id !== dueñoId) {
      socket.emit('error_sala', 'Solo el creador de la sala puede iniciar la partida.');
      return;
    }
    if (sala.jugadores.length < 2) {
      socket.emit('error_sala', 'Necesitas al menos 2 jugadores para iniciar.');
      return;
    }

    room.reiniciar(sala.jugadores);
    metrics.partidasIniciadas.inc();
    logger.info({ event: 'partida_iniciada', salaId, jugadores: sala.jugadores.length });
    io.to(salaId).emit('iniciar_partida', room.getEstado());
  });

  // ── EVENTOS DE JUEGO ──────────────────────────────────
  socket.on('mover', ({ direccion }) => {
    const room = rooms.get(socket.salaId);
    if (room) room.moverJugador(socket.id, direccion);
  });

  socket.on('bomba', () => {
    const room = rooms.get(socket.salaId);
    if (room) {
      room.colocarBomba(socket.id);
      metrics.bombasColocadas.inc();
    }
  });

  // ── DESCONEXIÓN ───────────────────────────────────────
  socket.on('disconnect', () => {
    metrics.jugadoresConectados.dec();
    logger.info({ event: 'player_disconnected', socketId: socket.id });
    if (!socket.salaId) return;

    const salaId = socket.salaId;
    lobby.eliminarJugador(socket.id);
    const room = rooms.get(salaId);
    if (room) {
      room.eliminarJugador(socket.id);
      io.to(salaId).emit('jugador_salio', { socketId: socket.id });
    }
    rooms.delete(salaId);
    metrics.salasActivas.set(rooms.size);
    io.emit('lista_salas', lobby.getSalasDisponibles());
  });
});

const PORT = process.env.PORT || 4517;
server.listen(PORT, () => {
  logger.info({ event: 'server_started', port: PORT });
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});