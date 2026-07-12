import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import PhaserGame from '../game/PhaserGame';

export default function Lobby() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [vista, setVista] = useState('menu');
  const [salas, setSalas] = useState([]);
  const [mensajeEspera, setMensajeEspera] = useState('');
  const [estadoInicial, setEstadoInicial] = useState(null);
  const [salaId, setSalaId] = useState('');

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => socket.emit('pedir_salas'));
    socket.on('lista_salas', setSalas);
    socket.on('sala_creada', ({ salaId }) => {
      setSalaId(salaId);
      setMensajeEspera(`Sala ${salaId} creada. Esperando rival...`);
    });
    socket.on('iniciar_partida', (estado) => {
      setEstadoInicial(estado);
      setVista('juego');
    });
    socket.on('error_sala', setMensajeEspera);
    const intervalo = setInterval(() => socket.emit('pedir_salas'), 2000);
    return () => {
      clearInterval(intervalo);
      socket.off('connect'); socket.off('lista_salas');
      socket.off('sala_creada'); socket.off('iniciar_partida');
      socket.off('error_sala'); socket.disconnect();
    };
  }, []);

  function crearSala() {
    socket.emit('crear_sala', { nombre: usuario.nombre });
    setVista('crear');
  }

  function unirseSala(id) {
    socket.emit('unirse_sala', { salaId: id, nombre: usuario.nombre });
    setSalaId(id);
  }

  if (vista === 'juego') {
    return <PhaserGame estadoInicial={estadoInicial} socket={socket} miNombre={usuario.nombre} salaId={salaId}/>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1923' }}>

      {/* Header estilo Valorant */}
      <div className="flex items-center justify-between px-10 py-5 border-b"
        style={{ borderColor: 'rgba(255,70,85,0.2)' }}>
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain"/>
          <div>
            <p className="font-val text-xl text-white">BOMBERECI ARENA</p>
            <p className="text-xs uppercase tracking-widest" style={{ color: '#FF4655' }}>
              SELECCIÓN DE PARTIDA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest" style={{ color: '#768079' }}>Jugador</p>
            <p className="font-val text-lg text-white">{usuario?.nombre?.toUpperCase()}</p>
          </div>
          <button onClick={async () => { await logout(); navigate('/login'); }}
            className="btn-val-outline text-xs">
            SALIR
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex items-center justify-center px-10">
        <AnimatePresence mode="wait">

          {/* MENÚ PRINCIPAL */}
          {vista === 'menu' && (
            <motion.div key="menu"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-10 w-full max-w-3xl">

              <div className="text-center">
                <span className="red-line mx-auto mb-4"/>
                <h2 className="font-val text-5xl text-white mt-4">¿QUÉ DESEAS HACER?</h2>
              </div>

              <div className="grid grid-cols-2 gap-6 w-full">
                {/* Crear sala */}
                <motion.div
                  whileHover={{ borderColor: '#FF4655', y: -4 }}
                  onClick={crearSala}
                  className="relative cursor-pointer p-8 flex flex-col gap-4 transition-all duration-200"
                  style={{
                    background: 'rgba(255,70,85,0.05)',
                    border: '1px solid rgba(255,70,85,0.3)',
                    clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                  }}>
                  <span className="text-5xl">🏠</span>
                  <div>
                    <h3 className="font-val text-2xl text-white">CREAR SALA</h3>
                    <p className="text-sm mt-1" style={{ color: '#768079' }}>
                      Crea una sala y espera a que un rival se una a tu partida
                    </p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: 'linear-gradient(to right, #FF4655, transparent)' }}/>
                </motion.div>

                {/* Unirse */}
                <motion.div
                  whileHover={{ borderColor: '#FF4655', y: -4 }}
                  onClick={() => setVista('unirse')}
                  className="relative cursor-pointer p-8 flex flex-col gap-4 transition-all duration-200"
                  style={{
                    background: 'rgba(255,70,85,0.05)',
                    border: '1px solid rgba(255,70,85,0.3)',
                    clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                  }}>
                  <span className="text-5xl">🚀</span>
                  <div>
                    <h3 className="font-val text-2xl text-white">UNIRSE A SALA</h3>
                    <p className="text-sm mt-1" style={{ color: '#768079' }}>
                      Busca una sala disponible y únete a la batalla
                    </p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: 'linear-gradient(to right, #FF4655, transparent)' }}/>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ESPERANDO */}
          {vista === 'crear' && (
            <motion.div key="crear"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8 text-center">
              <span className="red-line mx-auto"/>
              <h2 className="font-val text-4xl text-white mt-4">BUSCANDO RIVAL</h2>
              <p style={{ color: '#768079' }}>{mensajeEspera}</p>
              <div className="flex gap-2">
                {[0,1,2,3].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full"
                    style={{ background: '#FF4655' }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}/>
                ))}
              </div>
              <button onClick={() => setVista('menu')} className="btn-val-outline text-xs mt-4">
                CANCELAR
              </button>
            </motion.div>
          )}

          {/* LISTA DE SALAS */}
          {vista === 'unirse' && (
            <motion.div key="unirse"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-xl flex flex-col gap-6">
              <div>
                <span className="red-line mb-4"/>
                <h2 className="font-val text-4xl text-white mt-4">SALAS DISPONIBLES</h2>
              </div>

              {/* Tabla estilo Valorant */}
              <div className="border" style={{ borderColor: 'rgba(255,70,85,0.2)' }}>
                <div className="flex justify-between px-5 py-3 text-xs uppercase tracking-widest"
                  style={{ background: 'rgba(255,70,85,0.1)', color: '#768079' }}>
                  <span>Sala</span>
                  <span>Jugadores</span>
                  <span>Estado</span>
                </div>
                {salas.length === 0 ? (
                  <div className="px-5 py-10 text-center" style={{ color: '#768079' }}>
                    <p className="font-val text-xl">SIN SALAS DISPONIBLES</p>
                    <p className="text-sm mt-2">Crea una sala y espera a alguien</p>
                  </div>
                ) : (
                  salas.map((s, i) => (
                    <motion.div key={s.id}
                      whileHover={{ background: 'rgba(255,70,85,0.1)' }}
                      onClick={() => unirseSala(s.id)}
                      className="flex justify-between items-center px-5 py-4 cursor-pointer border-t transition-colors"
                      style={{ borderColor: 'rgba(255,70,85,0.1)' }}>
                      <span className="font-val text-lg text-white">💣 {s.id.toUpperCase()}</span>
                      <span style={{ color: '#768079' }}>{s.jugadores}/2</span>
                      <span className="text-xs uppercase tracking-widest px-3 py-1"
                        style={{ background: 'rgba(255,70,85,0.15)', color: '#FF4655' }}>
                        DISPONIBLE
                      </span>
                    </motion.div>
                  ))
                )}
              </div>

              <button onClick={() => setVista('menu')} className="btn-val-outline text-xs self-start">
                ← VOLVER
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}