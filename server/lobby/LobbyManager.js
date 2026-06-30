class LobbyManager {
  constructor() {
    this.salas = new Map();
    this.contador = 1;
  }

  crearSala() {
    const salaId = `sala-${this.contador++}`;
    this.salas.set(salaId, { id: salaId, jugadores: [] });
    return salaId;
  }

  unirseASala(salaId, jugador) {
    const sala = this.salas.get(salaId);
    if (!sala) return { error: 'Sala no encontrada' };
    if (sala.jugadores.length >= 2) return { error: 'Sala llena' };
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
    return Array.from(this.salas.values())
      .filter(s => s.jugadores.length < 2)
      .map(s => ({ id: s.id, jugadores: s.jugadores.length }));
  }
  
  getSala(salaId) {
    return this.salas.get(salaId);
  }
}

module.exports = LobbyManager;