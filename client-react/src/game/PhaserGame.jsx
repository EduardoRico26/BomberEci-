import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { colorPorId, COLORES_JUGADOR } from './coloresJugador';

const TILE = 56;

// Cada dirección de personaje vive en un PNG suelto (no un spritesheet):
// archivo "<color><fila>.<paso>.png", fila 1 = abajo, 2 = arriba, 3 = derecha,
// 4 = izquierda; paso 1/2 son los dos frames del ciclo de caminar.
const FILA_DIRECCION = { abajo: 1, arriba: 2, derecha: 3, izquierda: 4 };

export default function PhaserGame({ estadoInicial, socket, miNombre, salaId, onVolverSala }) {
  const contenedor  = useRef(null);
  const juegoRef    = useRef(null);
  const escenaRef   = useRef(null);
  const estadoRef   = useRef(JSON.parse(JSON.stringify(estadoInicial)));

  useEffect(() => {
    if (!estadoInicial || juegoRef.current) return;

    const ANCHO = estadoInicial.mapa[0].length * TILE;
    const ALTO  = estadoInicial.mapa.length    * TILE;

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
        this.jugadorSprites   = {};
        this.direccionJugador = {};
        this.ultimaPosJugador = {};
        this.ultimoMovJugador = {};

        this.construirMapa(estadoRef.current.mapa);
        this.gJugadores = this.add.graphics();
        this.actualizarBombas(estadoRef.current.bombas);
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

        if (time - this.ultimoMov < 130) return;

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
      const escena = escenaRef.current;
      if (escena && escena.sys.isActive()) {
        escena.actualizarTilesMapa(nuevoEstado.mapa);
        escena.actualizarBombas(nuevoEstado.bombas);
      }
    });

    socket.on('explosion', ({ celdas, eliminados }) => {
      if (!activo.current) return;
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mostrarExplosion(celdas);
      if (eliminados.includes(socket.id)) {
        escena.mensajeTemporal('ELIMINADO', '#FF4655');
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

    return () => {
      activo.current = false;
      socket.off('estado_juego');
      socket.off('explosion');
      socket.off('fin_partida');
      socket.off('jugador_salio');
      escenaRef.current = null;
      juegoRef.current?.destroy(true);
      juegoRef.current = null;
    };
  }, [estadoInicial]);

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
      width: '100vw', height: '100vh',
      position: 'relative', overflow: 'hidden',
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
        padding: '16px 36px',
        background: 'linear-gradient(to bottom, rgba(8,12,17,0.94), rgba(8,12,17,0.55) 75%, transparent)',
        borderBottom: '1px solid rgba(255,70,85,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Logo"
            style={{ width: '36px', height: '36px', objectFit: 'contain' }}/>
          <div>
            <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '1.2rem', color: 'white', letterSpacing: '0.08em', margin: 0, lineHeight: 1 }}>
              BOMBERECI ARENA
            </p>
            <p style={{ fontSize: '0.62rem', color: '#FF4655', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '3px 0 0' }}>
              En partida · Sala {salaId}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {estadoInicial.jugadores.map(j => {
            const c     = colorPorId(j.color);
            const esMio = j.id === socket.id;
            return (
              <div key={j.id} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '6px 12px',
                background: esMio ? 'rgba(255,70,85,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${esMio ? '#FF4655' : 'rgba(255,255,255,0.14)'}`
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: c.css, boxShadow: `0 0 6px ${c.css}`
                }}/>
                <span style={{
                  fontFamily: "'Bebas Neue', cursive", fontSize: '0.85rem',
                  color: 'white', letterSpacing: '0.05em'
                }}>
                  {j.nombre.substring(0, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tablero */}
      <div style={{ position: 'relative', zIndex: 5 }}>
        <div style={esquina('top', 'left')}/>
        <div style={esquina('top', 'right')}/>
        <div style={esquina('bottom', 'left')}/>
        <div style={esquina('bottom', 'right')}/>
        <div ref={contenedor}
          style={{
            border: '1px solid rgba(255,70,85,0.5)',
            boxShadow: '0 0 70px rgba(255,70,85,0.25), inset 0 0 50px rgba(0,0,0,0.55)'
          }}
        />
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: '22px', zIndex: 10,
        display: 'flex', gap: '18px', alignItems: 'center',
        padding: '10px 22px',
        background: 'rgba(8,12,17,0.75)',
        border: '1px solid rgba(255,70,85,0.25)'
      }}>
        <span style={{ fontSize: '0.68rem', color: '#c2c8ce', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Flechas / WASD — Mover
        </span>
        <span style={{ color: 'rgba(255,70,85,0.4)' }}>|</span>
        <span style={{ fontSize: '0.68rem', color: '#c2c8ce', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Espacio — Bomba
        </span>
      </div>
    </div>
  );
}