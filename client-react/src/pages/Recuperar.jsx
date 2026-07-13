import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

export default function Recuperar() {
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    if (!correo) {
      setMensaje({
        tipo: 'error',
        texto: 'Ingresa tu correo electrónico.'
      });
      return;
    }

    setCargando(true);

    try {
      const res = await axios.post('/auth/recuperar', { correo });

      setMensaje({
        tipo: 'exito',
        texto: res.data.mensaje
      });
    } catch {
      setMensaje({
        tipo: 'error',
        texto: 'Error de conexión. Intenta nuevamente.'
      });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a1016'
      }}
    >
      {/* Imagen completa de fondo */}
      <img
        src="/bg-login.png"
        alt="BomberEci Arena"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
          objectPosition: 'center center'
        }}
      />

      {/* Contenido en la misma ubicación del Login */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'absolute',
          right: '6%',
          top: '25%',
          transform: 'translateY(-50%)',
          width: 'min(440px, calc(100vw - 48px))',
          zIndex: 10
        }}
      >
        {/* Título */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              width: '58px',
              height: '4px',
              background: '#FF4655',
              marginBottom: '18px'
            }}
          />

          <h1
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: '4rem',
              color: 'white',
              letterSpacing: '0.08em',
              lineHeight: 1,
              margin: 0
            }}
          >
            RECUPERAR
          </h1>

          <h2
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: '2rem',
              color: '#FF4655',
              letterSpacing: '0.08em',
              margin: '4px 0 0'
            }}
          >
            CONTRASEÑA
          </h2>

          <p
            style={{
              fontSize: '0.88rem',
              color: '#c2c8ce',
              lineHeight: 1.6,
              marginTop: '14px'
            }}
          >
            Ingresa tu correo y te enviaremos un enlace para recuperar tu contraseña.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '22px'
          }}
        >
          {mensaje && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize: '0.9rem',
                padding: '12px 16px',
                borderLeft: `3px solid ${
                  mensaje.tipo === 'exito' ? '#22c55e' : '#FF4655'
                }`,
                background:
                  mensaje.tipo === 'exito'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(255, 70, 85, 0.15)',
                color: mensaje.tipo === 'exito' ? '#4ade80' : '#ff6b78'
              }}
            >
              {mensaje.texto}
            </motion.div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <label
              style={{
                fontSize: '0.78rem',
                color: '#c2c8ce',
                textTransform: 'uppercase',
                letterSpacing: '0.15em'
              }}
            >
              Correo electrónico
            </label>

            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="tucorreo@gmail.com"
              className="input-val"
              style={{
                fontSize: '1.1rem',
                padding: '18px 8px'
              }}
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={enviar}
            disabled={cargando}
            className="btn-val"
            style={{
              width: '100%',
              fontSize: '1.15rem',
              padding: '18px'
            }}
          >
            {cargando ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
          </motion.button>

          <Link
            to="/login"
            style={{
              color: '#c2c8ce',
              textDecoration: 'none',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#c2c8ce')}
          >
            ← Volver al inicio de sesión
          </Link>
        </div>

        <div
          style={{
            marginTop: '32px',
            height: '1px',
            background: 'linear-gradient(to right, #FF4655, transparent)'
          }}
        />
      </motion.div>
    </div>
  );
}