import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

export default function Registro() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    password: '',
    confirmar: ''
  });

  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  function cambiar(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

    setErrores({
      ...errores,
      [e.target.name]: ''
    });
  }

  function validar() {
    const nuevos = {};

    if (form.nombre.length < 3) {
      nuevos.nombre = 'Mínimo 3 caracteres.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      nuevos.correo = 'Correo no válido.';
    }

    if (form.password.length < 8) {
      nuevos.password = 'Mínimo 8 caracteres.';
    }

    if (form.password !== form.confirmar) {
      nuevos.confirmar = 'Las contraseñas no coinciden.';
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function enviar() {
    if (!validar()) return;

    setCargando(true);

    try {
      const res = await axios.post('/auth/registro', {
        nombre: form.nombre,
        correo: form.correo,
        password: form.password
      });

      setMensaje({
        tipo: 'exito',
        texto: res.data.mensaje
      });

      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.response?.data?.mensaje || 'Error al registrarse.'
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
            objectPosition: 'center center'
          }}
        />
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
        className="w-full max-w-[440px]"
      >
        {/* Título */}
        <div style={{ marginBottom: '28px' }}>
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
              fontSize: 'clamp(2.4rem, 8vw, 4rem)',
              color: 'white',
              letterSpacing: '0.08em',
              lineHeight: 1,
              margin: 0
            }}
          >
            CREAR CUENTA
          </h1>

          <p
            style={{
              fontSize: '0.82rem',
              color: '#c2c8ce',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginTop: '12px'
            }}
          >
            Únete a la arena y comienza a jugar
          </p>
        </div>

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
              Nombre de jugador
            </label>

            <input
              name="nombre"
              value={form.nombre}
              onChange={cambiar}
              placeholder="Ej: Bombero123"
              className="input-val"
              style={{ fontSize: '1rem', padding: '15px 8px' }}
            />

            {errores.nombre && (
              <span style={{ fontSize: '0.8rem', color: '#FF4655' }}>
                {errores.nombre}
              </span>
            )}
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
                color: '#c2c8ce',
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
              placeholder="tucorreo@gmail.com"
              className="input-val"
              style={{ fontSize: '1rem', padding: '15px 8px' }}
            />

            {errores.correo && (
              <span style={{ fontSize: '0.8rem', color: '#FF4655' }}>
                {errores.correo}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '50%'
              }}
            >
              <label
                style={{
                  fontSize: '0.78rem',
                  color: '#c2c8ce',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em'
                }}
              >
                Contraseña
              </label>

              <input
                name="password"
                type="password"
                value={form.password}
                onChange={cambiar}
                placeholder="Mínimo 8"
                className="input-val"
                style={{ fontSize: '1rem', padding: '15px 8px' }}
              />

              {errores.password && (
                <span style={{ fontSize: '0.8rem', color: '#FF4655' }}>
                  {errores.password}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '50%'
              }}
            >
              <label
                style={{
                  fontSize: '0.78rem',
                  color: '#c2c8ce',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em'
                }}
              >
                Confirmar
              </label>

              <input
                name="confirmar"
                type="password"
                value={form.confirmar}
                onChange={cambiar}
                placeholder="Repite clave"
                className="input-val"
                style={{ fontSize: '1rem', padding: '15px 8px' }}
              />

              {errores.confirmar && (
                <span style={{ fontSize: '0.8rem', color: '#FF4655' }}>
                  {errores.confirmar}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={enviar}
            disabled={cargando}
            className="btn-val"
            style={{
              width: '100%',
              fontSize: '1.15rem',
              padding: '17px',
              marginTop: '4px'
            }}
          >
            {cargando ? 'CREANDO CUENTA...' : 'CREAR CUENTA'}
          </button>

          <p
            style={{
              fontSize: '0.76rem',
              color: '#c2c8ce',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              style={{
                color: '#FF4655',
                textDecoration: 'none'
              }}
            >
              Inicia sesión
            </Link>
          </p>
        </div>

        <div
          style={{
            marginTop: '28px',
            height: '1px',
            background: 'linear-gradient(to right, #FF4655, transparent)'
          }}
        />
      </motion.div>
      </div>
    </div>
  );
}