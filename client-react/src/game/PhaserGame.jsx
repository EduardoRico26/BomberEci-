import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { colorPorId, COLORES_JUGADOR } from './coloresJugador';

const TILE = 56;

// Cada dirección de personaje vive en un PNG suelto (no un spritesheet):
// archivo "<color><fila>.<paso>.png", fila 1 = abajo, 2 = arriba, 3 = derecha,
// 4 = izquierda; paso 1/2 son los dos frames del ciclo de caminar.
const FILA_DIRECCION = { abajo: 1, arriba: 2, derecha: 3, izquierda: 4 };

// Espacio reservado alrededor del tablero (header, footer, paneles laterales
// y márgenes de respiro) para calcular cuánto se puede escalar el tablero sin
// que se salga de la pantalla. Son estimaciones deliberadamente generosas:
// mejor un tablero un poco más chico que uno recortado.
const RESERVA_HEADER          = 64;
const RESERVA_FOOTER          = 56;
const RESERVA_PANEL_IZQUIERDO = 190; // tarjetas de jugadores
const RESERVA_PANEL_DERECHO   = 190; // tarjetas de jugadores + botón "abandonar" debajo
const MARGEN                  = 18;
const ESCALA_MINIMA           = 0.4;

// El tablero de Phaser se renderiza siempre a su resolución nativa (ANCHO x
// ALTO en píxeles reales); esta función solo calcula cuánto hay que
// encogerlo visualmente (vía CSS transform) para que quepa completo en la
// pantalla actual, sin importar el tamaño de monitor o ventana.
function calcularEscala(ancho, alto) {
  if (typeof window === 'undefined') return 1;
  const anchoDisponible = window.innerWidth
    - RESERVA_PANEL_IZQUIERDO - RESERVA_PANEL_DERECHO - MARGEN * 2;
  const altoDisponible  = window.innerHeight - RESERVA_HEADER - RESERVA_FOOTER - MARGEN;
  const factor = Math.min(anchoDisponible / ancho, altoDisponible / alto, 1);
  return Math.max(factor, ESCALA_MINIMA);
}

function segundosRestantes(expiraEn, ahora) {
  if (!expiraEn) return 0;
  return Math.max(0, Math.ceil((expiraEn - ahora) / 1000));
}

// Tarjeta de jugador del panel lateral izquierdo: vidas + los 3 poderes con
// duración, cada uno con su contador en segundos (parpadea en rojo mientras
// está activo). Vive fuera del canvas de Phaser porque es DOM normal — el
// juego no necesita re-renderizarse para que este contador baje.
function TarjetaJugador({ jugador, esMio, ahora }) {
  const poderes = [
    { icono: '/game/fx/doublebomb.png', alt: 'Doble bomba', activo: jugador.doublebomb, segundos: segundosRestantes(jugador.doublebombExpira, ahora) },
    { icono: '/game/fx/flash.png',      alt: 'Velocidad',   activo: jugador.flash,      segundos: segundosRestantes(jugador.flashExpira, ahora) },
    { icono: '/game/fx/shield.png',     alt: 'Escudo',      activo: jugador.shield,     segundos: segundosRestantes(jugador.shieldExpira, ahora) }
  ];

  return (
    <div style={{
      background: 'rgba(10,16,22,0.9)',
      border: `1px solid ${esMio ? '#FF4655' : 'rgba(255,70,85,0.3)'}`,
      clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
      padding: '10px 12px',
      boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: '7px',
      width: '156px',
      height: '190px',
      flexShrink: 0,
      opacity: jugador.vivo ? 1 : 0.4,
      transition: 'opacity 0.3s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src={`/sprites/jugador-${jugador.color}.png`} alt=""
          style={{ width: '40px', height: '40px', imageRendering: 'pixelated', flexShrink: 0 }}
        />
        <span style={{
          fontFamily: "'Bebas Neue', cursive", color: 'white',
          fontSize: '0.85rem', letterSpacing: '0.03em', lineHeight: 1.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {jugador.nombre}
        </span>
      </div>

      {/* Fila 1: vidas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ color: '#FF4655', fontSize: '0.95rem', lineHeight: 1 }}>♥</span>
        <span style={{ fontFamily: "'Bebas Neue', cursive", color: 'white', fontSize: '0.8rem', letterSpacing: '0.04em' }}>
          {jugador.vidas}
        </span>
      </div>

      {/* Filas 2-4: doble bomba, velocidad, escudo */}
      {poderes.map((p) => (
        <div key={p.alt} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <img src={p.icono} alt={p.alt} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          <span
            className={p.activo ? 'pulsar' : undefined}
            style={{
              fontFamily: "'Bebas Neue', cursive", fontSize: '0.8rem', letterSpacing: '0.04em',
              color: p.activo ? '#FF4655' : '#768079'
            }}
          >
            {p.activo ? `${p.segundos}s` : '0'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PhaserGame({ estadoInicial, socket, miNombre, salaId, onVolverSala, onSalirSala }) {
  const contenedor  = useRef(null);
  const juegoRef    = useRef(null);
  const escenaRef   = useRef(null);
  const estadoRef   = useRef(JSON.parse(JSON.stringify(estadoInicial)));

  const ANCHO = estadoInicial.mapa[0].length * TILE;
  const ALTO  = estadoInicial.mapa.length    * TILE;

  const [escala, setEscala] = useState(() => calcularEscala(ANCHO, ALTO));

  // Recalcula el factor de escala cada vez que cambia el tamaño de la
  // ventana (maximizar/restaurar, mover a otro monitor, rotar, etc.), sin
  // tocar la instancia de Phaser: solo cambia el CSS transform de afuera.
  useEffect(() => {
    function alRedimensionar() {
      setEscala(calcularEscala(ANCHO, ALTO));
    }
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, [ANCHO, ALTO]);

  // Estado "espejo" solo para el panel lateral de tarjetas (DOM normal, no
  // Phaser): se actualiza con cada 'estado_juego' que ya llega por el socket.
  // Los timers de Phaser dentro de la escena siguen leyendo de estadoRef
  // directamente, sin pasar por React, para no perder rendimiento del juego.
  const [jugadoresEstado, setJugadoresEstado] = useState(estadoInicial.jugadores);

  // Los contadores de poderes ("14s", "13s"...) deben bajar solos aunque no
  // llegue estado nuevo del servidor; este reloj fuerza un re-render por
  // segundo solo para recalcular esos textos.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!estadoInicial || juegoRef.current) return;

    // Bandera propia de esta ejecución del efecto (no un ref compartido).
    // Phaser.Game arranca de forma asíncrona: si React StrictMode
    // desmonta y vuelve a montar el componente, el create() de la
    // instancia vieja puede dispararse después de que ya fue destruida.
    // "activo" evita que esa escena zombi toque this.add / escenaRef.
    const activo = { current: true };

    // Los tiles generados por IA traen bastante margen transparente alrededor
    // del contenido (~73-82% de cobertura), pensado para íconos centrados.
    // Para que se vean "a sangre" sin huecos entre celdas, se dibujan un poco
    // más grandes que el tile lógico; el sobrante transparente de cada sprite
    // se solapa con el de su vecino sin generar artefactos.
    const ESCALA_TILE = 1.42;

    // ── ESCENA ────────────────────────────────────────────
    class EscenaJuego extends Phaser.Scene {
      constructor() { super({ key: 'EscenaJuego' }); }

      preload() {
        this.load.image('tile_floor',      '/game/tiles/tile_floor.png');
        this.load.image('tile_wall_solid', '/game/tiles/tile_wall_solid.png');
        this.load.image('tile_wall_crate', '/game/tiles/tile_wall_crate.png');
        this.load.image('bomb_0', '/game/fx/bomb_0.png');
        this.load.image('bomb_1', '/game/fx/bomb_1.png');
        this.load.image('bomb_2', '/game/fx/bomb_2.png');
        this.load.image('explosion_center_0', '/game/fx/explosion_center_0.png');
        this.load.image('explosion_center_1', '/game/fx/explosion_center_1.png');
        this.load.image('explosion_arm_0', '/game/fx/explosion_arm_0.png');
        this.load.image('explosion_arm_1', '/game/fx/explosion_arm_1.png');
        this.load.image('powerup_doublebomb', '/game/fx/doublebomb.png');
        this.load.image('powerup_flash',      '/game/fx/flash.png');
        this.load.image('powerup_shield',     '/game/fx/shield.png');
        this.load.image('powerup_extra',      '/game/fx/extra.png');
        COLORES_JUGADOR.forEach(c => {
          Object.entries(FILA_DIRECCION).forEach(([dir, fila]) => {
            [1, 2].forEach(paso => {
              this.load.image(
                `char_${c.id}_${dir}_${paso}`,
                `/game/characters/${c.id}${fila}.${paso}.png`
              );
            });
          });
        });
      }

      create() {
        if (!activo.current) return;
        escenaRef.current = this;
        this.miId       = socket.id;
        this.textos     = {};
        this.ultimoMov  = 0;
        this.bombaSprites = {};
        this.powerupSprites  = {};
        this.powerupsReportados = new Map();
        this.jugadorSprites   = {};
        this.direccionJugador = {};
        this.ultimaPosJugador = {};
        this.ultimoMovJugador = {};

        this.construirMapa(estadoRef.current.mapa);
        this.gJugadores = this.add.graphics();
        this.actualizarBombas(estadoRef.current.bombas);
        this.actualizarPowerups(estadoRef.current.powerups || []);
        this.dibujarJugadores(estadoRef.current);

        this.cursores = this.input.keyboard.createCursorKeys();
        this.wasd     = this.input.keyboard.addKeys('W,A,S,D');
        this.espacio  = this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.SPACE
        );
      }

      update(time) {
        if (!activo.current) return;

        this.animarBombas(time);
        this.dibujarJugadores(estadoRef.current);
        this.revisarRecogerPowerup(time);

        // El cooldown lo decide el servidor (fuente de verdad); acá solo se
        // evita spamear 'mover' más rápido de lo que el propio jugador puede
        // moverse, leyendo su velocidad actual (más baja con flash activo).
        const miJugador = estadoRef.current.jugadores.find(j => j.id === this.miId);
        const cooldownMovimiento = miJugador?.velocidad || 180;
        if (time - this.ultimoMov < cooldownMovimiento) return;

        const arriba = this.cursores.up.isDown    || this.wasd.W.isDown;
        const abajo  = this.cursores.down.isDown  || this.wasd.S.isDown;
        const izq    = this.cursores.left.isDown  || this.wasd.A.isDown;
        const der    = this.cursores.right.isDown || this.wasd.D.isDown;

        if (arriba)     { socket.emit('mover', { direccion: 'up'    }); this.ultimoMov = time; }
        else if (abajo) { socket.emit('mover', { direccion: 'down'  }); this.ultimoMov = time; }
        else if (izq)   { socket.emit('mover', { direccion: 'left'  }); this.ultimoMov = time; }
        else if (der)   { socket.emit('mover', { direccion: 'right' }); this.ultimoMov = time; }

        if (Phaser.Input.Keyboard.JustDown(this.espacio)) {
          socket.emit('bomba');
        }
      }

      claveTexturaPowerup(tipo) {
        return `powerup_${tipo}`;
      }

      // Igual que actualizarBombas: solo agrega/quita sprites de los
      // power-ups que aparecieron/desaparecieron desde el último estado.
      actualizarPowerups(powerups) {
        if (!this.powerupSprites) return;
        const vistos = new Set();
        powerups.forEach(p => {
          vistos.add(p.id);
          if (!this.powerupSprites[p.id]) {
            const img = this.add.image(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, this.claveTexturaPowerup(p.tipo));
            img.setDisplaySize(TILE * 0.62, TILE * 0.62);
            this.powerupSprites[p.id] = img;
          }
        });
        Object.keys(this.powerupSprites).forEach(id => {
          if (!vistos.has(id)) {
            this.powerupSprites[id].destroy();
            delete this.powerupSprites[id];
            this.powerupsReportados?.delete(id);
          }
        });
      }

      // Detección de colisión jugador-powerup del lado del cliente: si mi
      // jugador está parado sobre la celda de un power-up, se le avisa al
      // servidor (que valida y aplica de verdad). El servidor ignora la
      // recogida si ese poder ya está activo (el power-up se queda ahí para
      // recogerlo después), así que acá NO se puede marcar como "reportado
      // para siempre" — si no, en cuanto el poder expire mientras el jugador
      // sigue parado en esa celda, nunca se reintentaría. Por eso se
      // reintenta cada REINTENTO_MS mientras siga sobre la misma celda.
      revisarRecogerPowerup(time) {
        const miJugador = estadoRef.current.jugadores.find(j => j.id === this.miId && j.vivo);
        if (!miJugador) return;

        const powerups = estadoRef.current.powerups || [];
        const powerup = powerups.find(p => p.x === miJugador.x && p.y === miJugador.y);
        if (!powerup) return;

        const REINTENTO_MS = 1000;
        const ultimoIntento = this.powerupsReportados.get(powerup.id) || 0;
        if (time - ultimoIntento < REINTENTO_MS) return;

        this.powerupsReportados.set(powerup.id, time);
        socket.emit('recoger_powerup', { salaId, socketId: this.miId, powerupId: powerup.id });
      }

      claveTile(celda) {
        return celda === 2 ? 'tile_wall_solid' : celda === 1 ? 'tile_wall_crate' : 'tile_floor';
      }

      construirMapa(mapa) {
        this.mapaConocido = mapa.map(fila => [...fila]);
        this.tileSprites = mapa.map((fila, y) => fila.map((celda, x) => {
          const img = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, this.claveTile(celda));
          img.setDisplaySize(TILE * ESCALA_TILE, TILE * ESCALA_TILE);
          // El muro indestructible y el piso comparten paleta gris/roja y
          // se confunden repetidos por todo el mapa: se tiñe de azul-acero
          // para que se lea de inmediato como "obstáculo" frente al piso neutro.
          if (celda === 2) img.setTint(0x2a5a8f);
          return img;
        }));
      }

      // Solo reemplaza la textura de las celdas que realmente cambiaron
      // (p.ej. una caja destruida por una explosión), en vez de recrear
      // el mapa completo en cada actualización de red.
      actualizarTilesMapa(mapa) {
        if (!this.tileSprites) return;
        mapa.forEach((fila, y) => fila.forEach((celda, x) => {
          if (this.mapaConocido[y][x] === celda) return;
          this.mapaConocido[y][x] = celda;
          this.tileSprites[y][x].setTexture(this.claveTile(celda));
        }));
      }

      actualizarBombas(bombas) {
        if (!this.bombaSprites) return;
        const vistas = new Set();
        bombas.forEach(b => {
          const id = String(b.id);
          vistas.add(id);
          if (!this.bombaSprites[id]) {
            const img = this.add.image(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, 'bomb_0');
            img.setDisplaySize(TILE * 0.8, TILE * 0.8);
            this.bombaSprites[id] = { img, inicio: this.time.now };
          }
        });
        Object.keys(this.bombaSprites).forEach(id => {
          if (!vistas.has(id)) {
            this.bombaSprites[id].img.destroy();
            delete this.bombaSprites[id];
          }
        });
      }

      animarBombas(time) {
        if (!this.bombaSprites) return;
        Object.values(this.bombaSprites).forEach(({ img, inicio }) => {
          const transcurrido = time - inicio;
          const clave = transcurrido > 2200 ? 'bomb_2' : transcurrido > 1100 ? 'bomb_1' : 'bomb_0';
          if (img.texture.key !== clave) img.setTexture(clave);
        });
      }

      dibujarJugadores(estado) {
        this.gJugadores.clear();
        Object.values(this.textos).forEach(t => t.destroy());
        this.textos = {};

        const vistos = new Set();

        estado.jugadores.forEach((j) => {
          if (!j.vivo) return;
          vistos.add(j.id);

          const px    = j.x * TILE + TILE / 2;
          const py    = j.y * TILE + TILE / 2;
          const esMio = j.id === this.miId;
          const c     = colorPorId(j.color);

          // El servidor no manda hacia dónde mira el jugador, así que la
          // dirección y el "paso" de caminata se infieren comparando la
          // celda anterior contra la nueva cada vez que llega estado nuevo.
          const ultima = this.ultimaPosJugador[j.id];
          if (!ultima || ultima.x !== j.x || ultima.y !== j.y) {
            if (ultima) {
              let dir = this.direccionJugador[j.id] || 'abajo';
              if      (j.x > ultima.x) dir = 'derecha';
              else if (j.x < ultima.x) dir = 'izquierda';
              else if (j.y > ultima.y) dir = 'abajo';
              else if (j.y < ultima.y) dir = 'arriba';
              this.direccionJugador[j.id] = dir;
            }
            this.ultimaPosJugador[j.id] = { x: j.x, y: j.y };
            this.ultimoMovJugador[j.id] = this.time.now;
          }

          const dir           = this.direccionJugador[j.id] || 'abajo';
          const enMovimiento  = (this.time.now - (this.ultimoMovJugador[j.id] || 0)) < 250;
          const paso          = enMovimiento ? (Math.floor(this.time.now / 150) % 2 === 0 ? 1 : 2) : 1;
          const texturaKey     = `char_${j.color}_${dir}_${paso}`;
          const pieY           = py + TILE / 2 - 6;

          this.gJugadores.fillStyle(0x000000, 0.35);
          this.gJugadores.fillEllipse(px, pieY, TILE - 14, 7);

          let img = this.jugadorSprites[j.id];
          if (!img) {
            img = this.add.image(px, pieY, texturaKey);
            img.setOrigin(0.5, 1);
            this.jugadorSprites[j.id] = img;
          } else {
            img.setPosition(px, pieY);
            if (img.texture.key !== texturaKey) img.setTexture(texturaKey);
          }
          const escala = (TILE * 1.05) / img.width;
          img.setScale(escala);

          if (esMio) {
            const arriba = img.getTopCenter();
            this.gJugadores.fillStyle(0xffffff);
            this.gJugadores.fillTriangle(
              arriba.x,     arriba.y - 6,
              arriba.x - 5, arriba.y - 14,
              arriba.x + 5, arriba.y - 14
            );
          }

          this.textos[j.id] = this.add.text(
            px, py + TILE / 2 + 2,
            j.nombre.substring(0, 8),
            {
              fontSize: '9px',
              color: c.css,
              fontFamily: 'Arial',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 3
            }
          ).setOrigin(0.5, 0);
        });

        Object.keys(this.jugadorSprites).forEach(id => {
          if (!vistos.has(id)) {
            this.jugadorSprites[id].destroy();
            delete this.jugadorSprites[id];
          }
        });
      }

      mostrarExplosion(celdas) {
        const origen   = celdas[0];
        const sprites  = celdas.map((c, i) => {
          const px = c.x * TILE + TILE / 2;
          const py = c.y * TILE + TILE / 2;
          const esCentro = i === 0;
          let img;
          if (esCentro) {
            img = this.add.image(px, py, 'explosion_center_0');
            img.setDisplaySize(TILE * 1.3, TILE * 1.3);
          } else {
            const dx = c.x - origen.x;
            const dy = c.y - origen.y;
            const angulo = dx > 0 ? 0 : dx < 0 ? 180 : dy > 0 ? 90 : 270;
            img = this.add.image(px, py, 'explosion_arm_0');
            img.setDisplaySize(TILE * 1.25, TILE * 1.25);
            img.setAngle(angulo);
          }
          return { img, esCentro };
        });

        this.time.delayedCall(120, () => {
          if (!activo.current) return;
          sprites.forEach(({ img, esCentro }) => img.setTexture(esCentro ? 'explosion_center_1' : 'explosion_arm_1'));
        });
        this.time.delayedCall(400, () => {
          if (!activo.current) return;
          sprites.forEach(({ img }) => img.destroy());
        });
      }

      mensajeTemporal(texto, color) {
        const msg = this.add.text(ANCHO / 2, ALTO / 2, texto, {
          fontSize: '28px', color,
          fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);
        this.time.delayedCall(2500, () => {
          if (activo.current && msg && msg.active) msg.destroy();
        });
      }

      mostrarFin(ganador) {
        const ov = this.add.graphics();
        ov.fillStyle(0x000000, 0.82);
        ov.fillRect(0, 0, ANCHO, ALTO);

        const esEmpate  = ganador === 'empate';
        const esGanador = ganador === miNombre;
        const titulo    = esEmpate ? 'EMPATE' : esGanador ? 'VICTORIA' : 'DERROTA';
        const color     = esEmpate ? '#facc15' : esGanador ? '#4ade80' : '#FF4655';
        const sub       = esEmpate
          ? 'NINGUNO SOBREVIVIO'
          : esGanador ? 'ERES EL ULTIMO EN PIE'
          : `${ganador.toUpperCase()} GANO LA PARTIDA`;

        const lr = this.add.graphics();
        lr.fillStyle(0xFF4655);
        lr.fillRect(ANCHO / 2 - 80, ALTO / 2 - 88, 160, 3);

        this.add.text(ANCHO / 2, ALTO / 2 - 52, titulo, {
          fontSize: '44px', color,
          fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(ANCHO / 2, ALTO / 2 + 2, sub, {
          fontSize: '12px', color: '#c2c8ce', fontFamily: 'Arial'
        }).setOrigin(0.5);

        const lb = this.add.graphics();
        lb.fillStyle(0xFF4655);
        lb.fillRect(ANCHO / 2 - 80, ALTO / 2 + 22, 160, 3);

        const btn = this.add.graphics();
        btn.fillStyle(0xFF4655);
        btn.fillRect(ANCHO / 2 - 80, ALTO / 2 + 36, 160, 36);

        this.add.text(ANCHO / 2, ALTO / 2 + 54, 'VOLVER A LA SALA', {
          fontSize: '11px', color: '#ffffff',
          fontFamily: 'Arial', fontStyle: 'bold'
        }).setOrigin(0.5);

        const zona = this.add.zone(ANCHO / 2, ALTO / 2 + 54, 160, 36)
          .setInteractive();
        zona.on('pointerdown', () => onVolverSala?.());
        zona.on('pointerover', () => {
          btn.clear();
          btn.fillStyle(0xff6470);
          btn.fillRect(ANCHO / 2 - 80, ALTO / 2 + 36, 160, 36);
        });
        zona.on('pointerout', () => {
          btn.clear();
          btn.fillStyle(0xFF4655);
          btn.fillRect(ANCHO / 2 - 80, ALTO / 2 + 36, 160, 36);
        });
      }
    }

    // ── JUEGO ────────────────────────────────────────────
    juegoRef.current = new Phaser.Game({
      type:            Phaser.AUTO,
      width:           ANCHO,
      height:          ALTO,
      parent:          contenedor.current,
      backgroundColor: '#0f1923',
      scene:           EscenaJuego,
    });

    // ── LISTENERS SOCKET FUERA DE PHASER ─────────────────
    socket.on('estado_juego', (nuevoEstado) => {
      if (!activo.current) return;
      estadoRef.current = nuevoEstado;
      setJugadoresEstado(nuevoEstado.jugadores);
      const escena = escenaRef.current;
      if (escena && escena.sys.isActive()) {
        escena.actualizarTilesMapa(nuevoEstado.mapa);
        escena.actualizarBombas(nuevoEstado.bombas);
        escena.actualizarPowerups(nuevoEstado.powerups || []);
      }
    });

    socket.on('explosion', ({ celdas, eliminados, golpeados }) => {
      if (!activo.current) return;
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mostrarExplosion(celdas);

      if (eliminados.includes(socket.id)) {
        escena.mensajeTemporal('ELIMINADO', '#FF4655');
        return;
      }
      const golpe = (golpeados || []).find(g => g.id === socket.id);
      if (golpe?.tipo === 'escudo') {
        escena.mensajeTemporal('¡ESCUDO CONSUMIDO!', '#38bdf8');
      } else if (golpe?.tipo === 'vida') {
        escena.mensajeTemporal(`-1 VIDA (${golpe.vidasRestantes})`, '#facc15');
      }
    });

    socket.on('fin_partida', ({ ganador }) => {
      if (!activo.current) return;
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mostrarFin(ganador);
    });

    socket.on('jugador_salio', () => {
      if (!activo.current) return;
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mensajeTemporal('RIVAL DESCONECTADO', '#facc15');
    });

    const MENSAJE_PODER = {
      doublebomb: '¡DOBLE BOMBA!',
      flash: '¡VELOCIDAD!',
      shield: '¡ESCUDO ACTIVADO!',
      extra: '¡VIDA EXTRA!'
    };

    socket.on('powerup_aplicado', ({ jugadorId, tipo }) => {
      if (!activo.current || jugadorId !== socket.id) return;
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mensajeTemporal(MENSAJE_PODER[tipo] || 'PODER ACTIVADO', '#4ade80');
    });

    socket.on('powerup_expirado', ({ jugadorId }) => {
      if (!activo.current || jugadorId !== socket.id) return;
      // El panel lateral ya se actualiza solo con 'estado_juego'; no hace
      // falta un mensaje en pantalla cada vez que un poder se acaba.
    });

    return () => {
      activo.current = false;
      socket.off('estado_juego');
      socket.off('explosion');
      socket.off('fin_partida');
      socket.off('jugador_salio');
      socket.off('powerup_aplicado');
      socket.off('powerup_expirado');
      escenaRef.current = null;
      juegoRef.current?.destroy(true);
      juegoRef.current = null;
    };
  }, [estadoInicial]);

  // Repartidas parejo entre ambos lados del tablero: 2 jugadores -> 1 y 1,
  // 3 jugadores -> 2 a la izquierda y 1 a la derecha, 4 -> 2 y 2.
  const mitad = Math.ceil(jugadoresEstado.length / 2);
  const jugadoresIzquierda = jugadoresEstado.slice(0, mitad);
  const jugadoresDerecha   = jugadoresEstado.slice(mitad);

  const esquina = (vertical, horizontal) => ({
    position: 'absolute', width: '26px', height: '26px',
    [vertical]: '-10px', [horizontal]: '-10px',
    borderTop:    vertical === 'top'    ? '2px solid #FF4655' : 'none',
    borderBottom: vertical === 'bottom' ? '2px solid #FF4655' : 'none',
    borderLeft:   horizontal === 'left'  ? '2px solid #FF4655' : 'none',
    borderRight:  horizontal === 'right' ? '2px solid #FF4655' : 'none',
    pointerEvents: 'none'
  });

  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      position: 'relative', overflow: 'auto',
      background: '#05080b',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>

      {/* Fondo */}
      <img src="/partida.png" alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center'
        }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(5,8,11,0.25) 0%, rgba(5,8,11,0.8) 100%)'
      }}/>

      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', rowGap: '6px',
        padding: '8px clamp(14px, 3vw, 32px)',
        background: 'linear-gradient(to bottom, rgba(8,12,17,0.94), rgba(8,12,17,0.55) 75%, transparent)',
        borderBottom: '1px solid rgba(255,70,85,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Logo"
            style={{ width: '26px', height: '26px', objectFit: 'contain' }}/>
          <div>
            <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '1rem', color: 'white', letterSpacing: '0.08em', margin: 0, lineHeight: 1 }}>
              BOMBERECI ARENA
            </p>
            <p style={{ fontSize: '0.56rem', color: '#FF4655', textTransform: 'uppercase', letterSpacing: '0.18em', margin: '2px 0 0' }}>
              En partida · Sala {salaId}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {estadoInicial.jugadores.map(j => {
            const c     = colorPorId(j.color);
            const esMio = j.id === socket.id;
            return (
              <div key={j.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: esMio ? 'rgba(255,70,85,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${esMio ? '#FF4655' : 'rgba(255,255,255,0.14)'}`
              }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: c.css, boxShadow: `0 0 6px ${c.css}`
                }}/>
                <span style={{
                  fontFamily: "'Bebas Neue', cursive", fontSize: '0.78rem',
                  color: 'white', letterSpacing: '0.05em'
                }}>
                  {j.nombre.substring(0, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tablero + paneles laterales. alignItems:'flex-start' para que la
          primera tarjeta de cada lado quede a ras del borde superior del
          tablero (nada de centrado vertical acá). */}
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'flex-start', gap: '18px' }}>

        {/* Jugadores (izquierda): top de la primera tarjeta a ras del tablero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {jugadoresIzquierda.map(j => (
            <TarjetaJugador key={j.id} jugador={j} esMio={j.id === socket.id} ahora={ahora} />
          ))}
        </div>

        {/* Caja al tamaño visual final (ANCHO/ALTO ya escalados): define el
            espacio real que ocupa en la página y recorta el sobrante del
            hijo sin escalar de abajo. */}
        <div style={{
          position: 'relative',
          width: ANCHO * escala,
          height: ALTO * escala,
          overflow: 'hidden',
          border: '1px solid rgba(255,70,85,0.5)',
          boxShadow: '0 0 70px rgba(255,70,85,0.25), inset 0 0 50px rgba(0,0,0,0.55)'
        }}>
          <div style={esquina('top', 'left')}/>
          <div style={esquina('top', 'right')}/>
          <div style={esquina('bottom', 'left')}/>
          <div style={esquina('bottom', 'right')}/>
          {/* Phaser siempre renderiza a su resolución nativa (ANCHO x ALTO);
              este wrapper solo lo encoge visualmente vía transform para que
              quepa en pantallas más pequeñas, sin tocar la lógica del juego. */}
          <div style={{ width: ANCHO, height: ALTO, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
            <div ref={contenedor} style={{ width: ANCHO, height: ALTO }} />
          </div>
        </div>

        {/* Jugadores (derecha) arriba + botón abandonar empujado al fondo con
            marginTop:'auto', en una columna con la MISMA altura que el
            tablero para que quede a ras del borde inferior. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: ALTO * escala }}>
          {jugadoresDerecha.map(j => (
            <TarjetaJugador key={j.id} jugador={j} esMio={j.id === socket.id} ahora={ahora} />
          ))}

          <div style={{
            marginTop: 'auto',
            display: 'flex', flexDirection: 'column', gap: '7px',
            padding: '14px 13px',
            background: 'rgba(8,12,17,0.75)',
            border: '1px solid rgba(255,70,85,0.25)',
            width: '156px'
          }}>
            <p style={{
              fontFamily: "'Bebas Neue', cursive", fontSize: '0.8rem',
              color: 'white', letterSpacing: '0.07em', margin: 0
            }}>
              ABANDONAR
            </p>
            <p style={{ fontSize: '0.6rem', color: '#c2c8ce', lineHeight: 1.4, margin: '0 0 2px' }}>
              Perderás tu progreso en esta partida.
            </p>
            <button
              onClick={() => {
                if (window.confirm('¿Seguro que quieres salir de la sala?')) {
                  onSalirSala?.();
                }
              }}
              className="btn-val-outline"
              style={{ fontSize: '0.62rem', padding: '8px 10px', width: '100%' }}
            >
              SALIR DE LA SALA
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: '10px', zIndex: 10,
        display: 'flex', gap: '14px', alignItems: 'center',
        padding: '7px 18px',
        background: 'rgba(8,12,17,0.75)',
        border: '1px solid rgba(255,70,85,0.25)'
      }}>
        <span style={{ fontSize: '0.62rem', color: '#c2c8ce', textTransform: 'uppercase', letterSpacing: '0.13em' }}>
          Flechas / WASD — Mover
        </span>
        <span style={{ color: 'rgba(255,70,85,0.4)' }}>|</span>
        <span style={{ fontSize: '0.62rem', color: '#c2c8ce', textTransform: 'uppercase', letterSpacing: '0.13em' }}>
          Espacio — Bomba
        </span>
      </div>
    </div>
  );
}