import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import PhaserGame from '../game/PhaserGame';
import { COLORES_JUGADOR } from '../game/coloresJugador';

// "<color>1.1.png" = fila 1 (mirando abajo), paso 1: la misma pose de
// frente que usa PhaserGame como primer frame de la animación al caminar.
function SpritePersonaje({ color, ancho = 56 }) {
  return (
    <img src={`/game/characters/${color}1.1.png`} alt=""
      style={{ width: ancho, height: 'auto', imageRendering: 'pixelated' }}
    />
  );
}

export default function Lobby() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [vista, setVista] = useState('menu');
  const [salas, setSalas] = useState([]);
  const [salasFiltradas, setSalasFiltradas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [nombreSala, setNombreSala] = useState('');
  const [mensajeEspera, setMensajeEspera] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const [estadoInicial, setEstadoInicial] = useState(null);
  const [salaId, setSalaId] = useState('');
  const [colorSeleccionado, setColorSeleccionado] = useState('');
  const [esDueno, setEsDueno] = useState(false);

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => socket.emit('pedir_salas'));
    socket.on('lista_salas', (data) => {
      setSalas(data);
      setSalasFiltradas(data);
    });
    socket.on('sala_creada', ({ salaId }) => {
      setSalaId(salaId);
      setEsDueno(true);
      setMensajeEspera(`Sala "${salaId}" creada. Esperando jugadores...`);
    });
    socket.on('iniciar_partida', (estado) => {
      setEstadoInicial(estado);
      setVista('juego');
    });
    socket.on('error_sala', (msg) => {
      setErrorNombre(msg);
      setMensajeEspera(msg);
    });
    const intervalo = setInterval(() => socket.emit('pedir_salas'), 2000);
    return () => {
      clearInterval(intervalo);
      socket.off('connect');
      socket.off('lista_salas');
      socket.off('sala_creada');
      socket.off('iniciar_partida');
      socket.off('error_sala');
      socket.disconnect();
    };
  }, []);

  // Filtrar salas disponibles (no llenas) en tiempo real para la lista pública de "unirse"
  useEffect(() => {
    const noLlenas = salas.filter(s => s.jugadores < 4);
    if (!busqueda.trim()) {
      setSalasFiltradas(noLlenas);
    } else {
      setSalasFiltradas(
        noLlenas.filter(s => s.id.toLowerCase().includes(busqueda.toLowerCase()))
      );
    }
  }, [busqueda, salas]);

  function crearSala() {
    if (!nombreSala.trim()) {
      setErrorNombre('Escribe un nombre para tu sala.');
      return;
    }
    if (nombreSala.trim().length < 3) {
      setErrorNombre('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (!colorSeleccionado) {
      setErrorNombre('Elige un color para tu personaje.');
      return;
    }
    setErrorNombre('');
    socket.emit('crear_sala', { nombre: usuario.nombre, nombreSala: nombreSala.trim(), color: colorSeleccionado });
    setMensajeEspera('Creando sala...');
    setVista('crear');
  }

  function elegirSalaParaUnirse(id) {
    setSalaId(id);
    setColorSeleccionado('');
    setErrorNombre('');
    setVista('elegir-color-unirse');
  }

  function confirmarUnirse() {
    if (!colorSeleccionado) {
      setErrorNombre('Elige un color para tu personaje.');
      return;
    }
    setErrorNombre('');
    setEsDueno(false);
    socket.emit('unirse_sala', { salaId, nombre: usuario.nombre, color: colorSeleccionado });
    setMensajeEspera(`Uniéndose a "${salaId}"...`);
    setVista('crear');
  }

  function iniciarPartida() {
    setErrorNombre('');
    socket.emit('iniciar_partida_manual');
  }

  function volverASala() {
    setMensajeEspera('Partida finalizada. ¡Pueden jugar de nuevo!');
    setVista('crear');
  }

  async function cerrarSesion() {
    await logout();
    navigate('/login');
  }

  if (vista === 'juego') {
    return (
      <PhaserGame
        estadoInicial={estadoInicial}
        socket={socket}
        miNombre={usuario.nombre}
        salaId={salaId}
        onVolverSala={volverASala}
      />
    );
  }

  const jugadoresEnSala = salas.find(s => s.id === salaId)?.jugadores ?? 1;

  const lineaRoja = { width: '58px', height: '4px', background: '#FF4655', marginBottom: '18px' };

  const inputStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #768079',
    color: 'white',
    fontSize: '1rem',
    padding: '10px 4px',
    outline: 'none',
    fontFamily: "'Rajdhani', sans-serif",
    letterSpacing: '0.05em',
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      position: 'relative', overflow: 'hidden',
      background: '#0a1016'
    }}>

      {/* Fondo */}
      <img src="/lobby.png" alt="Lobby"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center center'
        }}
      />

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(8, 12, 18, 0.72)', zIndex: 1
      }}/>

      {/* Header */}
      <header style={{
        position: 'absolute', top: '28px',
        left: 'clamp(24px, 4vw, 72px)',
        right: 'clamp(24px, 4vw, 72px)',
        zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <p style={{ color: '#FF4655', fontSize: '0.72rem', letterSpacing: '0.18em', margin: 0, textTransform: 'uppercase' }}>
            BomberEci Arena
          </p>
          <p style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '1.65rem', letterSpacing: '0.09em', margin: '3px 0 0' }}>
            SELECCIÓN DE PARTIDA
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#c2c8ce', fontSize: '0.68rem', letterSpacing: '0.13em', margin: 0, textTransform: 'uppercase' }}>
              Jugador
            </p>
            <p style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '1.25rem', letterSpacing: '0.08em', margin: '4px 0 0' }}>
              {usuario?.nombre?.toUpperCase() || 'JUGADOR'}
            </p>
          </div>
          <button onClick={cerrarSesion} className="btn-val-outline" style={{ fontSize: '0.72rem' }}>
            SALIR
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main style={{
        position: 'relative', zIndex: 5,
        minHeight: '100vh',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '60px clamp(24px, 6vw, 80px) 48px'
      }}>
        <AnimatePresence mode="wait">

          {/* MENÚ */}
          {vista === 'menu' && (
            <motion.section key="menu"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
              style={{ width: 'min(720px, 100%)' }}>

              <div style={{ marginBottom: '32px' }}>
                <div style={lineaRoja}/>
                <p style={{ color: '#FF4655', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                  Arena multijugador
                </p>
                <h1 style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: 'clamp(2.8rem, 5vw, 4.5rem)', letterSpacing: '0.07em', lineHeight: 0.95, margin: 0 }}>
                  ELIGE TU PARTIDA
                </h1>
                <p style={{ color: '#c2c8ce', fontSize: '0.95rem', lineHeight: 1.55, margin: '16px 0 0', maxWidth: '560px' }}>
                  Crea una nueva sala para esperar a un rival o entra a una partida disponible.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>

                {/* Card Crear */}
                <motion.div whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setErrorNombre(''); setEsDueno(false); setVista('nombre-sala'); }}
                  style={{
                    cursor: 'pointer', textAlign: 'left', color: 'white',
                    minHeight: '240px', padding: '28px',
                    background: 'rgba(10, 16, 22, 0.78)',
                    border: '1px solid rgba(255, 70, 85, 0.55)',
                    clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))'
                  }}>
                  <p style={{ color: '#FF4655', fontSize: '0.75rem', letterSpacing: '0.16em', margin: 0, textTransform: 'uppercase' }}>
                    Protocolo 01
                  </p>
                  <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '2.25rem', letterSpacing: '0.07em', margin: '18px 0 10px' }}>
                    CREAR SALA
                  </h2>
                  <p style={{ color: '#c2c8ce', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                    Abre una arena privada con tu propio nombre y espera la llegada de tu oponente.
                  </p>
                  <div style={{ height: '2px', marginTop: '28px', background: 'linear-gradient(to right, #FF4655, transparent)' }}/>
                </motion.div>

                {/* Card Unirse */}
                <motion.div whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setBusqueda(''); setMensajeEspera(''); setEsDueno(false); setVista('unirse'); }}
                  style={{
                    cursor: 'pointer', textAlign: 'left', color: 'white',
                    minHeight: '240px', padding: '28px',
                    background: 'rgba(10, 16, 22, 0.78)',
                    border: '1px solid rgba(255, 70, 85, 0.55)',
                    clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))'
                  }}>
                  <p style={{ color: '#FF4655', fontSize: '0.75rem', letterSpacing: '0.16em', margin: 0, textTransform: 'uppercase' }}>
                    Protocolo 02
                  </p>
                  <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '2.25rem', letterSpacing: '0.07em', margin: '18px 0 10px' }}>
                    UNIRSE A SALA
                  </h2>
                  <p style={{ color: '#c2c8ce', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                    Consulta las salas disponibles o busca directamente por nombre.
                  </p>
                  <div style={{ height: '2px', marginTop: '28px', background: 'linear-gradient(to right, #FF4655, transparent)' }}/>
                </motion.div>
              </div>
            </motion.section>
          )}

          {/* NOMBRE DE SALA */}
          {vista === 'nombre-sala' && (
            <motion.section key="nombre-sala"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
              style={{ width: 'min(440px, 100%)' }}>

              <div style={lineaRoja}/>
              <p style={{ color: '#FF4655', fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Protocolo 01
              </p>
              <h1 style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '3.5rem', letterSpacing: '0.07em', lineHeight: 0.95, margin: '0 0 32px' }}>
                CREAR SALA
              </h1>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
                <label style={{ color: '#768079', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  Nombre de la sala
                </label>
                <input
                  value={nombreSala}
                  onChange={e => { setNombreSala(e.target.value); setErrorNombre(''); }}
                  onKeyDown={e => e.key === 'Enter' && crearSala()}
                  placeholder="Ej: ArenaDeFuego"
                  maxLength={20}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = '#FF4655'}
                  onBlur={e => e.target.style.borderBottomColor = '#768079'}
                />
                <p style={{ color: '#768079', fontSize: '0.72rem', margin: '4px 0 0' }}>
                  El nombre se convertirá a mayúsculas. Máximo 20 caracteres.
                </p>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ color: '#768079', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '10px' }}>
                  Color de tu personaje
                </label>
                <div style={{ display: 'flex', gap: '14px' }}>
                  {COLORES_JUGADOR.map(c => (
                    <button key={c.id}
                      onClick={() => { setColorSeleccionado(c.id); setErrorNombre(''); }}
                      style={{
                        cursor: 'pointer', width: '68px', padding: '8px 4px 6px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: '6px',
                        border: colorSeleccionado === c.id ? '2px solid white' : '2px solid transparent',
                        boxShadow: colorSeleccionado === c.id ? `0 0 14px ${c.css}` : 'none',
                        transition: 'all 0.15s'
                      }}
                      title={c.nombre}
                      aria-label={c.nombre}
                    >
                      <SpritePersonaje color={c.id} />
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.css }} />
                    </button>
                  ))}
                </div>
              </div>

              {errorNombre && (
                <p style={{ color: '#FF4655', fontSize: '0.78rem', margin: '0 0 16px' }}>
                  {errorNombre}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={crearSala} className="btn-val" style={{ fontSize: '0.85rem' }}>
                  CREAR SALA
                </button>
                <button onClick={() => { setNombreSala(''); setErrorNombre(''); setColorSeleccionado(''); setVista('menu'); }}
                  className="btn-val-outline" style={{ fontSize: '0.76rem' }}>
                  VOLVER
                </button>
              </div>
            </motion.section>
          )}

          {/* ESPERANDO RIVAL */}
          {vista === 'crear' && (
            <motion.section key="crear"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
              style={{ width: 'min(440px, 100%)' }}>

              <div style={lineaRoja}/>
              <p style={{ color: '#FF4655', fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Sala "{salaId}"
              </p>
              <h1 style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '4rem', letterSpacing: '0.07em', lineHeight: 0.95, margin: 0 }}>
                ESPERANDO JUGADORES
              </h1>
              <p style={{ color: '#c2c8ce', fontSize: '1rem', lineHeight: 1.6, margin: '18px 0 8px' }}>
                {mensajeEspera || 'Esperando jugadores...'}
              </p>
              <p style={{ color: '#FF4655', fontFamily: "'Bebas Neue', cursive", fontSize: '1.3rem', letterSpacing: '0.08em', margin: '0 0 26px' }}>
                {jugadoresEnSala}/4 CONECTADOS
              </p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
                {[0,1,2,3].map(i => (
                  <motion.div key={i}
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                    style={{ width: '9px', height: '9px', background: '#FF4655' }}
                  />
                ))}
              </div>

              {esDueno && (
                <div style={{ marginBottom: '16px' }}>
                  <button onClick={iniciarPartida} disabled={jugadoresEnSala < 2}
                    className="btn-val" style={{
                      fontSize: '0.85rem',
                      opacity: jugadoresEnSala < 2 ? 0.4 : 1,
                      cursor: jugadoresEnSala < 2 ? 'not-allowed' : 'pointer'
                    }}>
                    INICIAR PARTIDA
                  </button>
                  {jugadoresEnSala < 2 && (
                    <p style={{ color: '#768079', fontSize: '0.72rem', margin: '8px 0 0' }}>
                      Necesitas al menos 2 jugadores para iniciar.
                    </p>
                  )}
                </div>
              )}

              <button onClick={() => { setNombreSala(''); setEsDueno(false); setVista('menu'); }}
                className="btn-val-outline" style={{ fontSize: '0.76rem' }}>
                CANCELAR
              </button>
            </motion.section>
          )}

          {/* LISTA DE SALAS */}
          {vista === 'unirse' && (
            <motion.section key="unirse"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
              style={{ width: 'min(720px, 100%)' }}>

              <div style={{ marginBottom: '26px' }}>
                <div style={lineaRoja}/>
                <p style={{ color: '#FF4655', fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                  Arena multijugador
                </p>
                <h1 style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '4rem', letterSpacing: '0.07em', lineHeight: 0.95, margin: 0 }}>
                  SALAS DISPONIBLES
                </h1>
              </div>

              {/* Buscador */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                <label style={{ color: '#768079', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  Buscar por nombre de sala
                </label>
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Ej: ArenaDeFuego"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderBottomColor = '#FF4655'}
                  onBlur={e => e.target.style.borderBottomColor = '#768079'}
                />
              </div>

              {/* Tabla */}
              <div style={{
                border: '1px solid rgba(255, 70, 85, 0.42)',
                background: 'rgba(10, 16, 22, 0.82)'
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.9fr',
                  gap: '12px', padding: '14px 20px',
                  borderBottom: '1px solid rgba(255, 70, 85, 0.28)',
                  color: '#c2c8ce', fontSize: '0.7rem',
                  letterSpacing: '0.13em', textTransform: 'uppercase'
                }}>
                  <span>Sala</span>
                  <span>Jugadores</span>
                  <span>Estado</span>
                </div>

                {salasFiltradas.length === 0 ? (
                  <div style={{ padding: '46px 24px', color: '#c2c8ce', textAlign: 'center' }}>
                    <p style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '1.7rem', letterSpacing: '0.08em', margin: 0 }}>
                      {busqueda ? 'SIN RESULTADOS' : 'SIN SALAS DISPONIBLES'}
                    </p>
                    <p style={{ fontSize: '0.9rem', margin: '10px 0 0' }}>
                      {busqueda ? `No hay salas con el nombre "${busqueda}"` : 'Crea una sala para iniciar una nueva partida.'}
                    </p>
                  </div>
                ) : (
                  salasFiltradas.map((sala) => (
                    <motion.button key={sala.id}
                      whileHover={{ backgroundColor: 'rgba(255, 70, 85, 0.12)' }}
                      onClick={() => elegirSalaParaUnirse(sala.id)}
                      style={{
                        width: '100%', cursor: 'pointer',
                        display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.9fr',
                        gap: '12px', alignItems: 'center',
                        padding: '18px 20px', color: 'white',
                        background: 'transparent', border: 'none',
                        borderTop: '1px solid rgba(255, 70, 85, 0.15)',
                        textAlign: 'left'
                      }}>
                      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '1.4rem', letterSpacing: '0.08em' }}>
                        {sala.id}
                      </span>
                      <span style={{ color: '#c2c8ce', fontSize: '0.9rem' }}>
                        {sala.jugadores}/4
                      </span>
                      <span style={{ color: '#FF4655', fontSize: '0.7rem', letterSpacing: '0.11em', textTransform: 'uppercase' }}>
                        Disponible
                      </span>
                    </motion.button>
                  ))
                )}
              </div>

              {mensajeEspera && (
                <p style={{ color: '#ff8b95', fontSize: '0.85rem', margin: '14px 0 0' }}>
                  {mensajeEspera}
                </p>
              )}

              <button onClick={() => { setBusqueda(''); setMensajeEspera(''); setVista('menu'); }}
                className="btn-val-outline" style={{ fontSize: '0.76rem', marginTop: '24px' }}>
                VOLVER
              </button>
            </motion.section>
          )}

          {/* ELEGIR COLOR PARA UNIRSE */}
          {vista === 'elegir-color-unirse' && (
            <motion.section key="elegir-color-unirse"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35 }}
              style={{ width: 'min(440px, 100%)' }}>

              <div style={lineaRoja}/>
              <p style={{ color: '#FF4655', fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Sala "{salaId}"
              </p>
              <h1 style={{ color: 'white', fontFamily: "'Bebas Neue', cursive", fontSize: '3.2rem', letterSpacing: '0.07em', lineHeight: 0.95, margin: '0 0 28px' }}>
                ELIGE TU COLOR
              </h1>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '14px' }}>
                  {COLORES_JUGADOR.map(c => {
                    const salaActual = salasFiltradas.find(s => s.id === salaId) || salas.find(s => s.id === salaId);
                    const tomado = salaActual?.coloresTomados?.includes(c.id);
                    return (
                      <button key={c.id}
                        disabled={tomado}
                        onClick={() => { setColorSeleccionado(c.id); setErrorNombre(''); }}
                        style={{
                          cursor: tomado ? 'not-allowed' : 'pointer',
                          width: '68px', padding: '8px 4px 6px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                          background: 'rgba(255,255,255,0.03)', borderRadius: '6px',
                          opacity: tomado ? 0.25 : 1,
                          border: colorSeleccionado === c.id ? '2px solid white' : '2px solid transparent',
                          boxShadow: colorSeleccionado === c.id ? `0 0 14px ${c.css}` : 'none',
                          transition: 'all 0.15s'
                        }}
                        title={tomado ? `${c.nombre} (ocupado)` : c.nombre}
                        aria-label={c.nombre}
                      >
                        <SpritePersonaje color={c.id} />
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.css }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorNombre && (
                <p style={{ color: '#FF4655', fontSize: '0.78rem', margin: '10px 0 0' }}>
                  {errorNombre}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                <button onClick={confirmarUnirse} className="btn-val" style={{ fontSize: '0.85rem' }}>
                  UNIRSE
                </button>
                <button onClick={() => { setColorSeleccionado(''); setErrorNombre(''); setVista('unirse'); }}
                  className="btn-val-outline" style={{ fontSize: '0.76rem' }}>
                  VOLVER
                </button>
              </div>
            </motion.section>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}