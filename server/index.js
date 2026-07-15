const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient }  = require('redis');
const path         = require('path');
const logger       = require('./logger');
const LobbyManager = require('./lobby/LobbyManager');
const GameRoom     = require('./game/GameRoom');
const cookieParser = require('cookie-parser');
const authRoutes   = require('./auth/authRoutes');
require('dotenv').config();
const metrics = require('./metrics');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const redisHost = process.env.REDIS_HOST || '172.31.20.209';

const pubClient = createClient({ socket: { host: redisHost, port: 6379 } });
const subClient = pubClient.duplicate();
pubClient.on('error', err => logger.error({ event: 'redis_adapter_pub_error', error: err.message }));
subClient.on('error', err => logger.error({ event: 'redis_adapter_sub_error', error: err.message }));

const adapterListo = Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info({ event: 'redis_adapter_connected', host: redisHost });
}).catch(err => {
  logger.error({ event: 'redis_adapter_error', error: err.message });
  throw err;
});

app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, '../client-react/dist')));
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);

const COLORES_VALIDOS = ['azul', 'verde', 'rosado', 'morado'];
const lobby = new LobbyManager();
const rooms = new Map();

app.use((req, res, next) => {
  if (req.method === 'GET'
    && !req.path.startsWith('/auth')
    && !req.path.startsWith('/health')
    && !req.path.startsWith('/metrics')
    && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(__dirname, '../client-react/dist/index.html'));
  } else {
    next();
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    servicio: 'BomberEci Arena',
    timestamp: new Date().toISOString(),
    salasActivas: rooms.size,
    jugadoresConectados: io.engine.clientsCount
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

io.on('connection', (socket) => {
  metrics.jugadoresConectados.inc();
  logger.info({ event: 'player_connected', socketId: socket.id });

  socket.on('pedir_salas', async () => {
    try {
      socket.emit('lista_salas', await lobby.getSalasDisponibles());
    } catch (err) {
      logger.error({ event: 'pedir_salas_error', socketId: socket.id, error: err.message });
    }
  });

  // Enviar lista inicial al conectarse
  lobby.getSalasDisponibles()
    .then(salas => socket.emit('lista_salas', salas))
    .catch(err => logger.error({ event: 'lista_inicial_error', socketId: socket.id, error: err.message }));

  // ── CREAR SALA ──────────────────────────────────────
  socket.on('crear_sala', async ({ nombre, nombreSala, color }) => {
    logger.info({ event: 'crear_sala_solicitud', nombreSala, nombre, color, socketId: socket.id });

    if (!COLORES_VALIDOS.includes(color)) {
      socket.emit('error_sala', 'Elige un color válido.');
      return;
    }

    try {
      const resultado = await lobby.crearSala(nombreSala);
      if (resultado.error) {
        logger.warn({ event: 'crear_sala_rechazada', nombreSala, error: resultado.error, socketId: socket.id });
        socket.emit('error_sala', resultado.error);
        return;
      }

      const salaId = resultado.salaId;
      const room = new GameRoom(salaId, io, logger);
      rooms.set(salaId, room);
      metrics.salaCreada.inc();
      metrics.salasActivas.set(rooms.size);

      await lobby.unirseASala(salaId, { id: socket.id, nombre, color });
      room.agregarJugador(socket.id, nombre, color);
      socket.join(salaId);
      socket.salaId = salaId;
      socket.nombre = nombre;
      socket.emit('sala_creada', { salaId });
      io.emit('lista_salas', await lobby.getSalasDisponibles());
      logger.info({ event: 'sala_creada', salaId, creador: nombre, socketId: socket.id });
    } catch (err) {
      logger.error({ event: 'crear_sala_error', nombreSala, socketId: socket.id, error: err.message, stack: err.stack });
      socket.emit('error_sala', 'Error interno al crear la sala. Intenta de nuevo.');
    }
  });

  // ── UNIRSE A SALA ───────────────────────────────────
  socket.on('unirse_sala', async ({ salaId, nombre, color }) => {
    logger.info({ event: 'unirse_sala_solicitud', salaId, nombre, color, socketId: socket.id });

    if (!COLORES_VALIDOS.includes(color)) {
      socket.emit('error_sala', 'Elige un color válido.');
      return;
    }

    try {
      const sala = await lobby.getSala(salaId);
      if (!sala) { socket.emit('error_sala', 'Sala no encontrada'); return; }
      if (sala.jugadores.length >= LobbyManager.MAX_JUGADORES) {
        socket.emit('error_sala', 'Sala llena'); return;
      }
      if (sala.jugadores.some(j => j.color === color)) {
        socket.emit('error_sala', 'Ese color ya está tomado en esta sala.');
        return;
      }

      const resultado = await lobby.unirseASala(salaId, { id: socket.id, nombre, color });
      if (resultado.error) {
        socket.emit('error_sala', resultado.error);
        return;
      }

      let room = rooms.get(salaId);
      if (!room) {
        room = new GameRoom(salaId, io, logger);
        rooms.set(salaId, room);
      }
      room.agregarJugador(socket.id, nombre, color);
      socket.join(salaId);
      socket.salaId = salaId;
      socket.nombre = nombre;
      io.emit('lista_salas', await lobby.getSalasDisponibles());
      logger.info({ event: 'jugador_unido_sala', salaId, nombre, socketId: socket.id });
    } catch (err) {
      logger.error({ event: 'unirse_sala_error', salaId, socketId: socket.id, error: err.message, stack: err.stack });
      socket.emit('error_sala', 'Error interno al unirse a la sala. Intenta de nuevo.');
    }
  });

  // ── INICIAR PARTIDA MANUAL ──────────────────────────
  socket.on('iniciar_partida_manual', async () => {
    const salaId = socket.salaId;
    if (!salaId) return;

    try {
      const sala = await lobby.getSala(salaId);
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
    } catch (err) {
      logger.error({ event: 'iniciar_partida_error', salaId, socketId: socket.id, error: err.message, stack: err.stack });
      socket.emit('error_sala', 'Error interno al iniciar la partida. Intenta de nuevo.');
    }
  });

  // ── EVENTOS DE JUEGO ────────────────────────────────
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

  // ── DESCONEXIÓN ─────────────────────────────────────
  socket.on('disconnect', async () => {
    metrics.jugadoresConectados.dec();
    logger.info({ event: 'player_disconnected', socketId: socket.id });
    if (!socket.salaId) return;
    const salaId = socket.salaId;
    try {
      await lobby.eliminarJugador(socket.id);
      const room = rooms.get(salaId);
      if (room) {
        room.eliminarJugador(socket.id);
        io.to(salaId).emit('jugador_salio', { socketId: socket.id });
      }
      metrics.salasActivas.set(rooms.size);
      io.emit('lista_salas', await lobby.getSalasDisponibles());
    } catch (err) {
      logger.error({ event: 'disconnect_error', salaId, socketId: socket.id, error: err.message, stack: err.stack });
    }
  });
});

const PORT = process.env.PORT || 4517;
const REDIS_STARTUP_TIMEOUT_MS = 5000;

// El reconnectStrategy por defecto de node-redis reintenta indefinidamente
// incluso en el primer intento de conexión, así que estas promesas nunca
// se resuelven ni se rechazan solas si Redis está caído. Sin este límite,
// el servidor jamás llamaría a server.listen() (ni siquiera /health
// respondería) mientras Redis no esté disponible.
function conLimite(promesa, etiqueta) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      logger.warn({ event: 'redis_startup_timeout', recurso: etiqueta, timeoutMs: REDIS_STARTUP_TIMEOUT_MS });
      resolve(false);
    }, REDIS_STARTUP_TIMEOUT_MS);
  });
  return Promise.race([promesa.then(() => true).catch(() => false), timeout])
    .finally(() => clearTimeout(timer));
}

// Arranca el servidor en cuanto el adapter de Socket.io y el LobbyManager
// confirmen su conexión a Redis (o tras el timeout de arriba). Si Redis
// sigue sin responder después, cada llamada individual en LobbyManager
// vuelve a intentarlo y reporta su propio error al jugador.
Promise.all([
  conLimite(adapterListo, 'adapter'),
  conLimite(lobby.conectar(), 'lobby')
]).then(() => {
  server.listen(PORT, () => {
    logger.info({ event: 'server_started', port: PORT });
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});
