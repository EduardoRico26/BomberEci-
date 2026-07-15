const { createClient } = require('redis');
const logger = require('../logger');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || '172.31.20.209';
const MAX_JUGADORES = 4;
const REDIS_READY_TIMEOUT_MS = 5000;

const client = createClient({
  socket: { host: redisHost, port: 6379 }
});

// Sin este listener, cualquier error de socket post-conexión (p.ej. Redis
// se reinicia) se propaga como excepción no capturada y tumba el proceso.
client.on('error', (err) => {
  logger.error({ event: 'redis_lobby_socket_error', error: err.message });
});

// El primer evento de Socket.io puede llegar antes de que este connect()
// resuelva. En vez de dejar que los comandos fallen con "client is closed",
// cada método espera esta misma promesa antes de tocar Redis.
const listo = client.connect()
  .then(() => {
    logger.info({ event: 'redis_lobby_connected', host: redisHost });
  })
  .catch(err => {
    logger.error({ event: 'redis_lobby_connect_failed', host: redisHost, error: err.message });
    throw err;
  });

const SALA_PREFIX = 'sala:';

// `listo` (client.connect()) no se rechaza sola si Redis nunca responde: el
// reconnectStrategy por defecto reintenta indefinidamente incluso en el
// primer intento. Sin este límite, cualquier método de abajo se quedaría
// esperando para siempre y el jugador nunca vería ni éxito ni error.
function esperarListo() {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis no respondió en ${REDIS_READY_TIMEOUT_MS}ms`)),
      REDIS_READY_TIMEOUT_MS
    );
  });
  return Promise.race([listo, timeout]).finally(() => clearTimeout(timer));
}

class LobbyManager {

  // Se puede awaitear desde fuera (p.ej. antes de server.listen). A
  // diferencia de los métodos de instancia, aquí sí se expone la promesa
  // sin límite de tiempo: el arranque decide su propio timeout.
  conectar() {
    return listo;
  }

  async crearSala(nombre) {
    await esperarListo();
    const nombreLimpio = nombre.trim().toUpperCase().replace(/\s+/g, '-');
    const key = `${SALA_PREFIX}${nombreLimpio}`;
    try {
      const existe = await client.exists(key);
      if (existe) return { error: 'Ya existe una sala con ese nombre.' };
      const sala = { id: nombreLimpio, jugadores: [] };
      await client.set(key, JSON.stringify(sala), { EX: 3600 });
      logger.info({ event: 'redis_sala_creada', salaId: nombreLimpio });
      return { ok: true, salaId: nombreLimpio };
    } catch (err) {
      logger.error({ event: 'redis_crear_sala_error', nombre: nombreLimpio, error: err.message });
      return { error: 'No se pudo crear la sala (fallo de conexión con Redis).' };
    }
  }

  async getSala(salaId) {
    await esperarListo();
    try {
      const data = await client.get(`${SALA_PREFIX}${salaId}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error({ event: 'redis_get_sala_error', salaId, error: err.message });
      return null;
    }
  }

  async unirseASala(salaId, jugador) {
    await esperarListo();
    const key = `${SALA_PREFIX}${salaId}`;
    try {
      const sala = await this.getSala(salaId);
      if (!sala) return { error: 'Sala no encontrada.' };
      if (sala.jugadores.length >= MAX_JUGADORES) return { error: 'Sala llena.' };
      if (sala.jugadores.some(j => j.color === jugador.color)) {
        return { error: 'Ese color ya está tomado en esta sala.' };
      }
      sala.jugadores.push(jugador);
      await client.set(key, JSON.stringify(sala), { EX: 3600 });
      logger.info({ event: 'redis_jugador_unido', salaId, jugador: jugador.nombre });
      return { ok: true, sala };
    } catch (err) {
      logger.error({ event: 'redis_unirse_sala_error', salaId, error: err.message });
      return { error: 'No se pudo unir a la sala (fallo de conexión con Redis).' };
    }
  }

  async eliminarJugador(socketId) {
    await esperarListo();
    try {
      const keys = await client.keys(`${SALA_PREFIX}*`);
      for (const key of keys) {
        const data = await client.get(key);
        if (!data) continue;
        const sala = JSON.parse(data);
        const index = sala.jugadores.findIndex(j => j.id === socketId);
        if (index !== -1) {
          sala.jugadores.splice(index, 1);
          if (sala.jugadores.length === 0) {
            await client.del(key);
          } else {
            await client.set(key, JSON.stringify(sala), { EX: 3600 });
          }
          return sala.id;
        }
      }
      return null;
    } catch (err) {
      logger.error({ event: 'redis_eliminar_jugador_error', socketId, error: err.message });
      return null;
    }
  }

  async getSalasDisponibles() {
    await esperarListo();
    try {
      const keys = await client.keys(`${SALA_PREFIX}*`);
      const salas = [];
      for (const key of keys) {
        const data = await client.get(key);
        if (!data) continue;
        const sala = JSON.parse(data);
        salas.push({
          id: sala.id,
          jugadores: sala.jugadores.length,
          coloresTomados: sala.jugadores.map(j => j.color)
        });
      }
      return salas;
    } catch (err) {
      logger.error({ event: 'redis_get_salas_error', error: err.message });
      return [];
    }
  }
}

LobbyManager.MAX_JUGADORES = MAX_JUGADORES;
module.exports = LobbyManager;
