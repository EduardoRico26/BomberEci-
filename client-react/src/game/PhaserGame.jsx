import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const TILE = 40;

export default function PhaserGame({ estadoInicial, socket, miNombre, salaId }) {
  const contenedor  = useRef(null);
  const juegoRef    = useRef(null);
  const escenaRef   = useRef(null);
  const estadoRef   = useRef(JSON.parse(JSON.stringify(estadoInicial)));

  useEffect(() => {
    if (!estadoInicial || juegoRef.current) return;

    const ANCHO = estadoInicial.mapa[0].length * TILE;
    const ALTO  = estadoInicial.mapa.length    * TILE;

    // ── ESCENA ────────────────────────────────────────────
    class EscenaJuego extends Phaser.Scene {
      constructor() { super({ key: 'EscenaJuego' }); }

      create() {
        escenaRef.current = this;
        this.miId      = socket.id;
        this.textos    = {};
        this.ultimoMov = 0;

        this.gMapa      = this.add.graphics();
        this.gBombas    = this.add.graphics();
        this.gExplosion = this.add.graphics();
        this.gJugadores = this.add.graphics();

        this.dibujarTodo();

        this.cursores = this.input.keyboard.createCursorKeys();
        this.wasd     = this.input.keyboard.addKeys('W,A,S,D');
        this.espacio  = this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.SPACE
        );
      }

      update(time) {
        // Redibujar con el estado más reciente
        this.dibujarTodo();

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

      dibujarTodo() {
        const estado = estadoRef.current;
        if (!estado) return;
        this.dibujarMapa(estado);
        this.dibujarJugadores(estado);
      }

      dibujarMapa(estado) {
        this.gMapa.clear();
        this.gBombas.clear();

        estado.mapa.forEach((fila, y) => {
          fila.forEach((celda, x) => {
            const px = x * TILE;
            const py = y * TILE;
            if (celda === 2) {
              this.gMapa.fillStyle(0x2a2a2a);
              this.gMapa.fillRect(px, py, TILE - 1, TILE - 1);
              this.gMapa.fillStyle(0x1a1a1a);
              this.gMapa.fillRect(px + 3, py + 3, TILE - 7, TILE - 7);
            } else if (celda === 1) {
              this.gMapa.fillStyle(0x8B3A0F);
              this.gMapa.fillRect(px, py, TILE - 1, TILE - 1);
              this.gMapa.fillStyle(0xA0450F);
              this.gMapa.fillRect(px + 3, py + 3, TILE - 7, TILE - 7);
              this.gMapa.fillStyle(0x7A3208);
              this.gMapa.fillRect(px + 4, py + TILE / 2 - 1, TILE - 9, 2);
              this.gMapa.fillRect(px + TILE / 2, py + 4, 2, TILE / 2 - 6);
            } else {
              this.gMapa.fillStyle(0x1a1f2e);
              this.gMapa.fillRect(px, py, TILE - 1, TILE - 1);
              this.gMapa.fillStyle(0x1e2435);
              this.gMapa.fillRect(px, py, TILE - 1, 1);
              this.gMapa.fillRect(px, py, 1, TILE - 1);
            }
          });
        });

        estado.bombas.forEach(b => {
          const cx = b.x * TILE + TILE / 2;
          const cy = b.y * TILE + TILE / 2;
          this.gBombas.fillStyle(0x111111);
          this.gBombas.fillCircle(cx, cy, TILE / 2 - 5);
          this.gBombas.fillStyle(0x333333);
          this.gBombas.fillCircle(cx - 4, cy - 4, 5);
          this.gBombas.fillStyle(0xFF4655);
          this.gBombas.fillCircle(cx + 8, cy - 10, 4);
          this.gBombas.fillStyle(0xffaa00);
          this.gBombas.fillCircle(cx + 8, cy - 13, 3);
        });
      }

      dibujarJugadores(estado) {
        this.gJugadores.clear();
        Object.values(this.textos).forEach(t => t.destroy());
        this.textos = {};

        estado.jugadores.forEach((j) => {
          if (!j.vivo) return;
          const px    = j.x * TILE + TILE / 2;
          const py    = j.y * TILE + TILE / 2;
          const esMio = j.id === this.miId;
          const color = esMio ? 0xFF4655 : 0x00b4d8;
          const borde = esMio ? 0xff8b95 : 0x7de8ff;

          this.gJugadores.fillStyle(0x000000, 0.4);
          this.gJugadores.fillEllipse(px, py + TILE / 2 - 4, TILE - 10, 8);

          this.gJugadores.fillStyle(color);
          this.gJugadores.fillCircle(px, py, TILE / 2 - 4);

          this.gJugadores.lineStyle(2, borde, 1);
          this.gJugadores.strokeCircle(px, py, TILE / 2 - 4);

          if (esMio) {
            this.gJugadores.fillStyle(0xffffff);
            this.gJugadores.fillTriangle(
              px,     py - TILE / 2 - 4,
              px - 5, py - TILE / 2 - 12,
              px + 5, py - TILE / 2 - 12
            );
          }

          this.textos[j.id] = this.add.text(
            px, py + TILE / 2 + 2,
            j.nombre.substring(0, 8),
            {
              fontSize: '9px',
              color: esMio ? '#FF4655' : '#00b4d8',
              fontFamily: 'Arial',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 3
            }
          ).setOrigin(0.5, 0);
        });
      }

      mostrarExplosion(celdas) {
        this.gExplosion.clear();
        celdas.forEach(c => {
          const px = c.x * TILE;
          const py = c.y * TILE;
          this.gExplosion.fillStyle(0xff6b00, 0.95);
          this.gExplosion.fillRect(px, py, TILE - 1, TILE - 1);
          this.gExplosion.fillStyle(0xffdd00, 0.7);
          this.gExplosion.fillRect(px + 8, py + 8, TILE - 17, TILE - 17);
        });
        this.time.delayedCall(400, () => {
          this.gExplosion.clear();
        });
      }

      mensajeTemporal(texto, color) {
        const msg = this.add.text(ANCHO / 2, ALTO / 2, texto, {
          fontSize: '28px', color,
          fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);
        this.time.delayedCall(2500, () => {
          if (msg && msg.active) msg.destroy();
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
        lr.fillRect(ANCHO / 2 - 80, ALTO / 2 - 72, 160, 3);

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

        this.add.text(ANCHO / 2, ALTO / 2 + 54, 'VOLVER AL LOBBY', {
          fontSize: '11px', color: '#ffffff',
          fontFamily: 'Arial', fontStyle: 'bold'
        }).setOrigin(0.5);

        const zona = this.add.zone(ANCHO / 2, ALTO / 2 + 54, 160, 36)
          .setInteractive();
        zona.on('pointerdown', () => window.location.reload());
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
      estadoRef.current = nuevoEstado;
    });

    socket.on('explosion', ({ celdas, eliminados }) => {
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mostrarExplosion(celdas);
      if (eliminados.includes(socket.id)) {
        escena.mensajeTemporal('ELIMINADO', '#FF4655');
      }
    });

    socket.on('fin_partida', ({ ganador }) => {
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mostrarFin(ganador);
    });

    socket.on('jugador_salio', () => {
      const escena = escenaRef.current;
      if (!escena || !escena.sys.isActive()) return;
      escena.mensajeTemporal('RIVAL DESCONECTADO', '#facc15');
    });

    return () => {
      socket.off('estado_juego');
      socket.off('explosion');
      socket.off('fin_partida');
      socket.off('jugador_salio');
      escenaRef.current = null;
      juegoRef.current?.destroy(true);
      juegoRef.current = null;
    };
  }, [estadoInicial]);

  const ANCHO = estadoInicial.mapa[0].length * TILE;
  const ALTO  = estadoInicial.mapa.length    * TILE;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0f1923',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '12px', position: 'relative'
    }}>

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
        borderBottom: '1px solid rgba(255,70,85,0.2)',
        background: 'rgba(10,16,22,0.9)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Logo"
            style={{ width: '32px', height: '32px', objectFit: 'contain' }}/>
          <div>
            <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '1.1rem', color: 'white', letterSpacing: '0.08em', margin: 0, lineHeight: 1 }}>
              BOMBERECI ARENA
            </p>
            <p style={{ fontSize: '0.6rem', color: '#FF4655', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>
              EN PARTIDA
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: '#768079', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Sala</p>
            <p style={{ margin: 0, fontFamily: "'Bebas Neue', cursive", fontSize: '1rem', color: 'white' }}>{salaId}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: '#768079', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Jugador</p>
            <p style={{ margin: 0, fontFamily: "'Bebas Neue', cursive", fontSize: '1rem', color: '#FF4655' }}>{miNombre}</p>
          </div>
        </div>
      </div>

      <div ref={contenedor}
        style={{
          border: '1px solid rgba(255,70,85,0.4)',
          boxShadow: '0 0 40px rgba(255,70,85,0.15)'
        }}
      />

      <div style={{
        position: 'absolute', bottom: '16px',
        display: 'flex', gap: '24px',
        fontSize: '0.7rem', color: '#768079',
        textTransform: 'uppercase', letterSpacing: '0.15em'
      }}>
        <span>Flechas / WASD — Mover</span>
        <span style={{ color: 'rgba(255,70,85,0.4)' }}>|</span>
        <span>Espacio — Bomba</span>
      </div>
    </div>
  );
}