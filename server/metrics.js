const client = require('prom-client');

// Registro por defecto con métricas del sistema (CPU, memoria, etc.)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ── MÉTRICAS TÉCNICAS ──────────────────────────────────

const jugadoresConectados = new client.Gauge({
  name: 'bombereci_jugadores_conectados',
  help: 'Número de jugadores conectados en tiempo real',
  registers: [register]
});

const salasActivas = new client.Gauge({
  name: 'bombereci_salas_activas',
  help: 'Número de salas activas actualmente',
  registers: [register]
});

const latenciaWebSocket = new client.Histogram({
  name: 'bombereci_latencia_websocket_ms',
  help: 'Latencia de procesamiento de eventos WebSocket en ms',
  buckets: [5, 10, 25, 50, 100, 200, 500],
  registers: [register]
});

// ── MÉTRICAS DE NEGOCIO (KPIs) ─────────────────────────

const partidasIniciadas = new client.Counter({
  name: 'bombereci_partidas_iniciadas_total',
  help: 'Total de partidas iniciadas',
  registers: [register]
});

const partidasCompletadas = new client.Counter({
  name: 'bombereci_partidas_completadas_total',
  help: 'Total de partidas completadas con ganador',
  registers: [register]
});

const jugadoresRegistrados = new client.Counter({
  name: 'bombereci_jugadores_registrados_total',
  help: 'Total de jugadores registrados en el sistema',
  registers: [register]
});

const bombasColocadas = new client.Counter({
  name: 'bombereci_bombas_colocadas_total',
  help: 'Total de bombas colocadas en todas las partidas',
  registers: [register]
});

const jugadoresEliminados = new client.Counter({
  name: 'bombereci_jugadores_eliminados_total',
  help: 'Total de jugadores eliminados por explosiones',
  registers: [register]
});

const salaCreada = new client.Counter({
  name: 'bombereci_salas_creadas_total',
  help: 'Total de salas creadas',
  registers: [register]
});

module.exports = {
  register,
  jugadoresConectados,
  salasActivas,
  latenciaWebSocket,
  partidasIniciadas,
  partidasCompletadas,
  jugadoresRegistrados,
  bombasColocadas,
  jugadoresEliminados,
  salaCreada
};