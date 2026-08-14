// Prueba de carga HTTP sobre las rutas "seguras" de golpear a lo bruto:
// /health y el estático del SPA (index.html servido desde Express).
// /metrics no se incluye en el loop de carga a propósito (es para que TÚ
// lo consultes durante la prueba, no para golpearlo desde cada VU).
//
// Deliberadamente NO incluye /auth/registro ni /auth/login:
//   - /auth/registro envía un correo real por Gmail (nodemailer) y crea filas
//     reales en Postgres — cargarlo dispararía spam real y puede hacer que
//     Google bloquee la cuenta de envío.
//   - /auth/login (y el resto de /auth) tienen rate limiting por IP
//     (5 intentos / 3 min). Un k6 corriendo desde una sola máquina golpea
//     todo desde la misma IP, así que se agotaría en segundos.
// Si quieres medir capacidad de login, mira loadtest/README.md (sección
// "Auth / login") para el setup con cuentas de prueba pre-verificadas.
//
// Uso:
//   k6 run loadtest/http-smoke.js
//   k6 run -e BASE_URL=http://mi-servidor:4517 -e MAX_VUS=200 loadtest/http-smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4517';
const MAX_VUS = Number(__ENV.MAX_VUS) || 200;
const STAGE_STEP = __ENV.STAGE_STEP || '20s';
const STAGE_HOLD = __ENV.STAGE_HOLD || '40s';

const errorRate = new Rate('http_errors');

export const options = {
  scenarios: {
    http_smoke: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: STAGE_STEP, target: Math.round(MAX_VUS * 0.25) },
        { duration: STAGE_HOLD, target: Math.round(MAX_VUS * 0.25) },
        { duration: STAGE_STEP, target: MAX_VUS },
        { duration: STAGE_HOLD, target: MAX_VUS },
        { duration: STAGE_STEP, target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_errors: ['rate<0.01'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  errorRate.add(health.status !== 200);
  check(health, { 'health 200': (r) => r.status === 200 });

  const home = http.get(`${BASE_URL}/`);
  errorRate.add(home.status !== 200);
  check(home, { 'spa index 200': (r) => r.status === 200 });

  sleep(Math.random() * 1.5 + 0.5);
}
