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
      {/* Fondo completo sin recortar la imagen: oculto en móvil (<768px) para dejar solo el formulario */}
      <img
        src="/bg-login.png"
        alt="BomberEci Arena"
        className="hidden md:block"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'left center'
        }}
      />


      {/* Oscurece la parte derecha para mejorar la lectura */}
      <div
        className="hidden md:block"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, transparent 60%, rgba(10,16,22,0.08) 100%)'
        }}
      />

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-[440px] mx-auto max-h-[90vh] overflow-y-auto md:absolute md:right-[6%] md:top-[62%] md:-translate-y-1/2 md:w-[min(440px,36vw)] md:min-w-[320px] md:mx-0"
      >
        {/* Título */}
        <div style={{ marginBottom: '36px' }}>
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
              fontSize: 'clamp(2.6rem, 9vw, 4rem)',
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
              fontSize: 'clamp(1.4rem, 5vw, 2rem)',
              color: '#FF4655',
              letterSpacing: '0.08em',
              margin: '4px 0 0'
            }}
          >
            ARENA
          </h2>

          <p
            style={{
              fontSize: '0.82rem',
              color: '#9aa4ad',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginTop: '12px'
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
            gap: '28px'
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
                fontSize: '0.9rem',
                padding: '12px 16px',
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
                fontSize: '0.78rem',
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
                fontSize: '1.1rem',
                padding: '18px 8px'
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
                fontSize: '0.78rem',
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
                fontSize: '1.1rem',
                padding: '18px 8px'
              }}
            />
          </div>

          <button
            onClick={enviar}
            disabled={cargando}
            className="btn-val"
            style={{
              width: '100%',
              fontSize: '1.2rem',
              padding: '18px',
              marginTop: '6px'
            }}
          >
            {cargando ? 'INICIANDO...' : 'INICIAR SESIÓN'}
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              fontSize: '0.76rem',
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
            marginTop: '36px',
            height: '1px',
            background: 'linear-gradient(to right, #FF4655, transparent)'
          }}
        />
      </motion.div>
    </div>
  );
}