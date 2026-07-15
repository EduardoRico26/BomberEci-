const pool = require('./index');

// Crear usuario nuevo
async function crearUsuario({ nombre, correo, passwordHash, tokenVerificacion }) {
  const result = await pool.query(
    `INSERT INTO usuarios 
     (nombre, correo, password_hash, token_verificacion)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, correo, verificado, rol`,
    [nombre, correo, passwordHash, tokenVerificacion]
  );
  return result.rows[0];
}

// Buscar usuario por correo
async function buscarPorCorreo(correo) {
  const result = await pool.query(
    'SELECT * FROM usuarios WHERE correo = $1',
    [correo]
  );
  return result.rows[0] || null;
}

// Buscar usuario por ID
async function buscarPorId(id) {
  const result = await pool.query(
    'SELECT id, nombre, correo, verificado, rol, fecha_creacion, ultimo_login FROM usuarios WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Verificar correo con token
async function verificarCorreo(token) {
  const result = await pool.query(
    `UPDATE usuarios 
     SET verificado = TRUE, token_verificacion = NULL
     WHERE token_verificacion = $1
     RETURNING id, nombre, correo`,
    [token]
  );
  return result.rows[0] || null;
}

// Registrar intento fallido de login
async function registrarIntentoFallido(correo) {
  await pool.query(
    `UPDATE usuarios 
     SET intentos_fallidos = intentos_fallidos + 1,
         bloqueado_hasta = CASE 
           WHEN intentos_fallidos + 1 >= 5 
           THEN NOW() + INTERVAL '15 minutes'
           ELSE bloqueado_hasta 
         END
     WHERE correo = $1`,
    [correo]
  );
}

// Resetear intentos fallidos tras login exitoso
async function resetearIntentos(correo) {
  await pool.query(
    `UPDATE usuarios 
     SET intentos_fallidos = 0, 
         bloqueado_hasta = NULL,
         ultimo_login = NOW()
     WHERE correo = $1`,
    [correo]
  );
}

// Guardar token de recuperación de contraseña
async function guardarTokenRecuperacion(correo, token) {
  const result = await pool.query(
    `UPDATE usuarios 
     SET token_recuperacion = $1,
         token_recuperacion_expira = NOW() + INTERVAL '1 hour'
     WHERE correo = $2
     RETURNING id`,
    [token, correo]
  );
  return result.rows[0] || null;
}

// Buscar usuario por token de recuperación válido
async function buscarPorTokenRecuperacion(token) {
  const result = await pool.query(
    `SELECT * FROM usuarios 
     WHERE token_recuperacion = $1 
     AND token_recuperacion_expira > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

// Actualizar contraseña
async function actualizarPassword(id, passwordHash) {
  await pool.query(
    `UPDATE usuarios 
     SET password_hash = $1,
         token_recuperacion = NULL,
         token_recuperacion_expira = NULL,
         intentos_fallidos = 0,
         bloqueado_hasta = NULL
     WHERE id = $2`,
    [passwordHash, id]
  );
}

async function actualizarTokenVerificacion(correo, token) {
  await pool.query(
    'UPDATE usuarios SET token_verificacion = $1 WHERE correo = $2',
    [token, correo]
  );
}


module.exports = {
  crearUsuario,
  buscarPorCorreo,
  buscarPorId,
  verificarCorreo,
  registrarIntentoFallido,
  resetearIntentos,
  guardarTokenRecuperacion,
  buscarPorTokenRecuperacion,
  actualizarPassword,
  actualizarTokenVerificacion
};