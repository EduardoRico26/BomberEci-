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
const REDIS_ADAPTER_RECONNECT_MAX_DELAY_MS = 5000;

// reconnectStrategy explícito: sin él, un solo valor no numérico devuelto
// (o el comportamiento por defecto en algunas versiones) puede hacer que
// el cliente se rinda para siempre tras la primera desconexión. Con backoff
// exponencial (tope 5s) el pub/sub del adapter se repara solo si Redis
// se reinicia o hay un blip de red — sin esto, ambas instancias EC2
// quedarían des-sincronizadas hasta reiniciar el proceso a mano.
const pubClient = createClient({
  socket: {
    host: redisHost,
    port: 6379,
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 200, REDIS_ADAPTER_RECONNECT_MAX_DELAY_MS);
      logger.warn({ event: 'redis_adapter_reintentando', intento: retries, esperaMs: delay });
      return delay;
    }
  }
});
const subClient = pubClient.duplicate(); // hereda el mismo reconnectStrategy

// "SocketClosedUnexpectedlyError" llega por este evento: sin listener se
// propaga como excepción no capturada y tumba el proceso completo.
pubClient.on('error', err => logger.error({ event: 'redis_adapter_pub_error', error: err.message }));
subClient.on('error', err => logger.error({ event: 'redis_adapter_sub_error', error: err.message }));
pubClient.on('reconnecting', () => logger.warn({ event: 'redis_adapter_pub_reconectando', host: redisHost }));
subClient.on('reconnecting', () => logger.warn({ event: 'redis_adapter_sub_reconectando', host: redisHost }));
pubClient.on('ready', () => logger.info({ event: 'redis_adapter_pub_ready', host: redisHost }));
subClient.on('ready', () => logger.info({ event: 'redis_adapter_sub_ready', host: redisHost }));

const adapterListo = Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info({ event: 'redis_adapter_connected', host: redisHost });
}).catch(err => {
  logger.error({ event: 'redis_adapter_error', error: err.message });
  throw err;
});

// ── SINCRONIZAR "lista_salas" ENTRE INSTANCIAS ───────────
// El cliente `subClient` ya está dedicado a los canales internos del
// adapter de Socket.io; se usa un cliente aparte para no acoplar nuestro
// propio pub/sub a su ciclo de vida. Cuando cualquier instancia crea, une
// o elimina jugadores de una sala, publica en este canal; cada instancia
// (incluida la que publicó) recibe el aviso, relee Redis y emite
// 'lista_salas' a SUS propios clientes conectados.
const CANAL_SALAS = LobbyManager.CANAL_SALAS;
const salasSubClient = pubClient.duplicate();

salasSubClient.on('error', err => logger.error({ event: 'redis_salas_sub_error', error: err.message }));
salasSubClient.on('reconnecting', () => logger.warn({ event: 'redis_salas_sub_reconectando', host: redisHost }));
salasSubClient.on('ready', () => logger.info({ event: 'redis_salas_sub_ready', host: redisHost }));

const salasSubListo = salasSubClient.connect().then(async () => {
  await salasSubClient.subscribe(CANAL_SALAS, async () => {
    try {
      const salas = await lobby.getSalasDisponibles();
      io.emit('lista_salas', salas);
    } catch (err) {
      logger.error({ event: 'redis_salas_sub_handler_error', error: err.message });
    }
  });
  logger.info({ event: 'redis_salas_sub_suscrito', canal: CANAL_SALAS });
}).catch(err => {
  logger.error({ event: 'redis_salas_sub_connect_error', error: err.message });
  throw err;
});

async function difundirListaSalas() {
  try {
    await pubClient.publish(CANAL_SALAS, '1');
  } catch (err) {
    logger.error({ event: 'redis_publish_salas_error', error: err.message });
  }
}

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

// Compartida entre 'disconnect' (el jugador cierra/pierde conexión) y
// 'salir_sala' (el jugador pulsa "Salir" estando conectado): en ambos casos
// hay que sacarlo del roster del lobby, del GameRoom y avisar al resto,
// para no duplicar esa lógica en dos handlers.
async function salirDeSalaActual(socket, salaId) {
  try {
    await lobby.eliminarJugador(socket.id);
    const room = rooms.get(salaId);
    if (room) {
      await room.eliminarJugador(socket.id);
      io.to(salaId).emit('jugador_salio', { socketId: socket.id });
    }

    const salaRestante = await lobby.getSala(salaId);
    if (!salaRestante) {
      if (room) room.destruirLocal();
      await GameRoom.eliminarEstado(salaId);
      rooms.delete(salaId);
      logger.info({ event: 'sala_vacia_eliminada', salaId });
    } else {
      io.to(salaId).emit('jugadores_sala', salaRestante.jugadores);
    }

    metrics.salasActivas.set(rooms.size);
    await difundirListaSalas();
  } catch (err) {
    logger.error({ event: 'salir_sala_error', salaId, socketId: socket.id, error: err.message, stack: err.stack });
  }
}

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
      await room.inicializar();
      rooms.set(salaId, room);
      metrics.salaCreada.inc();
      metrics.salasActivas.set(rooms.size);

      const resultadoUnion = await lobby.unirseASala(salaId, { id: socket.id, nombre, color });
      await room.agregarJugador(socket.id, nombre, color);
      socket.join(salaId);
      socket.salaId = salaId;
      socket.nombre = nombre;
      socket.emit('sala_creada', { salaId });
      io.to(salaId).emit('jugadores_sala', resultadoUnion.sala.jugadores);
      await difundirListaSalas();
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
      if (sala.enPartida) {
        socket.emit('error_sala', 'La partida ya comenzó, espera la siguiente ronda');
        return;
      }
      // "nombre" viene de usuario.nombre (el perfil de la cuenta logueada),
      // no es un campo que el jugador escriba cada vez que entra a una sala,
      // así que dos pestañas de la misma cuenta siempre mandan el mismo
      // nombre: alcanza con comparar por nombre dentro de ESTA sala para
      // bloquear la doble entrada, sin necesitar leer el JWT del socket.
      if (sala.jugadores.some(j => LobbyManager.normalizarNombre(j.nombre) === LobbyManager.normalizarNombre(nombre))) {
        socket.emit('error_sala', 'Ya estás en esta sala desde otra pestaña o dispositivo.');
        return;
      }
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
        // La sala pudo haber sido creada en otra instancia: reutiliza su
        // estado de Redis en vez de regenerar el mapa desde cero.
        await room.inicializar();
        rooms.set(salaId, room);
      }
      await room.agregarJugador(socket.id, nombre, color);
      socket.join(salaId);
      socket.salaId = salaId;
      socket.nombre = nombre;
      io.to(salaId).emit('jugadores_sala', resultado.sala.jugadores);
      await difundirListaSalas();
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
      const estado = await room.reiniciar(sala.jugadores);
      metrics.partidasIniciadas.inc();
      logger.info({ event: 'partida_iniciada', salaId, jugadores: sala.jugadores.length });
      io.to(salaId).emit('iniciar_partida', estado);
      await lobby.marcarEnPartida(salaId);
      await difundirListaSalas();
    } catch (err) {
      logger.error({ event: 'iniciar_partida_error', salaId, socketId: socket.id, error: err.message, stack: err.stack });
      socket.emit('error_sala', 'Error interno al iniciar la partida. Intenta de nuevo.');
    }
  });

  // ── EVENTOS DE JUEGO ────────────────────────────────
  socket.on('mover', async ({ direccion }) => {
    const room = rooms.get(socket.salaId);
    if (!room) return;
    try {
      await room.moverJugador(socket.id, direccion);
    } catch (err) {
      logger.error({ event: 'mover_error', salaId: socket.salaId, socketId: socket.id, error: err.message });
    }
  });

  socket.on('bomba', async () => {
    const room = rooms.get(socket.salaId);
    if (!room) return;
    try {
      await room.colocarBomba(socket.id);
      metrics.bombasColocadas.inc();
    } catch (err) {
      logger.error({ event: 'bomba_error', salaId: socket.salaId, socketId: socket.id, error: err.message });
    }
  });

  // El cliente solo avisa "pisé esto"; la identidad (sala/jugador) sale del
  // propio socket, nunca del payload, para no confiar en un salaId/socketId
  // que el cliente podría falsificar.
  socket.on('recoger_powerup', async ({ powerupId }) => {
    const room = rooms.get(socket.salaId);
    if (!room) return;
    try {
      await room.recogerPowerup(socket.id, powerupId);
    } catch (err) {
      logger.error({ event: 'recoger_powerup_error', salaId: socket.salaId, socketId: socket.id, error: err.message });
    }
  });

  // ── SALIR DE LA SALA (botón del jugador, sin desconectar el socket) ──
  socket.on('salir_sala', async () => {
    if (!socket.salaId) return;
    const salaId = socket.salaId;
    logger.info({ event: 'jugador_salio_voluntariamente', salaId, socketId: socket.id });
    socket.leave(salaId);
    socket.salaId = null;
    await salirDeSalaActual(socket, salaId);
  });

  // ── DESCONEXIÓN ─────────────────────────────────────
  socket.on('disconnect', async () => {
    metrics.jugadoresConectados.dec();
    logger.info({ event: 'player_disconnected', socketId: socket.id });
    if (!socket.salaId) return;
    const salaId = socket.salaId;
    await salirDeSalaActual(socket, salaId);
  });
});

// ── LIMPIEZA PERIÓDICA DE SALAS HUÉRFANAS ────────────
// Salvavidas del disconnect handler de arriba: si un proceso muere sin
// disparar 'disconnect' (kill -9, crash), la sala queda en Redis con
// jugadores que ya no existen en ningún lado. io.fetchSockets() consulta
// TODAS las instancias del clúster vía el adapter de Redis (a diferencia
// de io.sockets.sockets, que solo ve los sockets locales de este proceso),
// así que un jugador conectado a la otra instancia EC2 no se marca como
// inactivo por error.
const LIMPIEZA_SALAS_INTERVALO_MS = 60000;

async function limpiarSalasHuérfanas() {
  try {
    const socketsActivos = new Set((await io.fetchSockets()).map(s => s.id));
    const salasEliminadas = await lobby.limpiarSalasInactivas(socketsActivos);

    for (const salaId of salasEliminadas) {
      const room = rooms.get(salaId);
      if (room) room.destruirLocal();
      await GameRoom.eliminarEstado(salaId);
      rooms.delete(salaId);
    }

    if (salasEliminadas.length > 0) {
      metrics.salasActivas.set(rooms.size);
      await difundirListaSalas();
      logger.info({ event: 'limpieza_salas_huerfanas', salas: salasEliminadas });
    }
  } catch (err) {
    logger.error({ event: 'limpieza_salas_error', error: err.message, stack: err.stack });
  }
}

setInterval(limpiarSalasHuérfanas, LIMPIEZA_SALAS_INTERVALO_MS);

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
  conLimite(lobby.conectar(), 'lobby'),
  conLimite(salasSubListo, 'salas_sub')
]).then(() => {
  server.listen(PORT, () => {
    logger.info({ event: 'server_started', port: PORT });
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});

// PM2 manda SIGINT/SIGTERM al reiniciar o detener la app. Sin esto, Node
// mata el proceso con las conexiones Redis todavía abiertas y el socket se
// corta a la fuerza (de ahí el SocketClosedUnexpectedlyError en los logs).
// Cerrando el server y los clientes Redis a mano, el cierre es ordenado.
let cerrando = false;
async function apagar(señal) {
  if (cerrando) return;
  cerrando = true;
  logger.info({ event: 'apagando_servidor', señal });

  server.close();
  await Promise.allSettled([
    lobby.desconectar(),
    pubClient.quit(),
    subClient.quit(),
    salasSubClient.quit()
  ]);

  logger.info({ event: 'servidor_apagado' });
  process.exit(0);
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
