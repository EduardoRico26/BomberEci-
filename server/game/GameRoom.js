const {
  generarMapa,
  procesarMovimiento,
  colocarBomba,
  explotarBomba,
  verificarGanador,
  recogerPowerup,
  revisarExpiracionPoderes
} = require('./GameEngine');
const metrics = require('../metrics');
const LobbyManager = require('../lobby/LobbyManager');
const { WatchError } = require('redis');

// Misma conexión Redis que usa LobbyManager (172.31.20.209:6379): así el
// estado de partida vive en Redis y cualquier instancia EC2 detrás del LB
// puede leerlo/escribirlo, en vez de quedar atrapado en memoria local.
const redisClient = LobbyManager.redisClient;
const esperarListo = LobbyManager.esperarListo;
const lobby = new LobbyManager();

const GAMEROOM_PREFIX = 'gameroom:';
const GAMEROOM_TTL_SEGUNDOS = 3600;
const MAX_REINTENTOS_TRANSACCION = 8;

const SPAWNS = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 1, y: 11 },
  { x: 13, y: 11 }
];

const VELOCIDAD_BASE_MS = 180;
const PODERES_TIMER_INTERVALO_MS = 1000;

function crearJugador(socketId, nombre, color, spawn) {
  return {
    id: socketId,
    nombre,
    color,
    x: spawn.x,
    y: spawn.y,
    vivo: true,
    radio: 2,
    maxBombas: 1,
    vidas: 1,
    shield: false,
    shieldExpira: null,
    doublebomb: false,
    doublebombExpira: null,
    flash: false,
    flashExpira: null,
    velocidad: VELOCIDAD_BASE_MS,
    ultimoMovimiento: 0
  };
}

class GameRoom {
  constructor(salaId, io, logger) {
    this.salaId = salaId;
    this.io = io;
    this.logger = logger;
    this.timers = new Map();
  }

  static redisKey(salaId) {
    return `${GAMEROOM_PREFIX}${salaId}`;
  }

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

  async _actualizarEstado(mutator) {
    await esperarListo();
    const key = GameRoom.redisKey(this.salaId);

    for (let intento = 0; intento < MAX_REINTENTOS_TRANSACCION; intento++) {
      let resultadoMutador;
      let estadoMutado = null;

      try {
        const execResult = await redisClient.executeIsolated(async (isolatedClient) => {
          await isolatedClient.watch(key);
          const data = await isolatedClient.get(key);

          if (!data) {
            await isolatedClient.unwatch();
            return null;
          }

          const estado = JSON.parse(data);
          resultadoMutador = await mutator(estado);
          estadoMutado = estado;

          return isolatedClient
            .multi()
            .set(key, JSON.stringify(estado), { EX: GAMEROOM_TTL_SEGUNDOS })
            .exec();
        });

        if (execResult === null && estadoMutado === null) {
          return { estado: null, resultado: undefined };
        }
        return { estado: estadoMutado, resultado: resultadoMutador };
      } catch (err) {
        if (err instanceof WatchError) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `No se pudo actualizar el estado de la sala ${this.salaId} tras ${MAX_REINTENTOS_TRANSACCION} intentos (alta contención)`
    );
  }

  async inicializar() {
    await esperarListo();
    const key = GameRoom.redisKey(this.salaId);
    const estadoInicial = { mapa: generarMapa(), jugadores: [], bombas: [], powerups: [] };

    const creado = await redisClient.set(key, JSON.stringify(estadoInicial), {
      EX: GAMEROOM_TTL_SEGUNDOS,
      NX: true
    });

    if (creado) return estadoInicial;
    return await this._leerEstado();
  }

  async agregarJugador(socketId, nombre, color) {
    await this.inicializar();

    let jugadorNuevo = null;
    await this._actualizarEstado((estado) => {
      const spawn = SPAWNS[estado.jugadores.length] || SPAWNS[0];
      jugadorNuevo = crearJugador(socketId, nombre, color, spawn);
      estado.jugadores.push(jugadorNuevo);
    });

    this.logger.info({ event: 'jugador_unido', salaId: this.salaId, nombre, socketId });
    return jugadorNuevo;
  }

  async moverJugador(socketId, direccion) {
    const inicio = Date.now();
    let jugadorMovido = null;

    const { estado } = await this._actualizarEstado((estadoActual) => {
      const jugador = estadoActual.jugadores.find((j) => j.id === socketId);
      if (!jugador || !jugador.vivo) return;

      // Cooldown por jugador (más corto con flash activo) en vez de uno
      // global: se guarda en el propio estado de Redis para que valga sin
      // importar a qué instancia EC2 esté conectado el socket.
      const velocidad = jugador.velocidad || VELOCIDAD_BASE_MS;
      if (inicio - (jugador.ultimoMovimiento || 0) < velocidad) return;
      jugador.ultimoMovimiento = inicio;

      jugadorMovido = procesarMovimiento(estadoActual, socketId, direccion);
    });

    if (jugadorMovido && estado) {
      const latencia = Date.now() - inicio;
      metrics.latenciaWebSocket.observe(latencia);
      this.io.to(this.salaId).emit('estado_juego', estado);
    }
  }

  async colocarBomba(socketId) {
    let bombaColocada = null;

    const { estado } = await this._actualizarEstado((estadoActual) => {
      bombaColocada = colocarBomba(estadoActual, socketId);
    });

    if (!bombaColocada || !estado) return;

    this.logger.info({ event: 'bomba_colocada', salaId: this.salaId, socketId, x: bombaColocada.x, y: bombaColocada.y });
    this.io.to(this.salaId).emit('estado_juego', estado);

    const timer = setTimeout(async () => {
      try {
        let resultado = null;
        const { estado: estadoTrasExplosion } = await this._actualizarEstado((estadoActual) => {
          resultado = explotarBomba(estadoActual, bombaColocada);
        });

        if (!estadoTrasExplosion) return;

        if (resultado.eliminados.length > 0) {
          metrics.jugadoresEliminados.inc(resultado.eliminados.length);
          this.logger.info({ event: 'bomba_explotada', salaId: this.salaId, eliminados: resultado.eliminados });
        }

        this.io.to(this.salaId).emit('explosion', {
          celdas: resultado.celdas,
          eliminados: resultado.eliminados,
          golpeados: resultado.golpeados
        });
        this.io.to(this.salaId).emit('estado_juego', estadoTrasExplosion);

        if (resultado.eliminados.length > 0) {
          const ganador = verificarGanador(estadoTrasExplosion);
          if (ganador) {
            const nombre = ganador === 'empate' ? 'empate' : ganador.nombre;
            metrics.partidasCompletadas.inc();
            this.logger.info({ event: 'partida_terminada', salaId: this.salaId, ganador: nombre });
            this.io.to(this.salaId).emit('fin_partida', { ganador: nombre });

            // Libera la sala para que vuelva a listarse en el lobby (si
            // quedan jugadores) sin esperar a que alguien pida 'pedir_salas'.
            await lobby.desmarcarEnPartida(this.salaId);
            await redisClient.publish(LobbyManager.CANAL_SALAS, '1');
          }
        }
      } catch (err) {
        this.logger.error({ event: 'explosion_error', salaId: this.salaId, error: err.message });
      } finally {
        this.timers.delete(bombaColocada.id);
      }
    }, bombaColocada.timer);

    this.timers.set(bombaColocada.id, timer);
  }

  async eliminarJugador(socketId) {
    let restantes = 0;

    const { estado } = await this._actualizarEstado((estadoActual) => {
      estadoActual.jugadores = estadoActual.jugadores.filter((j) => j.id !== socketId);
      restantes = estadoActual.jugadores.length;
    });

    this.logger.info({ event: 'jugador_salio', salaId: this.salaId, socketId });
    return estado ? restantes : 0;
  }

  async reiniciar(jugadoresSala) {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();

    const estado = {
      mapa: generarMapa(),
      bombas: [],
      powerups: [],
      jugadores: jugadoresSala.map((j, i) => {
        const spawn = SPAWNS[i] || SPAWNS[0];
        return crearJugador(j.id, j.nombre, j.color, spawn);
      })
    };

    await this._guardarEstado(estado);
    this.logger.info({ event: 'partida_reiniciada', salaId: this.salaId, jugadores: estado.jugadores.length });
    this.iniciarTimerPoderes();
    return estado;
  }

  async getEstado() {
    return await this._leerEstado();
  }

  // Recogida de power-up reportada por el cliente: se valida contra la
  // posición real del jugador en el estado autoritativo (no se confía en el
  // powerupId/posición que mande el socket) dentro de GameEngine.recogerPowerup.
  async recogerPowerup(socketId, powerupId) {
    let aplicado = null;

    const { estado } = await this._actualizarEstado((estadoActual) => {
      aplicado = recogerPowerup(estadoActual, socketId, powerupId);
    });

    if (!estado) return;

    if (aplicado) {
      this.logger.info({ event: 'powerup_recogido', salaId: this.salaId, socketId, tipo: aplicado.tipo });
      this.io.to(this.salaId).emit('powerup_aplicado', {
        jugadorId: socketId,
        tipo: aplicado.tipo,
        expira: aplicado.expira
      });
    }

    this.io.to(this.salaId).emit('estado_juego', estado);
  }

  // Salvavidas de los poderes con duración: sin este barrido periódico,
  // "flash"/"doublebomb"/"shield" quedarían activos para siempre si el
  // jugador no genera ningún otro evento (mover/bomba) después de expirar.
  iniciarTimerPoderes() {
    this.detenerTimerPoderes();
    this.timerPoderes = setInterval(async () => {
      try {
        let expirados = [];
        const { estado } = await this._actualizarEstado((estadoActual) => {
          expirados = revisarExpiracionPoderes(estadoActual);
        });

        if (!estado || expirados.length === 0) return;

        expirados.forEach((exp) => this.io.to(this.salaId).emit('powerup_expirado', exp));
        this.io.to(this.salaId).emit('estado_juego', estado);
      } catch (err) {
        this.logger.error({ event: 'poderes_timer_error', salaId: this.salaId, error: err.message });
      }
    }, PODERES_TIMER_INTERVALO_MS);
  }

  detenerTimerPoderes() {
    if (this.timerPoderes) {
      clearInterval(this.timerPoderes);
      this.timerPoderes = null;
    }
  }

  destruirLocal() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.detenerTimerPoderes();
  }
}

module.exports = GameRoom;