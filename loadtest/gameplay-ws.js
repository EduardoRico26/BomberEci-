// Prueba de carga del gameplay en tiempo real (Socket.IO sobre WebSocket).
//
// BomberEci- usa Socket.IO 4 (protocolo Engine.IO v4), que k6 no habla de
// forma nativa: aquí se arma/parsea el framing a mano sobre k6/ws en vez de
// depender de una extensión (xk6-*) que exigiría compilar un binario propio.
//
// Cada VU simula UNA sesión de jugador real: conecta, entra a una sala
// (creándola o uniéndose), inicia la partida en cuanto hay 2 jugadores,
// y manda 'mover'/'bomba' a intervalos realistas mientras escucha
// 'estado_juego' para medir cuánto tarda el servidor en confirmar cada acción.
//
// Los VUs se emparejan por índice: VU impar = crea sala, VU par = se une.
// Esto evita depender de 'lista_salas' para descubrir salas ajenas.
//
// Uso:
//   k6 run loadtest/gameplay-ws.js
//   k6 run -e WS_URL=ws://mi-servidor:4517/socket.io/?EIO=4&transport=websocket loadtest/gameplay-ws.js
//
// Variables de entorno (todas opcionales, ver README.md para el detalle):
//   WS_URL, MOVE_INTERVAL_MS, BOMB_PROBABILITY, ROOM_WAIT_MS,
//   SESSION_TIMEOUT_MS, MAX_VUS, STAGE_STEP, STAGE_HOLD

import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Configuración ──────────────────────────────────────────────────
const WS_URL = __ENV.WS_URL || 'ws://localhost:4517/socket.io/?EIO=4&transport=websocket';
const MOVE_INTERVAL_MS = Number(__ENV.MOVE_INTERVAL_MS) || 220; // cooldown real del server: 180ms
const BOMB_PROBABILITY = Number(__ENV.BOMB_PROBABILITY) || 0.08;
const ROOM_WAIT_MS = Number(__ENV.ROOM_WAIT_MS) || 15000; // el creador se rinde si nadie se une
const SESSION_TIMEOUT_MS = Number(__ENV.SESSION_TIMEOUT_MS) || 60000; // duración máx. de una sesión
const JOIN_RETRY_MS = 700;
const JOIN_MAX_RETRIES = 10;

const MAX_VUS = Number(__ENV.MAX_VUS) || 120;
const STAGE_STEP = __ENV.STAGE_STEP || '30s';
const STAGE_HOLD = __ENV.STAGE_HOLD || '1m';

const COLOR_CREADOR = 'azul';
const COLOR_INVITADO = 'verde';
const DIRECCIONES = ['up', 'down', 'left', 'right'];

// ── Métricas personalizadas ──────────────────────────────────────────
const handshakeTime = new Trend('sio_handshake_ms'); // tiempo hasta el ACK "40" de Socket.IO
const roomJoinErrors = new Rate('room_join_error_rate');
const gamesStarted = new Counter('games_started');
const gamesFinished = new Counter('games_finished');
// tiempo entre cada 'mover' enviado y el siguiente 'estado_juego' recibido:
// mide la latencia de extremo a extremo del loop de juego bajo carga.
const estadoJuegoLatency = new Trend('estado_juego_broadcast_ms');
const movesSent = new Counter('moves_sent');
const unexpectedErrors = new Counter('unexpected_ws_errors');

export const options = {
  scenarios: {
    gameplay: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: STAGE_STEP, target: Math.round(MAX_VUS * 0.15) },
        { duration: STAGE_HOLD, target: Math.round(MAX_VUS * 0.15) },
        { duration: STAGE_STEP, target: Math.round(MAX_VUS * 0.5) },
        { duration: STAGE_HOLD, target: Math.round(MAX_VUS * 0.5) },
        { duration: STAGE_STEP, target: MAX_VUS },
        { duration: STAGE_HOLD, target: MAX_VUS },
        { duration: STAGE_STEP, target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ws_connecting: ['p(95)<1000'],
    room_join_error_rate: ['rate<0.05'],
    estado_juego_broadcast_ms: ['p(95)<1500'],
  },
};

function eventFrame(event, data) {
  return '42' + JSON.stringify([event, data]);
}

function parseEventFrame(msg) {
  if (typeof msg !== 'string' || !msg.startsWith('42')) return null;
  try {
    const arr = JSON.parse(msg.slice(2));
    return { event: arr[0], data: arr[1] };
  } catch (e) {
    return null;
  }
}

export default function () {
  const pairIndex = Math.floor((__VU - 1) / 2);
  const isCreator = (__VU - 1) % 2 === 0;
  // __ITER en el nombre evita colisiones "Ya existe una sala con ese
  // nombre" si el mismo VU vuelve a iterar durante una prueba larga.
  const roomName = `CARGA-${pairIndex}-${__ITER}`;
  const nombre = `Bot${__VU}-${__ITER}`;

  let connectedAt = 0;
  let joined = false;
  let joinAttempts = 0;
  let gameStarted = false;
  let lastActionAt = 0;
  let moveTimer = null;
  let sessionClosed = false;

  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on('open', function () {
      connectedAt = Date.now();
    });

    socket.on('message', function (msg) {
      // Engine.IO v4: el ping lo manda el servidor, el cliente responde pong.
      if (msg === '2') {
        socket.send('3');
        return;
      }
      // Paquete OPEN de Engine.IO -> abrir namespace por defecto de Socket.IO.
      if (msg[0] === '0') {
        socket.send('40');
        return;
      }
      // ACK de conexión de Socket.IO -> ya se puede jugar.
      if (msg.startsWith('40')) {
        handshakeTime.add(Date.now() - connectedAt);
        if (isCreator) {
          socket.send(eventFrame('crear_sala', { nombre, nombreSala: roomName, color: COLOR_CREADOR }));
          socket.setTimeout(function () {
            if (!gameStarted && !sessionClosed) socket.close();
          }, ROOM_WAIT_MS);
        } else {
          socket.setTimeout(function () {
            socket.send(eventFrame('unirse_sala', { salaId: roomName, nombre, color: COLOR_INVITADO }));
          }, 800);
        }
        return;
      }

      const evt = parseEventFrame(msg);
      if (!evt) return;

      switch (evt.event) {
        case 'error_sala':
          if (!joined && !isCreator && joinAttempts < JOIN_MAX_RETRIES) {
            joinAttempts++;
            roomJoinErrors.add(1);
            socket.setTimeout(function () {
              socket.send(eventFrame('unirse_sala', { salaId: roomName, nombre, color: COLOR_INVITADO }));
            }, JOIN_RETRY_MS);
          } else {
            roomJoinErrors.add(1);
          }
          break;

        case 'sala_creada':
          joined = true;
          roomJoinErrors.add(0);
          break;

        case 'jugadores_sala':
          if (!joined) {
            joined = true;
            roomJoinErrors.add(0);
          }
          if (isCreator && !gameStarted && Array.isArray(evt.data) && evt.data.length >= 2) {
            socket.send(eventFrame('iniciar_partida_manual', {}));
          }
          break;

        case 'iniciar_partida':
          gameStarted = true;
          gamesStarted.add(1);
          lastActionAt = Date.now();
          moveTimer = socket.setInterval(function () {
            lastActionAt = Date.now();
            socket.send(eventFrame('mover', { direccion: DIRECCIONES[Math.floor(Math.random() * DIRECCIONES.length)] }));
            movesSent.add(1);
            if (Math.random() < BOMB_PROBABILITY) {
              socket.send(eventFrame('bomba', {}));
            }
          }, MOVE_INTERVAL_MS);
          break;

        case 'estado_juego':
          if (gameStarted && lastActionAt > 0) {
            estadoJuegoLatency.add(Date.now() - lastActionAt);
          }
          break;

        case 'fin_partida':
          gamesFinished.add(1);
          if (moveTimer) socket.clearInterval(moveTimer);
          socket.close();
          break;

        default:
          break;
      }
    });

    socket.on('close', function () {
      sessionClosed = true;
    });

    socket.on('error', function () {
      unexpectedErrors.add(1);
    });

    socket.setTimeout(function () {
      if (!sessionClosed) socket.close();
    }, SESSION_TIMEOUT_MS);
  });

  check(res, { 'handshake websocket 101': (r) => r && r.status === 101 });
}
