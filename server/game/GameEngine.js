const MAPA_ANCHO = 15;
const MAPA_ALTO = 13;

function generarMapa() {
  const mapa = [];
  for (let y = 0; y < MAPA_ALTO; y++) {
    const fila = [];
    for (let x = 0; x < MAPA_ANCHO; x++) {
      if (x === 0 || x === MAPA_ANCHO - 1 || y === 0 || y === MAPA_ALTO - 1) {
        fila.push(2); // bloque indestructible borde
      } else if (x % 2 === 0 && y % 2 === 0) {
        fila.push(2); // bloque indestructible interior
      } else if (
        (x <= 2 && y <= 2) || (x >= MAPA_ANCHO - 3 && y >= MAPA_ALTO - 3) ||
        (x <= 2 && y >= MAPA_ALTO - 3) || (x >= MAPA_ANCHO - 3 && y <= 2)
      ) {
        fila.push(0); // zona libre para spawn
      } else {
        fila.push(Math.random() < 0.6 ? 1 : 0); // bloque destructible o libre
      }
    }
    mapa.push(fila);
  }
  return mapa;
}

function procesarMovimiento(estado, socketId, direccion) {
  const jugador = estado.jugadores.find(j => j.id === socketId);
  if (!jugador || !jugador.vivo) return null;

  const deltas = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  const [dx, dy] = deltas[direccion] || [0, 0];
  const nx = jugador.x + dx;
  const ny = jugador.y + dy;

  if (nx < 0 || ny < 0 || ny >= estado.mapa.length || nx >= estado.mapa[0].length) return null;
  if (estado.mapa[ny][nx] !== 0) return null;
  if (estado.bombas.some(b => b.x === nx && b.y === ny)) return null;

  jugador.x = nx;
  jugador.y = ny;
  return jugador;
}

function colocarBomba(estado, socketId) {
  const jugador = estado.jugadores.find(j => j.id === socketId);
  if (!jugador || !jugador.vivo) return null;

  const bombasJugador = estado.bombas.filter(b => b.propietario === socketId);
  if (bombasJugador.length >= jugador.maxBombas) return null;

  const bomba = {
    id: Date.now(),
    x: jugador.x,
    y: jugador.y,
    radio: jugador.radio,
    propietario: socketId,
    timer: 3000
  };
  estado.bombas.push(bomba);
  return bomba;
}

function explotarBomba(estado, bomba) {
  estado.bombas = estado.bombas.filter(b => b.id !== bomba.id);
  const celdas = [{ x: bomba.x, y: bomba.y }];
  const direcciones = [[0,-1],[0,1],[-1,0],[1,0]];

  for (const [dx, dy] of direcciones) {
    for (let i = 1; i <= bomba.radio; i++) {
      const nx = bomba.x + dx * i;
      const ny = bomba.y + dy * i;
      if (ny < 0 || nx < 0 || ny >= estado.mapa.length || nx >= estado.mapa[0].length) break;
      if (estado.mapa[ny][nx] === 2) break;
      if (estado.mapa[ny][nx] === 1) {
        estado.mapa[ny][nx] = 0;
        celdas.push({ x: nx, y: ny });
        break;
      }
      celdas.push({ x: nx, y: ny });
    }
  }

  const eliminados = [];
  for (const jugador of estado.jugadores) {
    if (!jugador.vivo) continue;
    if (celdas.some(c => c.x === jugador.x && c.y === jugador.y)) {
      jugador.vivo = false;
      eliminados.push(jugador.id);
    }
  }

  return { celdas, eliminados };
}

function verificarGanador(estado) {
  const vivos = estado.jugadores.filter(j => j.vivo);
  if (vivos.length === 1) return vivos[0];
  if (vivos.length === 0) return 'empate';
  return null;
}

module.exports = { generarMapa, procesarMovimiento, colocarBomba, explotarBomba, verificarGanador };