const jwt = require('jsonwebtoken');
require('dotenv').config();

function verificarToken(req, res, next) {
  // Buscar token en cookies o en el header Authorization
  const token = req.cookies?.token || 
                req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ mensaje: 'Acceso no autorizado. Inicia sesión.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado. Inicia sesión nuevamente.' });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ mensaje: 'No tienes permisos para esta acción.' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };