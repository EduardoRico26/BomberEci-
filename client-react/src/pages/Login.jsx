import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    correo: '',
    password: ''
  });

  const [mensaje, setMensaje] = useState(
    searchParams.get('verificado') === 'true'
      ? { tipo: 'exito', texto: '¡Correo verificado! Ya puedes iniciar sesión.' }
      : null
  );

  const [cargando, setCargando] = useState(false);

  function cambiar(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  async function enviar() {
    if (!form.correo || !form.password) {
      setMensaje({
        tipo: 'error',
        texto: 'Completa todos los campos.'
      });
      return;
    }

    setCargando(true);

    try {
      await login(form.correo, form.password);
      navigate('/inicio');
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.response?.data?.mensaje || 'Credenciales incorrectas.'
      });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex' }}>

      {/* Columna izquierda (60%): imagen decorativa, oculta en móvil (<768px) */}
      <div
        className="hidden md:block md:w-[60%] md:flex-shrink-0"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <img
          src="/bg-login.png"
          alt="BomberEci Arena"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
            objectPosition: 'left center'
          }}
        />
        {/* Oscurece el borde derecho de la imagen para una transición suave hacia la columna del formulario */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to right, transparent 70%, #0a1016 100%)'
          }}
        />
      </div>

      {/* Columna derecha (40% desktop / 100% móvil): formulario centrado horizontal y verticalmente */}
      <div
        className="w-full md:w-[40%] md:flex-shrink-0"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          padding: '40px 24px',
          background: '#0a1016'
        }}
      >
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[360px]"
      >
        {/* Título */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              width: '46px',
              height: '3px',
              background: '#FF4655',
              marginBottom: '14px'
            }}
          />

          <h1
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 'clamp(2rem, 6vw, 2.9rem)',
              color: 'white',
              letterSpacing: '0.08em',
              lineHeight: 1,
              margin: 0
            }}
          >
            BOMBERECI
          </h1>

          <h2
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 'clamp(1.1rem, 3.5vw, 1.45rem)',
              color: '#FF4655',
              letterSpacing: '0.08em',
              margin: '2px 0 0'
            }}
          >
            ARENA
          </h2>

          <p
            style={{
              fontSize: '0.76rem',
              color: '#9aa4ad',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginTop: '9px'
            }}
          >
            Inicia sesión para jugar
          </p>
        </div>

        {/* Campos */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          
          {mensaje && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <div
              style={{
                fontSize: '0.82rem',
                padding: '9px 13px',
                borderLeft: `3px solid ${
                  mensaje.tipo === 'exito' ? '#22c55e' : '#FF4655'
                }`,
                background:
                  mensaje.tipo === 'exito'
                    ? 'rgba(34,197,94,0.1)'
                    : 'rgba(255,70,85,0.1)',
                color: mensaje.tipo === 'exito' ? '#4ade80' : '#ff6b78'
              }}
            >
              {mensaje.texto}
            </div>

              {mensaje.texto?.toLowerCase().includes('verificar') && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/auth/reenviar-verificacion', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ correo: form.correo })
                      });
                      const data = await res.json();
                      setMensaje({ tipo: 'exito', texto: data.mensaje });
                    } catch {
                      setMensaje({ tipo: 'error', texto: 'Error al reenviar. Intenta de nuevo.' });
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FF4655',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    textAlign: 'left'
                  }}
                >
                  Reenviar correo de verificación
                </button>
              )}
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
                fontSize: '0.7rem',
                color: '#9aa4ad',
                textTransform: 'uppercase',
                letterSpacing: '0.15em'
              }}
            >
              Correo electrónico
            </label>

            <input
              name="correo"
              type="email"
              value={form.correo}
              onChange={cambiar}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="tucorreo@gmail.com"
              className="input-val"
              style={{
                fontSize: '0.95rem',
                padding: '13px 8px'
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <label
              style={{
                fontSize: '0.7rem',
                color: '#9aa4ad',
                textTransform: 'uppercase',
                letterSpacing: '0.15em'
              }}
            >
              Contraseña
            </label>

            <input
              name="password"
              type="password"
              value={form.password}
              onChange={cambiar}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="••••••••"
              className="input-val"
              style={{
                fontSize: '0.95rem',
                padding: '13px 8px'
              }}
            />
          </div>

          <button
            onClick={enviar}
            disabled={cargando}
            className="btn-val"
            style={{
              width: '100%',
              fontSize: '1rem',
              padding: '13px',
              marginTop: '2px'
            }}
          >
            {cargando ? 'INICIANDO...' : 'INICIAR SESIÓN'}
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            <Link
              to="/registro"
              style={{ color: '#9aa4ad', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa4ad')}
            >
              Crear cuenta
            </Link>

            <Link
              to="/recuperar"
              style={{
                color: '#9aa4ad',
                textDecoration: 'none',
                textAlign: 'right'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa4ad')}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <div
          style={{
            marginTop: '24px',
            height: '1px',
            background: 'linear-gradient(to right, #FF4655, transparent)'
          }}
        />
      </motion.div>
      </div>
    </div>
  );
}