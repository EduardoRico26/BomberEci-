// Mockea Redis y PostgreSQL ANTES de requerir '../../index' (que arrastra
// LobbyManager, GameRoom y authRoutes/authService, todos con conexiones
// reales a esos servicios) para que la suite corra en CI sin necesitar
// ninguna base de datos real.

jest.mock('redis', () => {
  function crearClienteFalso() {
    const cliente = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([]),
      publish: jest.fn().mockResolvedValue(0),
      subscribe: jest.fn().mockResolvedValue(undefined),
      watch: jest.fn().mockResolvedValue(undefined),
      unwatch: jest.fn().mockResolvedValue(undefined),
      multi: jest.fn(() => ({
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      })),
      executeIsolated: jest.fn((fn) => fn(cliente)),
      duplicate: jest.fn(() => crearClienteFalso())
    };
    return cliente;
  }

  return { createClient: jest.fn(() => crearClienteFalso()) };
});

jest.mock('@socket.io/redis-adapter', () => {
  // Socket.io instancia el adapter con "new" y espera la interfaz completa
  // (init, close, etc.) — en vez de reimplementarla a mano, se extiende el
  // adapter en memoria real que trae socket.io-adapter (el mismo que usa
  // Socket.io por defecto cuando no se configura ninguno).
  const { Adapter } = require('socket.io-adapter');
  class AdapterFalso extends Adapter {}
  return { createAdapter: jest.fn(() => AdapterFalso) };
});

// authService usa esto para todo (login, registro, recuperación); con esto
// mockeado ninguna prueba toca PostgreSQL de verdad.
jest.mock('../../db/usuariosDB', () => ({
  buscarPorCorreo: jest.fn().mockResolvedValue(null),
  crearUsuario: jest.fn(),
  buscarPorId: jest.fn(),
  verificarCorreo: jest.fn(),
  registrarIntentoFallido: jest.fn(),
  resetearIntentos: jest.fn(),
  guardarTokenRecuperacion: jest.fn(),
  buscarPorTokenRecuperacion: jest.fn(),
  actualizarPassword: jest.fn(),
  actualizarTokenVerificacion: jest.fn()
}));

const request = require('supertest');
const { app } = require('../../index');

describe('GET /health', () => {
  test('responde 200 con status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

describe('POST /auth/registro', () => {
  test('con datos inválidos (incompletos) responde 400', async () => {
    const res = await request(app)
      .post('/auth/registro')
      .send({ nombre: 'Solo el nombre, sin correo ni password' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  test('con credenciales incorrectas responde 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ correo: 'noexiste@bombereci.test', password: 'cualquierClave123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /metrics', () => {
  test('responde 200 con content-type text/plain', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });
});
