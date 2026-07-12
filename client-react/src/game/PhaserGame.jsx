import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const TILE = 40;
const COLORES = { 0: 0x2d2d2d, 1: 0x8B4513, 2: 0x555555 };
const COL_JUGADORES = [0xe94560, 0x00b4d8];

export default function PhaserGame({ estadoInicial, socket, miNombre, salaId }) {
  const contenedor = useRef(null);
  const juegoRef = useRef(null);

  useEffect(() => {
    if (!estadoInicial || juegoRef.current) return;

    const ancho = estadoInicial.mapa[0].length * TILE;
    const alto  = estadoInicial.mapa.length * TILE;

    class EscenaJuego extends Phaser.Scene {
      constructor() { super('EscenaJuego'); }

      create() {
        this.estado = estadoInicial;
        this.miId   = socket.id;
        this.graficasMapa     = this.add.graphics();
        this.graficasBombas   = this.add.graphics();
        this.graficasExplosion = this.add.graphics();
        this.graficasJugadores = this.add.graphics();
        this.textos = {};

        this.dibujarMapa();
        this.dibujarJugadores();

        socket.on('estado_juego', (nuevoEstado) => {
          this.estado = nuevoEstado;
          this.dibujarMapa();
          this.dibujarJugadores();
        });

        socket.on('explosion', ({ celdas, eliminados }) => {
          this.mostrarExplosion(celdas);
          if (eliminados.includes(this.miId)) {
            this.add.text(ancho/2, alto/2, '💀 ELIMINADO', {
              fontSize: '24px', fill: '#e94560', fontFamily: 'Arial'
            }).setOrigin(0.5);
          }
        });

        socket.on('fin_partida', ({ ganador }) => {
          const texto = ganador === 'empate' ? '¡EMPATE!'
            : ganador === miNombre ? '🏆 ¡GANASTE!'
            : `💀 Ganó ${ganador}`;
          const overlay = this.add.rectangle(ancho/2, alto/2, ancho, alto, 0x000000, 0.8);
          this.add.text(ancho/2, alto/2 - 30, texto, {
            fontSize: '28px', fill: '#e94560', fontFamily: 'Arial', fontStyle: 'bold'
          }).setOrigin(0.5);
          this.add.text(ancho/2, alto/2 + 20, 'Haz clic para volver al lobby', {
            fontSize: '14px', fill: '#aaaaaa', fontFamily: 'Arial'
          }).setOrigin(0.5);
          overlay.setInteractive();
          overlay.on('pointerdown', () => window.location.reload());
        });

        socket.on('jugador_salio', () => {
          this.add.text(ancho/2, 20, '⚠️ El otro jugador se desconectó', {
            fontSize: '13px', fill: '#facc15', fontFamily: 'Arial'
          }).setOrigin(0.5, 0);
        });

        // Controles
        this.cursores = this.input.keyboard.createCursorKeys();
        this.teclaEspacio = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.ultimoMovimiento = 0;
      }

      update(time) {
        if (time - this.ultimoMovimiento < 150) return;
        if (this.cursores.up.isDown)    { socket.emit('mover', { direccion: 'up' });    this.ultimoMovimiento = time; }
        if (this.cursores.down.isDown)  { socket.emit('mover', { direccion: 'down' });  this.ultimoMovimiento = time; }
        if (this.cursores.left.isDown)  { socket.emit('mover', { direccion: 'left' });  this.ultimoMovimiento = time; }
        if (this.cursores.right.isDown) { socket.emit('mover', { direccion: 'right' }); this.ultimoMovimiento = time; }
        if (Phaser.Input.Keyboard.JustDown(this.teclaEspacio)) { socket.emit('bomba'); }
      }

      dibujarMapa() {
        this.graficasMapa.clear();
        this.estado.mapa.forEach((fila, y) => {
          fila.forEach((celda, x) => {
            this.graficasMapa.fillStyle(COLORES[celda] || 0x2d2d2d);
            this.graficasMapa.fillRect(x*TILE, y*TILE, TILE-1, TILE-1);
          });
        });
        this.graficasBombas.clear();
        this.estado.bombas.forEach(b => {
          this.graficasBombas.fillStyle(0x111111);
          this.graficasBombas.fillCircle(b.x*TILE+TILE/2, b.y*TILE+TILE/2, TILE/2-5);
          this.graficasBombas.fillStyle(0xe94560);
          this.graficasBombas.fillCircle(b.x*TILE+TILE/2+8, b.y*TILE+6, 4);
        });
      }

      dibujarJugadores() {
        this.graficasJugadores.clear();
        Object.values(this.textos).forEach(t => t.destroy());
        this.textos = {};
        this.estado.jugadores.forEach((j, i) => {
          if (!j.vivo) return;
          const color = j.id === this.miId ? COL_JUGADORES[0] : COL_JUGADORES[1];
          this.graficasJugadores.fillStyle(color);
          this.graficasJugadores.fillCircle(j.x*TILE+TILE/2, j.y*TILE+TILE/2, TILE/2-4);
          this.textos[j.id] = this.add.text(
            j.x*TILE+TILE/2, j.y*TILE+TILE/2+4,
            j.nombre.substring(0,6),
            { fontSize: '9px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold' }
          ).setOrigin(0.5);
        });
      }

      mostrarExplosion(celdas) {
        this.graficasExplosion.clear();
        this.graficasExplosion.fillStyle(0xff6b00, 0.9);
        celdas.forEach(c => {
          this.graficasExplosion.fillRect(c.x*TILE, c.y*TILE, TILE-1, TILE-1);
        });
        this.time.delayedCall(400, () => {
          this.graficasExplosion.clear();
          this.dibujarMapa();
        });
      }
    }

    juegoRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: ancho,
      height: alto,
      parent: contenedor.current,
      backgroundColor: '#1a1a2e',
      scene: EscenaJuego
    });

    return () => {
      socket.off('estado_juego');
      socket.off('explosion');
      socket.off('fin_partida');
      socket.off('jugador_salio');
      juegoRef.current?.destroy(true);
      juegoRef.current = null;
    };
  }, [estadoInicial]);

  return (
    <div style={{ background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0f0f1a 70%)' }}
      className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="font-game text-sm text-red-500">💣 BomberEci Arena</h1>
      <div className="text-xs text-gray-500">
        Sala: <span className="text-white">{salaId}</span> &nbsp;|&nbsp;
        Jugador: <span className="text-red-400">{miNombre}</span>
      </div>
      <div ref={contenedor} className="border-2 border-red-900 rounded-xl overflow-hidden shadow-2xl"/>
      <p className="text-xs text-gray-600">Flechas para mover · Espacio para bomba</p>
    </div>
  );
}