const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const logger     = require('./logger');
const LobbyManager = require('./lobby/LobbyManager');
const GameRoom     = require('./game/GameRoom');

const cookieParser = require('cookie-parser');
const authRoutes = require('./auth/authRoutes');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);

const lobby = new LobbyManager();
const rooms = new Map();

// Ruta principal redirige a registro si no está autenticado
app.get('/', (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    res.redirect('/registro.html');
    return;
  }
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

io.on('connection', (socket) => {
  logger.info({ event: 'player_connected', socketId: socket.id });
  socket.emit('lista_salas', lobby.getSalasDisponibles());

  socket.on('pedir_salas', () => {
    socket.emit('lista_salas', lobby.getSalasDisponibles());
  });

  // ── CREAR SALA ──────────────────────────────────────────
  socket.on('crear_sala', ({ nombre }) => {
    const salaId = lobby.crearSala();
    const room   = new GameRoom(salaId, io, logger);
    rooms.set(salaId, room);

    lobby.unirseASala(salaId, { id: socket.id, nombre });
    room.agregarJugador(socket.id, nombre);
    socket.join(salaId);
    socket.salaId  = salaId;
    socket.nombre  = nombre;

    socket.emit('sala_creada', { salaId });
    io.emit('lista_salas', lobby.getSalasDisponibles());
    logger.info({ event: 'sala_creada', salaId, creador: nombre });
  });

  // ── UNIRSE A SALA ───────────────────────────────────────
  socket.on('unirse_sala', ({ salaId, nombre }) => {
    const sala = lobby.getSala(salaId);
    if (!sala) { socket.emit('error_sala', 'Sala no encontrada'); return; }
    if (sala.jugadores.length >= 2) { socket.emit('error_sala', 'Sala llena'); return; }

    lobby.unirseASala(salaId, { id: socket.id, nombre });
    const room = rooms.get(salaId);
    room.agregarJugador(socket.id, nombre);
    socket.join(salaId);
    socket.salaId = salaId;
    socket.nombre = nombre;

    io.emit('lista_salas', lobby.getSalasDisponibles());

    if (sala.jugadores.length >= 2) {
      logger.info({ event: 'partida_iniciada', salaId });
      io.to(salaId).emit('iniciar_partida', room.getEstado());
    }
  });

  // ── EVENTOS DE JUEGO ────────────────────────────────────
  socket.on('mover', ({ direccion }) => {
    const room = rooms.get(socket.salaId);
    if (room) room.moverJugador(socket.id, direccion);
  });

  socket.on('bomba', () => {
    const room = rooms.get(socket.salaId);
    if (room) room.colocarBomba(socket.id);
  });

  // ── DESCONEXIÓN ─────────────────────────────────────────
  socket.on('disconnect', () => {
    logger.info({ event: 'player_disconnected', socketId: socket.id });
    if (!socket.salaId) return;

    const salaId = socket.salaId;
    lobby.eliminarJugador(socket.id);
    const room = rooms.get(salaId);
    if (room) {
      room.eliminarJugador(socket.id);
      io.to(salaId).emit('jugador_salio', { socketId: socket.id });
    }
    io.emit('lista_salas', lobby.getSalasDisponibles());
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  logger.info({ event: 'server_started', port: PORT });
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});