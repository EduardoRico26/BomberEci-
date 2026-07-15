const { createLogger, format, transports } = require('winston');
require('dotenv').config();

const transportes = [
  new transports.Console()
];

// Agregar Loki solo si está configurado
if (process.env.LOKI_URL) {
  const LokiTransport = require('winston-loki');
  transportes.push(
    new LokiTransport({
      host: process.env.LOKI_URL,
      labels: { app: 'bombereci-arena' },
      json: true,
      format: format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => console.error('Loki connection error:', err)
    })
  );
}

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: transportes
});

module.exports = logger;