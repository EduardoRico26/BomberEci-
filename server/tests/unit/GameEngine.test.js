const { generarMapa, procesarMovimiento, verificarGanador } = require('../../game/GameEngine');

describe('generarMapa', () => {
  test('el mapa tiene 13 filas y 15 columnas', () => {
    const mapa = generarMapa();
    expect(mapa).toHaveLength(13);
    mapa.forEach((fila) => expect(fila).toHaveLength(15));
  });

  test('los bordes son siempre indestructibles (2)', () => {
    const mapa = generarMapa();
    const ULTIMA_FILA = mapa.length - 1;
    const ULTIMA_COLUMNA = mapa[0].length - 1;

    for (let x = 0; x <= ULTIMA_COLUMNA; x++) {
      expect(mapa[0][x]).toBe(2);
      expect(mapa[ULTIMA_FILA][x]).toBe(2);
    }
    for (let y = 0; y <= ULTIMA_FILA; y++) {
      expect(mapa[y][0]).toBe(2);
      expect(mapa[y][ULTIMA_COLUMNA]).toBe(2);
    }
  });

  test('las esquinas de spawn siempre están libres (0)', () => {
    const mapa = generarMapa();
    const esquinasSpawn = [
      [1, 1], [2, 1], [1, 2],
      [13, 1], [12, 1], [13, 2],
      [1, 11], [2, 11], [1, 10],
      [13, 11], [12, 11], [13, 10]
    ];

    esquinasSpawn.forEach(([x, y]) => {
      expect(mapa[y][x]).toBe(0);
    });
  });
});

describe('procesarMovimiento', () => {
  function crearEstado(mapa, jugador) {
    return { mapa, jugadores: [jugador], bombas: [] };
  }

  test('el jugador se mueve a una celda libre y retorna su nueva posición', () => {
    const mapa = [
      [2, 2, 2, 2],
      [2, 0, 0, 2],
      [2, 2, 2, 2]
    ];
    const jugador = { id: 'p1', x: 1, y: 1, vivo: true };
    const estado = crearEstado(mapa, jugador);

    const resultado = procesarMovimiento(estado, 'p1', 'right');

    expect(resultado).not.toBeNull();
    expect(resultado.x).toBe(2);
    expect(resultado.y).toBe(1);
  });

  test('el jugador no puede moverse a un bloque indestructible', () => {
    const mapa = [
      [2, 2, 2, 2],
      [2, 0, 2, 2],
      [2, 2, 2, 2]
    ];
    const jugador = { id: 'p1', x: 1, y: 1, vivo: true };
    const estado = crearEstado(mapa, jugador);

    const resultado = procesarMovimiento(estado, 'p1', 'right');

    expect(resultado).toBeNull();
    expect(jugador.x).toBe(1);
    expect(jugador.y).toBe(1);
  });

  test('el jugador no puede moverse a un bloque destructible', () => {
    const mapa = [
      [2, 2, 2, 2],
      [2, 0, 1, 2],
      [2, 2, 2, 2]
    ];
    const jugador = { id: 'p1', x: 1, y: 1, vivo: true };
    const estado = crearEstado(mapa, jugador);

    const resultado = procesarMovimiento(estado, 'p1', 'right');

    expect(resultado).toBeNull();
  });

  test('el jugador no puede moverse fuera del mapa', () => {
    const mapa = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    const jugador = { id: 'p1', x: 0, y: 1, vivo: true };
    const estado = crearEstado(mapa, jugador);

    const resultado = procesarMovimiento(estado, 'p1', 'left');

    expect(resultado).toBeNull();
  });
});

describe('verificarGanador', () => {
  test('con 2 jugadores vivos retorna null (la partida continúa)', () => {
    const estado = {
      jugadores: [
        { id: 'p1', vivo: true, vidas: 1 },
        { id: 'p2', vivo: true, vidas: 1 }
      ]
    };

    expect(verificarGanador(estado)).toBeNull();
  });

  test('con 1 jugador vivo retorna ese jugador como ganador', () => {
    const ganador = { id: 'p1', vivo: true, vidas: 1 };
    const estado = {
      jugadores: [
        ganador,
        { id: 'p2', vivo: false, vidas: 0 }
      ]
    };

    expect(verificarGanador(estado)).toBe(ganador);
  });

  test('con 0 jugadores vivos retorna "empate"', () => {
    const estado = {
      jugadores: [
        { id: 'p1', vivo: false, vidas: 0 },
        { id: 'p2', vivo: false, vidas: 0 }
      ]
    };

    expect(verificarGanador(estado)).toBe('empate');
  });
});
