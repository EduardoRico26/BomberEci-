const { generarMapa, procesarMovimiento, colocarBomba, explotarBomba, verificarGanador } = require('./GameEngine');
const metrics = require('../metrics');

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
    this.estado = {
      mapa: generarMapa(),
      jugadores: [],
      bombas: []
    };
    this.timers = new Map();
  }

  agregarJugador(socketId, nombre, color) {
    const spawn = SPAWNS[this.estado.jugadores.length] || SPAWNS[0];
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
    this.estado.jugadores.push(jugador);
    this.logger.info({ event: 'jugador_unido', salaId: this.salaId, nombre, socketId });
    return jugador;
  }

  moverJugador(socketId, direccion) {
    const inicio = Date.now();
    const jugador = procesarMovimiento(this.estado, socketId, direccion);
    if (jugador) {
      const latencia = Date.now() - inicio;
      metrics.latenciaWebSocket.observe(latencia);
      this.io.to(this.salaId).emit('estado_juego', this.estado);
    }
  }

  colocarBomba(socketId) {
    const bomba = colocarBomba(this.estado, socketId);
    if (!bomba) return;

    this.logger.info({ event: 'bomba_colocada', salaId: this.salaId, socketId, x: bomba.x, y: bomba.y });
    this.io.to(this.salaId).emit('estado_juego', this.estado);

    const timer = setTimeout(() => {
      const resultado = explotarBomba(this.estado, bomba);

      // Registrar jugadores eliminados
      if (resultado.eliminados.length > 0) {
        metrics.jugadoresEliminados.inc(resultado.eliminados.length);
        this.logger.info({ event: 'bomba_explotada', salaId: this.salaId, eliminados: resultado.eliminados });
      }

      this.io.to(this.salaId).emit('explosion', { celdas: resultado.celdas, eliminados: resultado.eliminados });
      this.io.to(this.salaId).emit('estado_juego', this.estado);

      if (resultado.eliminados.length > 0) {
        const ganador = verificarGanador(this.estado);
        if (ganador) {
          const nombre = ganador === 'empate' ? 'empate' : ganador.nombre;
          metrics.partidasCompletadas.inc();
          this.logger.info({ event: 'partida_terminada', salaId: this.salaId, ganador: nombre });
          this.io.to(this.salaId).emit('fin_partida', { ganador: nombre });
        }
      }
      this.timers.delete(bomba.id);
    }, bomba.timer);

    this.timers.set(bomba.id, timer);
  }

  eliminarJugador(socketId) {
    this.estado.jugadores = this.estado.jugadores.filter(j => j.id !== socketId);
    this.logger.info({ event: 'jugador_salio', salaId: this.salaId, socketId });
  }

  reiniciar(jugadoresSala) {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    this.estado.mapa = generarMapa();
    this.estado.bombas = [];
    this.estado.jugadores = jugadoresSala.map((j, i) => {
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
    });
    this.logger.info({ event: 'partida_reiniciada', salaId: this.salaId, jugadores: this.estado.jugadores.length });
  }

  getEstado() {
    return this.estado;
  }
}

module.exports = GameRoom;