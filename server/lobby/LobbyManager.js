const { createClient } = require('redis');
const logger = require('../logger');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || '172.31.20.209';
const MAX_JUGADORES = 4;
const REDIS_READY_TIMEOUT_MS = 5000;
const REDIS_RECONNECT_MAX_DELAY_MS = 5000;

const client = createClient({
  socket: {
    host: redisHost,
    port: 6379,
    // Sin esto, un retries => new Error(...) (o cualquier valor no numérico)
    // haría que el cliente se rinda para siempre tras la primera falla.
    // Con backoff exponencial (tope 5s) sigue reintentando indefinidamente,
    // así que una caída de Redis (reinicio, blip de red) se repara sola.
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 200, REDIS_RECONNECT_MAX_DELAY_MS);
      logger.warn({ event: 'redis_lobby_reintentando', intento: retries, esperaMs: delay });
      return delay;
    }
  }
});

// Sin este listener, cualquier error de socket (Redis se reinicia, PM2
// mata el proceso, se cae la red) se propaga como excepción no capturada
// y tumba la aplicación entera en vez de solo loguearse y reconectar.
client.on('error', (err) => {
  logger.error({ event: 'redis_lobby_socket_error', error: err.message });
});
client.on('reconnecting', () => {
  logger.warn({ event: 'redis_lobby_reconectando', host: redisHost });
});
client.on('ready', () => {
  logger.info({ event: 'redis_lobby_ready', host: redisHost });
});
client.on('end', () => {
  logger.warn({ event: 'redis_lobby_conexion_cerrada', host: redisHost });
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

// Canal pub/sub para avisar a todas las instancias que releean y difundan
// 'lista_salas'. Se expone aquí (en vez de definirlo también en index.js y
// GameRoom.js) para que ambos publiquen al mismo canal sin duplicar el string.
const CANAL_SALAS = 'salas:actualizar';

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

  // Cierra la conexión de forma ordenada (a diferencia de dejar que PM2
  // mate el proceso y el socket se corte a la fuerza, lo que dispara
  // SocketClosedUnexpectedlyError). Llamar en apagado controlado (SIGTERM).
  async desconectar() {
    try {
      await client.quit();
    } catch (err) {
      logger.error({ event: 'redis_lobby_desconectar_error', error: err.message });
    }
  }

  async crearSala(nombre) {
    await esperarListo();
    const nombreLimpio = nombre.trim().toUpperCase().replace(/\s+/g, '-');
    const key = `${SALA_PREFIX}${nombreLimpio}`;
    try {
      const existe = await client.exists(key);
      if (existe) return { error: 'Ya existe una sala con ese nombre.' };
      const sala = { id: nombreLimpio, jugadores: [], enPartida: false };
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
      // Misma cuenta ya sentada en esta sala (otra pestaña/dispositivo): se
      // compara por usuarioId (viene del JWT, no del socket.id que siempre
      // es distinto por conexión) para no dejar entrar dos veces a la misma
      // cuenta a la misma sala.
      if (jugador.usuarioId && sala.jugadores.some(j => j.usuarioId === jugador.usuarioId)) {
        return { error: 'Ya estás en esta sala desde otra pestaña o dispositivo.' };
      }
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

  // Salvavidas para sockets que nunca disparan 'disconnect' en ninguna
  // instancia (crash del proceso, kill -9 de PM2, caída de red que el
  // heartbeat de Socket.io tarda en detectar): sin esto esas salas
  // quedarían fantasma en Redis para siempre (hasta el TTL de 1h).
  // `socketsActivos` debe ser el set de IDs conectados en TODO el clúster
  // (vía io.fetchSockets(), que sí cruza instancias gracias al adapter de
  // Redis) y no solo los locales de este proceso, o se borrarían salas con
  // jugadores conectados a la otra instancia EC2.
  async limpiarSalasInactivas(socketsActivos) {
    await esperarListo();
    const salasEliminadas = [];
    try {
      const keys = await client.keys(`${SALA_PREFIX}*`);
      for (const key of keys) {
        const data = await client.get(key);
        if (!data) continue;
        const sala = JSON.parse(data);
        const tieneSocketActivo = sala.jugadores.some(j => socketsActivos.has(j.id));
        if (!tieneSocketActivo) {
          await client.del(key);
          salasEliminadas.push(sala.id);
          logger.info({ event: 'redis_sala_huerfana_eliminada', salaId: sala.id });
        }
      }
    } catch (err) {
      logger.error({ event: 'redis_limpiar_salas_error', error: err.message });
    }
    return salasEliminadas;
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
        if (sala.enPartida) continue;
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

  async marcarEnPartida(salaId) {
    await esperarListo();
    const key = `${SALA_PREFIX}${salaId}`;
    try {
      const sala = await this.getSala(salaId);
      if (!sala) return { error: 'Sala no encontrada.' };
      sala.enPartida = true;
      await client.set(key, JSON.stringify(sala), { EX: 3600 });
      logger.info({ event: 'redis_sala_en_partida', salaId });
      return { ok: true };
    } catch (err) {
      logger.error({ event: 'redis_marcar_en_partida_error', salaId, error: err.message });
      return { error: 'No se pudo marcar la sala en partida (fallo de conexión con Redis).' };
    }
  }

  async desmarcarEnPartida(salaId) {
    await esperarListo();
    const key = `${SALA_PREFIX}${salaId}`;
    try {
      const sala = await this.getSala(salaId);
      if (!sala) return { error: 'Sala no encontrada.' };
      sala.enPartida = false;
      await client.set(key, JSON.stringify(sala), { EX: 3600 });
      logger.info({ event: 'redis_sala_partida_finalizada', salaId });
      return { ok: true };
    } catch (err) {
      logger.error({ event: 'redis_desmarcar_en_partida_error', salaId, error: err.message });
      return { error: 'No se pudo desmarcar la sala en partida (fallo de conexión con Redis).' };
    }
  }
}

// Se expone el mismo cliente/promesa de conexión para que GameRoom (estado
// de partida) reutilice la conexión de Redis del LobbyManager en vez de
// abrir una segunda conexión redundante hacia 172.31.20.209.
LobbyManager.MAX_JUGADORES = MAX_JUGADORES;
LobbyManager.redisClient = client;
LobbyManager.esperarListo = esperarListo;
LobbyManager.CANAL_SALAS = CANAL_SALAS;
module.exports = LobbyManager;
