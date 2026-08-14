CREATE TABLE usuarios (
    id                          SERIAL PRIMARY KEY,
    nombre                      VARCHAR(100) NOT NULL,
    correo                      VARCHAR(150) NOT NULL UNIQUE,
    password_hash               VARCHAR(255) NOT NULL,
    verificado                  BOOLEAN NOT NULL DEFAULT FALSE,
    rol                         VARCHAR(20) NOT NULL DEFAULT 'jugador',
    token_verificacion          VARCHAR(255),
    token_recuperacion          VARCHAR(255),
    token_recuperacion_expira   TIMESTAMP,
    intentos_fallidos           INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta             TIMESTAMP,
    fecha_creacion              TIMESTAMP NOT NULL DEFAULT NOW(),
    ultimo_login                TIMESTAMP
);
