const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authService = require('./authService');
const { verificarToken } = require('./authMiddleware');
const metrics = require('../metrics');
const logger = require('../logger');

// Rate limiting para login — máximo 5 intentos por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true, 
  legacyHeaders: false
});

// Rate limiting para registro
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { mensaje: 'Demasiados registros desde esta IP.' }
});

// POST /auth/registro
router.post('/registro', registroLimiter, async (req, res) => {
  try {
    const { nombre, correo, password } = req.body;
    if (!nombre || !correo || !password) {
      return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
    }
    const usuario = await authService.registrar({ nombre, correo, password });
    console.log('Usuario registrado, incrementando métrica...');
    metrics.jugadoresRegistrados.inc();
    console.log('Métrica incrementada correctamente');
    res.status(201).json({
      mensaje: 'Cuenta creada. Revisa tu correo para verificarla.',
      usuario
    });
  } catch (err) {
    console.log('Error en registro:', err);
    res.status(err.status || 500).json({ mensaje: err.mensaje || 'Error interno del servidor.' });
  }
});

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { correo, password } = req.body;
    if (!correo || !password) {
      return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios.' });
    }
    const { token, usuario } = await authService.login({ correo, password });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ mensaje: '¡Bienvenido a BomberEci Arena!', usuario });
  } catch (err) {
    res.status(err.status || 500).json({ mensaje: err.mensaje || 'Error interno del servidor.' });
  }
});

// GET /auth/verificar/:token
router.get('/verificar/:token', async (req, res) => {
  try {
    await authService.verificarCorreo(req.params.token);
    res.redirect('http://alb-bombereci-457767058.us-east-1.elb.amazonaws.com/login?verificado=true');
  } catch (err) {
    res.redirect('http://alb-bombereci-457767058.us-east-1.elb.amazonaws.com/login?error=token-invalido');
  }
});

// POST /auth/recuperar
router.post('/recuperar', async (req, res) => {
  try {
    const { correo } = req.body;
    await authService.solicitarRecuperacion(correo);
    res.json({ mensaje: 'Si ese correo está registrado, recibirás un enlace de recuperación.' });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// GET /auth/nueva-password/:token
router.get('/nueva-password/:token', (req, res) => {
  res.redirect(`/nueva-password?token=${req.params.token}`);
});

// POST /auth/nueva-password
router.post('/nueva-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ mensaje: 'Token y contraseña son obligatorios.' });
    }
    await authService.resetearPassword(token, password);
    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    res.status(err.status || 500).json({ mensaje: err.mensaje || 'Error interno del servidor.' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ mensaje: 'Sesión cerrada correctamente.' });
});

// GET /auth/perfil (ruta protegida)
router.get('/perfil', verificarToken, (req, res) => {
  res.json({ usuario: req.usuario });
});

// POST /auth/reenviar-verificacion
router.post('/reenviar-verificacion', async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.status(400).json({ mensaje: 'El correo es obligatorio.' });
    }
    await authService.reenviarVerificacion(correo);
    res.json({ mensaje: 'Correo de verificación reenviado. Revisa tu bandeja.' });
  } catch (err) {
    res.status(err.status || 500).json({ mensaje: err.mensaje || 'Error interno.' });
  }
});

module.exports = router;
