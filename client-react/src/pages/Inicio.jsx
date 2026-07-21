import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Inicio() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  async function cerrarSesion() {
    await logout();
    navigate('/login');
  }

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-10 md:block md:px-0 md:py-0"
      style={{
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#0a1016'
      }}
    >
      {/* Misma imagen de fondo del Login, sin degradado ni división */}
      <img
        src="/bg-login.png"
        alt="BomberEci Arena"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center'
        }}
      />

      {/* Fondo oscuro para legibilidad cuando el panel queda centrado en móvil */}
      <div className="block md:hidden" style={{ position: 'absolute', inset: 0, background: 'rgba(10,16,22,0.82)' }} />

      {/* Botón para cerrar sesión */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={cerrarSesion}
        className="btn-val-outline"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          fontSize: '0.7rem',
          padding: '10px 16px'
        }}
      >
        CERRAR SESIÓN
      </motion.button>

      {/* Contenido en la misma posición del formulario de Login */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-[440px] mx-auto mt-16 md:mt-0 md:absolute md:right-[8%] md:top-[25%] md:w-[min(440px,36vw)] md:min-w-[320px] md:mx-0"
      >
        <div style={{ marginBottom: '36px' }}>
          <div
            style={{
              width: '58px',
              height: '4px',
              background: '#FF4655',
              marginBottom: '18px'
            }}
          />

          <p
            style={{
              fontSize: '0.82rem',
              color: '#FF4655',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              margin: '0 0 12px'
            }}
          >
            Bienvenido de vuelta
          </p>

          <h1
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 'clamp(2.4rem, 9vw, 4rem)',
              color: 'white',
              letterSpacing: '0.08em',
              lineHeight: 1,
              margin: 0
            }}
          >
            {usuario?.nombre?.toUpperCase() || 'JUGADOR'}
          </h1>
        </div>

        <p
          style={{
            fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
            color: '#c2c8ce',
            lineHeight: 1.6,
            marginBottom: '28px'
          }}
        >
          Entra a la arena, coloca tus bombas y elimina a tus rivales.
          Solo uno puede sobrevivir.
        </p>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/lobby')}
          className="btn-val"
          style={{
            width: '100%',
            fontSize: 'clamp(1rem, 3vw, 1.2rem)',
            padding: 'clamp(14px, 3vw, 18px)'
          }}
        >
          ▶ JUGAR
        </motion.button>

        <div
          style={{
            marginTop: '36px',
            height: '1px',
            background: 'linear-gradient(to right, #FF4655, transparent)'
          }}
        />
      </motion.div>
    </div>
  );
}