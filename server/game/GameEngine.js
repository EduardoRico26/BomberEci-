const MAPA_ANCHO = 15;
const MAPA_ALTO = 13;

const DURACION_PODER_MS = 15000;
const VIDAS_MAXIMAS = 3;

// 65% de probabilidad de dropear algo al destruir un bloque; si dropea, la
// distribución entre tipos es 30/30/30/10. El orden importa: se acumula el
// peso y se compara contra un solo Math.random() para no hacer 2 tiradas.
const PESOS_POWERUP = [
  ['flash', 0.30],
  ['doublebomb', 0.30],
  ['shield', 0.30],
  ['extra', 0.10]
];
const PROBABILIDAD_DROP = 0.65;

function generarPowerupAleatorio() {
  if (Math.random() >= PROBABILIDAD_DROP) return null;
  const r = Math.random();
  let acumulado = 0;
  for (const [tipo, peso] of PESOS_POWERUP) {
    acumulado += peso;
    if (r < acumulado) return tipo;
  }
  return PESOS_POWERUP[PESOS_POWERUP.length - 1][0]; // margen por redondeo flotante
}

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
        const tipoPowerup = generarPowerupAleatorio();
        if (tipoPowerup) {
          if (!estado.powerups) estado.powerups = [];
          estado.powerups.push({ id: `${Date.now()}_${nx}_${ny}`, tipo: tipoPowerup, x: nx, y: ny });
        }
        break;
      }
      celdas.push({ x: nx, y: ny });
    }
  }

  // A diferencia de antes (cualquier golpe = eliminado), ahora un jugador en
  // el radio puede sobrevivir: el escudo absorbe el golpe por completo, y las
  // vidas extra lo restan de a una sin sacarlo de su posición actual. Solo se
  // elimina de verdad cuando llega a 0 vidas.
  const eliminados = [];
  const golpeados = [];
  for (const jugador of estado.jugadores) {
    if (!jugador.vivo) continue;
    if (!celdas.some(c => c.x === jugador.x && c.y === jugador.y)) continue;

    if (jugador.shield) {
      jugador.shield = false;
      jugador.shieldExpira = null;
      golpeados.push({ id: jugador.id, tipo: 'escudo' });
      continue;
    }

    jugador.vidas -= 1;
    if (jugador.vidas <= 0) {
      jugador.vidas = 0;
      jugador.vivo = false;
      eliminados.push(jugador.id);
    } else {
      golpeados.push({ id: jugador.id, tipo: 'vida', vidasRestantes: jugador.vidas });
    }
  }

  return { celdas, eliminados, golpeados };
}

function verificarGanador(estado) {
  const vivos = estado.jugadores.filter(j => j.vivo && j.vidas > 0);
  if (vivos.length === 1) return vivos[0];
  if (vivos.length === 0) return 'empate';
  return null;
}

// Se ejecuta cuando el cliente reporta que su jugador pisó un power-up.
// Valida contra el estado autoritativo (posición real del jugador) antes de
// aplicar nada, para no confiar ciegamente en lo que dice el cliente.
// Si el jugador ya tiene ese poder activo (o ya está en el máximo de vidas),
// la recogida se ignora por completo: el power-up permanece en el mapa para
// poder recogerlo después, en vez de desperdiciarse sin efecto.
function recogerPowerup(estado, socketId, powerupId) {
  const jugador = estado.jugadores.find(j => j.id === socketId);
  if (!jugador || !jugador.vivo) return null;

  const powerup = (estado.powerups || []).find(p => p.id === powerupId);
  if (!powerup) return null;
  if (powerup.x !== jugador.x || powerup.y !== jugador.y) return null;

  let aplicado = null;

  if (powerup.tipo === 'doublebomb' && !jugador.doublebomb) {
    jugador.doublebomb = true;
    jugador.doublebombExpira = Date.now() + DURACION_PODER_MS;
    jugador.maxBombas = 2;
    aplicado = { tipo: 'doublebomb', expira: jugador.doublebombExpira };
  } else if (powerup.tipo === 'flash' && !jugador.flash) {
    jugador.flash = true;
    jugador.flashExpira = Date.now() + DURACION_PODER_MS;
    jugador.velocidad = 90;
    aplicado = { tipo: 'flash', expira: jugador.flashExpira };
  } else if (powerup.tipo === 'shield' && !jugador.shield) {
    jugador.shield = true;
    jugador.shieldExpira = Date.now() + DURACION_PODER_MS;
    aplicado = { tipo: 'shield', expira: jugador.shieldExpira };
  } else if (powerup.tipo === 'extra' && jugador.vidas < VIDAS_MAXIMAS) {
    jugador.vidas += 1;
    aplicado = { tipo: 'extra', expira: null };
  }

  if (!aplicado) return null;

  estado.powerups = estado.powerups.filter(p => p.id !== powerupId);
  return aplicado;
}

// Corre cada segundo desde GameRoom sobre el estado guardado en Redis:
// revierte el efecto de cualquier poder cuyo tiempo ya se cumplió y devuelve
// la lista de expiraciones para que el servidor avise a los clientes.
function revisarExpiracionPoderes(estado) {
  const ahora = Date.now();
  const expirados = [];

  for (const jugador of estado.jugadores) {
    if (!jugador.vivo) continue;

    if (jugador.doublebomb && jugador.doublebombExpira && ahora >= jugador.doublebombExpira) {
      jugador.doublebomb = false;
      jugador.doublebombExpira = null;
      jugador.maxBombas = 1;
      expirados.push({ jugadorId: jugador.id, tipo: 'doublebomb' });
    }
    if (jugador.flash && jugador.flashExpira && ahora >= jugador.flashExpira) {
      jugador.flash = false;
      jugador.flashExpira = null;
      jugador.velocidad = 180;
      expirados.push({ jugadorId: jugador.id, tipo: 'flash' });
    }
    if (jugador.shield && jugador.shieldExpira && ahora >= jugador.shieldExpira) {
      jugador.shield = false;
      jugador.shieldExpira = null;
      expirados.push({ jugadorId: jugador.id, tipo: 'shield' });
    }
  }

  return expirados;
}

module.exports = {
  generarMapa,
  procesarMovimiento,
  colocarBomba,
  explotarBomba,
  verificarGanador,
  recogerPowerup,
  revisarExpiracionPoderes
};