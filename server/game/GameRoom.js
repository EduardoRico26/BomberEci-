const { generarMapa, procesarMovimiento, colocarBomba, explotarBomba, verificarGanador } = require('./GameEngine');
const metrics = require('../metrics');
const LobbyManager = require('../lobby/LobbyManager');

// Misma conexión Redis que usa LobbyManager (172.31.20.209:6379): así el
// estado de partida vive en Redis y cualquier instancia EC2 detrás del LB
// puede leerlo/escribirlo, en vez de quedar atrapado en memoria local.
const redisClient = LobbyManager.redisClient;
const esperarListo = LobbyManager.esperarListo;

const GAMEROOM_PREFIX = 'gameroom:';
const GAMEROOM_TTL_SEGUNDOS = 3600;

const SPAWNS = [
  { x: 1, y: 1 },
  { x: 13, y: 11 },
  { x: 13, y: 1 },
  { x: 1, y: 11 }
];

class GameRoom {
  constructor(salaId, io, logger) {
    this.salaId = salaId;
    this.io = io;
    this.logger = logger;
    // Timers de explosión: solo existen en la instancia que colocó la bomba.
    // La emisión del resultado (io.to(...).emit) llega a todas las
    // instancias vía el adapter de Redis de Socket.io.
    this.timers = new Map();
  }

  static redisKey(salaId) {
    return `${GAMEROOM_PREFIX}${salaId}`;
  }

  // Borra el estado de una sala en Redis aunque esta instancia nunca haya
  // tenido un GameRoom local para ella (p.ej. el último jugador se
  // desconectó de una instancia distinta a la que creó la sala).
  static async eliminarEstado(salaId) {
    await esperarListo();
    await redisClient.del(GameRoom.redisKey(salaId));
  }

  async _leerEstado() {
    await esperarListo();
    const data = await redisClient.get(GameRoom.redisKey(this.salaId));
    return data ? JSON.parse(data) : null;
  }

  async _guardarEstado(estado) {
    await esperarListo();
    await redisClient.set(GameRoom.redisKey(this.salaId), JSON.stringify(estado), { EX: GAMEROOM_TTL_SEGUNDOS });
  }

  // Si otra instancia ya inicializó esta sala en Redis, reutiliza ese
  // estado en vez de regenerar el mapa y perder jugadores/bombas.
  async inicializar() {
    let estado = await this._leerEstado();
    if (!estado) {
      estado = { mapa: generarMapa(), jugadores: [], bombas: [] };
      await this._guardarEstado(estado);
    }
    return estado;
  }

  async agregarJugador(socketId, nombre, color) {
    const estado = await this.inicializar();
    const spawn = SPAWNS[estado.jugadores.length] || SPAWNS[0];
    const jugador = {
      id: socketId,
      nombre,
      color,
      x: spawn.x,
      y: spawn.y,
      vivo: true,
      radio: 2,
      maxBombas: 1
    };
    estado.jugadores.push(jugador);
    await this._guardarEstado(estado);
    this.logger.info({ event: 'jugador_unido', salaId: this.salaId, nombre, socketId });
    return jugador;
  }

  async moverJugador(socketId, direccion) {
    const inicio = Date.now();
    const estado = await this._leerEstado();
    if (!estado) return;
    const jugador = procesarMovimiento(estado, socketId, direccion);
    if (jugador) {
      await this._guardarEstado(estado);
      const latencia = Date.now() - inicio;
      metrics.latenciaWebSocket.observe(latencia);
      this.io.to(this.salaId).emit('estado_juego', estado);
    }
  }

  async colocarBomba(socketId) {
    const estado = await this._leerEstado();
    if (!estado) return;
    const bomba = colocarBomba(estado, socketId);
    if (!bomba) return;

    await this._guardarEstado(estado);
    this.logger.info({ event: 'bomba_colocada', salaId: this.salaId, socketId, x: bomba.x, y: bomba.y });
    this.io.to(this.salaId).emit('estado_juego', estado);

    const timer = setTimeout(async () => {
      try {
        const estadoActual = await this._leerEstado();
        if (!estadoActual) return;
        const resultado = explotarBomba(estadoActual, bomba);
        await this._guardarEstado(estadoActual);

        if (resultado.eliminados.length > 0) {
          metrics.jugadoresEliminados.inc(resultado.eliminados.length);
          this.logger.info({ event: 'bomba_explotada', salaId: this.salaId, eliminados: resultado.eliminados });
        }

        this.io.to(this.salaId).emit('explosion', { celdas: resultado.celdas, eliminados: resultado.eliminados });
        this.io.to(this.salaId).emit('estado_juego', estadoActual);

        if (resultado.eliminados.length > 0) {
          const ganador = verificarGanador(estadoActual);
          if (ganador) {
            const nombre = ganador === 'empate' ? 'empate' : ganador.nombre;
            metrics.partidasCompletadas.inc();
            this.logger.info({ event: 'partida_terminada', salaId: this.salaId, ganador: nombre });
            this.io.to(this.salaId).emit('fin_partida', { ganador: nombre });
          }
        }
      } catch (err) {
        this.logger.error({ event: 'explosion_error', salaId: this.salaId, error: err.message });
      } finally {
        this.timers.delete(bomba.id);
      }
    }, bomba.timer);

    this.timers.set(bomba.id, timer);
  }

  // Devuelve la cantidad de jugadores restantes para que quien llame
  // decida si hay que eliminar la sala.
  async eliminarJugador(socketId) {
    const estado = await this._leerEstado();
    if (!estado) return 0;
    estado.jugadores = estado.jugadores.filter(j => j.id !== socketId);
    await this._guardarEstado(estado);
    this.logger.info({ event: 'jugador_salio', salaId: this.salaId, socketId });
    return estado.jugadores.length;
  }

  async reiniciar(jugadoresSala) {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    const estado = {
      mapa: generarMapa(),
      bombas: [],
      jugadores: jugadoresSala.map((j, i) => {
        const spawn = SPAWNS[i] || SPAWNS[0];
        return {
          id: j.id,
          nombre: j.nombre,
          color: j.color,
          x: spawn.x,
          y: spawn.y,
          vivo: true,
          radio: 2,
          maxBombas: 1
        };
      })
    };
    await this._guardarEstado(estado);
    this.logger.info({ event: 'partida_reiniciada', salaId: this.salaId, jugadores: estado.jugadores.length });
    return estado;
  }

  async getEstado() {
    return await this._leerEstado();
  }

  // Limpieza local (timers de esta instancia) al eliminar la sala; el
  // borrado del estado en Redis lo hace GameRoom.eliminarEstado().
  destruirLocal() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

module.exports = GameRoom;
