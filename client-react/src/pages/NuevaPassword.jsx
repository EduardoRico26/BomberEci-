import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

export default function NuevaPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirmar: '' });
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    if (!token) {
      setMensaje({ tipo: 'error', texto: 'Enlace inválido. Solicita uno nuevo.' });
      return;
    }
    if (form.password.length < 8) {
      setMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (form.password !== form.confirmar) {
      setMensaje({ tipo: 'error', texto: 'Las contraseñas no coinciden.' });
      return;
    }
    setCargando(true);
    try {
      const res = await axios.post('/auth/nueva-password', {
        token,
        password: form.password
      });
      setMensaje({ tipo: 'exito', texto: res.data.mensaje });
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.mensaje || 'Error al actualizar la contraseña.' });
    } finally {
      setCargando(false);
    }
  }

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
      width: '100vw', height: '100vh',
      position: 'relative', overflow: 'hidden',
      background: '#0f1923'
    }}>

      {/* Imagen de fondo */}
      <img src="/bg-login.png" alt="BomberEci Arena"
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'left center'
        }}
      />

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, transparent 30%, rgba(10,16,22,0.85) 55%, rgba(10,16,22,0.97) 70%)'
      }}/>

      {/* Overlay sutil */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(8, 12, 18, 0.35)', zIndex: 1
      }}/>

      {/* Formulario */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'absolute',
          right: '4%', top: '50%',
          transform: 'translateY(-50%)',
          width: '380px', zIndex: 10
        }}>

        {/* Título */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '3px', background: '#FF4655', marginBottom: '16px' }}/>
          <h1 style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: '3.5rem', color: 'white',
            letterSpacing: '0.08em', lineHeight: 1, marginBottom: '4px'
          }}>NUEVA</h1>
          <h2 style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: '1.8rem', color: '#FF4655', letterSpacing: '0.08em'
          }}>CONTRASEÑA</h2>
          <p style={{
            fontSize: '0.75rem', color: '#768079',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '10px'
          }}>Escribe tu nueva contraseña</p>
        </div>

        {/* Campos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {mensaje && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize: '0.82rem', padding: '10px 14px',
                borderLeft: `2px solid ${mensaje.tipo === 'exito' ? '#22c55e' : '#FF4655'}`,
                background: mensaje.tipo === 'exito' ? 'rgba(34,197,94,0.1)' : 'rgba(255,70,85,0.1)',
                color: mensaje.tipo === 'exito' ? '#4ade80' : '#ff6b78'
              }}>
              {mensaje.texto}
            </motion.div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.7rem', color: '#768079', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              placeholder="Mínimo 8 caracteres"
              style={inputStyle}
              onFocus={e => e.target.style.borderBottomColor = '#FF4655'}
              onBlur={e => e.target.style.borderBottomColor = '#768079'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.7rem', color: '#768079', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={form.confirmar}
              onChange={e => setForm({ ...form, confirmar: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              placeholder="Repite tu contraseña"
              style={inputStyle}
              onFocus={e => e.target.style.borderBottomColor = '#FF4655'}
              onBlur={e => e.target.style.borderBottomColor = '#768079'}
            />
          </div>

          <button
            onClick={enviar}
            disabled={cargando || !token}
            className="btn-val"
            style={{ width: '100%', fontSize: '1.1rem', padding: '16px', marginTop: '4px' }}>
            {cargando ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA'}
          </button>
        </div>

        <div style={{ marginTop: '32px', height: '1px', background: 'linear-gradient(to right, #FF4655, transparent)' }}/>
      </motion.div>
    </div>
  );
}