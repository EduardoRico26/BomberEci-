const { createClient } = require('redis');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || '172.31.20.209';
const MAX_JUGADORES = 4;

const client = createClient({
  socket: { host: redisHost, port: 6379 }
});

client.connect().catch(err => console.error('Redis LobbyManager error:', err));

const SALA_PREFIX = 'sala:';

class LobbyManager {

  async crearSala(nombre) {
    const nombreLimpio = nombre.trim().toUpperCase().replace(/\s+/g, '-');
    const key = `${SALA_PREFIX}${nombreLimpio}`;
    const existe = await client.exists(key);
    if (existe) return { error: 'Ya existe una sala con ese nombre.' };
    const sala = { id: nombreLimpio, jugadores: [] };
    await client.set(key, JSON.stringify(sala), { EX: 3600 });
    return { ok: true, salaId: nombreLimpio };
  }

  async getSala(salaId) {
    const data = await client.get(`${SALA_PREFIX}${salaId}`);
    return data ? JSON.parse(data) : null;
  }

  async unirseASala(salaId, jugador) {
    const key = `${SALA_PREFIX}${salaId}`;
    const sala = await this.getSala(salaId);
    if (!sala) return { error: 'Sala no encontrada.' };
    if (sala.jugadores.length >= MAX_JUGADORES) return { error: 'Sala llena.' };
    if (sala.jugadores.some(j => j.color === jugador.color)) {
      return { error: 'Ese color ya está tomado en esta sala.' };
    }
    sala.jugadores.push(jugador);
    await client.set(key, JSON.stringify(sala), { EX: 3600 });
    return { ok: true, sala };
  }

  async eliminarJugador(socketId) {
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
  }

  async getSalasDisponibles() {
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
  }
}

LobbyManager.MAX_JUGADORES = MAX_JUGADORES;
module.exports = LobbyManager;
