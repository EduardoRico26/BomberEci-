const MAX_JUGADORES = 4;

class LobbyManager {
  constructor() {
    this.salas = new Map();
  }

  crearSala(nombre) {
    const nombreLimpio = nombre.trim().toUpperCase().replace(/\s+/g, '-');
    if (this.salas.has(nombreLimpio)) {
      return { error: 'Ya existe una sala con ese nombre.' };
    }
    this.salas.set(nombreLimpio, { id: nombreLimpio, jugadores: [] });
    return { ok: true, salaId: nombreLimpio };
  }

  unirseASala(salaId, jugador) {
    const sala = this.salas.get(salaId);
    if (!sala) return { error: 'Sala no encontrada.' };
    if (sala.jugadores.length >= MAX_JUGADORES) return { error: 'Sala llena.' };
    if (sala.jugadores.some(j => j.color === jugador.color)) {
      return { error: 'Ese color ya está tomado en esta sala.' };
    }
    sala.jugadores.push(jugador);
    return { ok: true, sala };
  }

  eliminarJugador(socketId) {
    for (const [salaId, sala] of this.salas.entries()) {
      const index = sala.jugadores.findIndex(j => j.id === socketId);
      if (index !== -1) {
        sala.jugadores.splice(index, 1);
        if (sala.jugadores.length === 0) this.salas.delete(salaId);
        return salaId;
      }
    }
    return null;
  }

  getSalasDisponibles() {
    // Incluye también salas llenas: el cliente que ya está dentro de una sala
    // (esperando a que el dueño inicie la partida) necesita seguir viendo su
    // contador aunque llegue a 4/4. La tabla pública de "unirse" filtra las
    // llenas del lado del cliente.
    return Array.from(this.salas.values())
      .map(s => ({
        id: s.id,
        jugadores: s.jugadores.length,
        coloresTomados: s.jugadores.map(j => j.color)
      }));
  }

  getSala(salaId) {
    return this.salas.get(salaId);
  }
}

module.exports = LobbyManager;
module.exports.MAX_JUGADORES = MAX_JUGADORES;