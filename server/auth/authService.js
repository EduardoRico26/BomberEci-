const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const db = require('../db/usuariosDB');

const SALT_ROUNDS = 12;

// Configurar el transportador de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generar token aleatorio seguro
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Enviar email de verificación
async function enviarEmailVerificacion(correo, nombre, token) {
  const url = `http://localhost:${process.env.PORT}/auth/verificar/${token}`;
  await transporter.sendMail({
    from: `"BomberEci Arena" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: 'Verifica tu correo - BomberEci Arena',
    html: `
      <div style="font-family:Arial;max-width:500px;margin:auto;background:#1a1a2e;color:#eee;padding:32px;border-radius:12px">
        <h2 style="color:#e94560">💣 BomberEci Arena</h2>
        <p>Hola <strong>${nombre}</strong>, gracias por registrarte.</p>
        <p>Haz clic en el botón para verificar tu correo:</p>
        <a href="${url}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#e94560;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
          Verificar correo
        </a>
        <p style="color:#aaa;font-size:0.85rem">Si no creaste esta cuenta, ignora este mensaje.</p>
      </div>
    `
  });
}

// Enviar email de recuperación de contraseña
async function enviarEmailRecuperacion(correo, nombre, token) {
  const url = `http://localhost:${process.env.PORT}/auth/nueva-password/${token}`;
  await transporter.sendMail({
    from: `"BomberEci Arena" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: 'Recuperar contraseña - BomberEci Arena',
    html: `
      <div style="font-family:Arial;max-width:500px;margin:auto;background:#1a1a2e;color:#eee;padding:32px;border-radius:12px">
        <h2 style="color:#e94560">💣 BomberEci Arena</h2>
        <p>Hola <strong>${nombre}</strong>, recibimos una solicitud para recuperar tu contraseña.</p>
        <p>Haz clic en el botón para crear una nueva contraseña:</p>
        <a href="${url}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#e94560;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
          Recuperar contraseña
        </a>
        <p style="color:#aaa;font-size:0.85rem">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
      </div>
    `
  });
}

// REGISTRO
async function registrar({ nombre, correo, password }) {
  // Validar formato de correo
  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regexCorreo.test(correo)) {
    throw { status: 400, mensaje: 'El formato del correo no es válido.' };
  }

  // Validar longitud de contraseña
  if (password.length < 8) {
    throw { status: 400, mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  // Verificar si el correo ya existe
  const usuarioExistente = await db.buscarPorCorreo(correo);
  if (usuarioExistente) {
    throw { status: 409, mensaje: 'Ya existe una cuenta con ese correo.' };
  }

  // Hashear contraseña
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Generar token de verificación
  const tokenVerificacion = generarToken();

  // Crear usuario en la base de datos
  const usuario = await db.crearUsuario({
    nombre,
    correo,
    passwordHash,
    tokenVerificacion
  });

  // Enviar email de verificación
  await enviarEmailVerificacion(correo, nombre, tokenVerificacion);

  return usuario;
}

// LOGIN
async function login({ correo, password }) {
  // Buscar usuario
  const usuario = await db.buscarPorCorreo(correo);

  // Mensaje genérico para no revelar si el correo existe
  const errorGenerico = { status: 401, mensaje: 'Credenciales incorrectas.' };

  if (!usuario) throw errorGenerico;

  // Verificar si está bloqueado
  if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta)) {
    const minutos = Math.ceil((new Date(usuario.bloqueado_hasta) - new Date()) / 60000);
    throw { status: 429, mensaje: `Cuenta bloqueada temporalmente. Intenta en ${minutos} minutos.` };
  }

  // Verificar contraseña
  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    await db.registrarIntentoFallido(correo);
    throw errorGenerico;
  }

  // Verificar si el correo fue verificado
  if (!usuario.verificado) {
    throw { status: 403, mensaje: 'Debes verificar tu correo antes de ingresar.' };
  }

  // Resetear intentos fallidos
  await db.resetearIntentos(correo);

  // Generar JWT
  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return { token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } };
}

// VERIFICAR CORREO
async function verificarCorreo(token) {
  const usuario = await db.verificarCorreo(token);
  if (!usuario) {
    throw { status: 400, mensaje: 'Token de verificación inválido o expirado.' };
  }
  return usuario;
}

// SOLICITAR RECUPERACIÓN DE CONTRASEÑA
async function solicitarRecuperacion(correo) {
  const usuario = await db.buscarPorCorreo(correo);
  // No revelar si el correo existe o no
  if (!usuario) return;

  const token = generarToken();
  await db.guardarTokenRecuperacion(correo, token);
  await enviarEmailRecuperacion(correo, usuario.nombre, token);
}

// RESETEAR CONTRASEÑA
async function resetearPassword(token, nuevaPassword) {
  if (nuevaPassword.length < 8) {
    throw { status: 400, mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const usuario = await db.buscarPorTokenRecuperacion(token);
  if (!usuario) {
    throw { status: 400, mensaje: 'Token inválido o expirado.' };
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, SALT_ROUNDS);
  await db.actualizarPassword(usuario.id, passwordHash);
}

module.exports = {
  registrar,
  login,
  verificarCorreo,
  solicitarRecuperacion,
  resetearPassword
};