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
  const url = `${process.env.APP_URL}:4517/auth/verificar/${token}`;
  await transporter.sendMail({
    from: `"BomberEci Arena" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: 'Verifica tu correo - BomberEci Arena',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin:0;padding:0;background:#0a0e14;font-family:'Rajdhani',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e14;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

                <!-- Línea roja superior -->
                <tr>
                  <td style="height:3px;background:linear-gradient(to right,#FF4655,transparent);"></td>
                </tr>

                <!-- Contenido principal -->
                <tr>
                  <td style="background:#0f1923;border:1px solid rgba(255,70,85,0.25);border-top:none;padding:48px 40px;">

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:8px;">
                          <div style="width:40px;height:3px;background:#FF4655;margin-bottom:20px;"></div>
                          <p style="margin:0;color:#FF4655;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:600;">
                            BOMBERECI ARENA
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:32px;">
                          <h1 style="margin:8px 0 0;color:#ffffff;font-size:36px;letter-spacing:3px;text-transform:uppercase;font-weight:700;line-height:1;">
                            VERIFICAR
                          </h1>
                          <h1 style="margin:0;color:#FF4655;font-size:36px;letter-spacing:3px;text-transform:uppercase;font-weight:700;line-height:1;">
                            CORREO
                          </h1>
                        </td>
                      </tr>
                    </table>

                    <!-- Separador -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="height:1px;background:linear-gradient(to right,rgba(255,70,85,0.4),transparent);"></td>
                      </tr>
                    </table>

                    <!-- Mensaje -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <p style="margin:0;color:#c2c8ce;font-size:15px;line-height:1.7;letter-spacing:0.5px;">
                            Hola <strong style="color:#ffffff;">${nombre}</strong>,
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:36px;">
                          <p style="margin:0;color:#c2c8ce;font-size:15px;line-height:1.7;letter-spacing:0.5px;">
                            Gracias por registrarte en BomberEci Arena.
                            Para activar tu cuenta y comenzar a jugar,
                            verifica tu correo electronico haciendo clic en el boton.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Botón -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                      <tr>
                        <td>
                          <a href="${url}"
                            style="display:inline-block;background:#FF4655;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:4px;text-transform:uppercase;padding:16px 36px;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));">
                            VERIFICAR CORREO
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Separador -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="height:1px;background:linear-gradient(to right,rgba(255,70,85,0.4),transparent);"></td>
                      </tr>
                    </table>

                    <!-- Aviso -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;color:#768079;font-size:12px;line-height:1.6;letter-spacing:0.5px;">
                            Si no creaste esta cuenta, ignora este mensaje.
                            Nadie podra acceder a tu informacion sin verificar este correo.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 40px;border:1px solid rgba(255,70,85,0.15);border-top:none;background:#0a0e14;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;color:#768079;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
                            BOMBERECI ARENA — VERIFICACION DE CUENTA
                          </p>
                        </td>
                        <td align="right">
                          <p style="margin:0;color:#FF4655;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
                            CONFIDENCIAL
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Línea roja inferior -->
                <tr>
                  <td style="height:3px;background:linear-gradient(to right,#FF4655,transparent);"></td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  });
}

// Enviar email de recuperación de contraseña
async function enviarEmailRecuperacion(correo, nombre, token) {
  const url = `${process.env.APP_URL}:4517/nueva-password?token=${token}`;
  await transporter.sendMail({
    from: `"BomberEci Arena" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: 'Recuperar contraseña - BomberEci Arena',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin:0;padding:0;background:#0a0e14;font-family:'Rajdhani',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e14;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

                <!-- Línea roja superior -->
                <tr>
                  <td style="height:3px;background:linear-gradient(to right,#FF4655,transparent);"></td>
                </tr>

                <!-- Contenido principal -->
                <tr>
                  <td style="background:#0f1923;border:1px solid rgba(255,70,85,0.25);border-top:none;padding:48px 40px;">

                    <!-- Encabezado -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:8px;">
                          <div style="width:40px;height:3px;background:#FF4655;margin-bottom:20px;"></div>
                          <p style="margin:0;color:#FF4655;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:600;">
                            BOMBERECI ARENA
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:32px;">
                          <h1 style="margin:8px 0 0;color:#ffffff;font-size:36px;letter-spacing:3px;text-transform:uppercase;font-weight:700;line-height:1;">
                            RECUPERAR
                          </h1>
                          <h1 style="margin:0;color:#FF4655;font-size:36px;letter-spacing:3px;text-transform:uppercase;font-weight:700;line-height:1;">
                            CONTRASENA
                          </h1>
                        </td>
                      </tr>
                    </table>

                    <!-- Separador -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="height:1px;background:linear-gradient(to right,rgba(255,70,85,0.4),transparent);"></td>
                      </tr>
                    </table>

                    <!-- Mensaje -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <p style="margin:0;color:#c2c8ce;font-size:15px;line-height:1.7;letter-spacing:0.5px;">
                            Hola <strong style="color:#ffffff;">${nombre}</strong>,
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:36px;">
                          <p style="margin:0;color:#c2c8ce;font-size:15px;line-height:1.7;letter-spacing:0.5px;">
                            Recibimos una solicitud para restablecer la contrasena de tu cuenta.
                            Haz clic en el boton para crear una nueva contrasena.
                            Este enlace expira en <strong style="color:#FF4655;">1 hora</strong>.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Botón -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                      <tr>
                        <td>
                          <a href="${url}"
                            style="display:inline-block;background:#FF4655;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:4px;text-transform:uppercase;padding:16px 36px;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));">
                            RECUPERAR CONTRASENA
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Separador -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="height:1px;background:linear-gradient(to right,rgba(255,70,85,0.4),transparent);"></td>
                      </tr>
                    </table>

                    <!-- Aviso -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;color:#768079;font-size:12px;line-height:1.6;letter-spacing:0.5px;">
                            Si no solicitaste este cambio, ignora este mensaje. Tu contrasena no sera modificada.
                            Por seguridad, nunca compartas este enlace con nadie.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 40px;border:1px solid rgba(255,70,85,0.15);border-top:none;background:#0a0e14;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;color:#768079;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
                            BOMBERECI ARENA — SISTEMA DE SEGURIDAD
                          </p>
                        </td>
                        <td align="right">
                          <p style="margin:0;color:#FF4655;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
                            CONFIDENCIAL
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Línea roja inferior -->
                <tr>
                  <td style="height:3px;background:linear-gradient(to right,#FF4655,transparent);"></td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
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

async function reenviarVerificacion(correo) {
  const usuario = await db.buscarPorCorreo(correo);
  if (!usuario) return;
  if (usuario.verificado) {
    throw { status: 400, mensaje: 'Este correo ya está verificado.' };
  }
  const tokenVerificacion = generarToken();
  await db.actualizarTokenVerificacion(correo, tokenVerificacion);
  await enviarEmailVerificacion(correo, usuario.nombre, tokenVerificacion);
}

module.exports = {
  registrar,
  login,
  verificarCorreo,
  solicitarRecuperacion,
  resetearPassword,
  reenviarVerificacion
};
