# Pruebas de carga (k6)

Dos scripts, porque la arquitectura tiene dos superficies distintas:

- **`gameplay-ws.js`** — el que de verdad responde "¿cuántos usuarios soporta
  mi arquitectura?". Simula sesiones completas de jugador sobre Socket.IO
  (crear/unirse a sala, iniciar partida, mover, poner bombas) y mide cómo
  se degrada el servidor bajo carga real de partidas.
- **`http-smoke.js`** — capacidad de las rutas HTTP "gratis" (`/health`,
  estático del SPA). Secundario: la parte pesada de esta app es el
  WebSocket, no el HTTP.

No hay un script de `/auth/registro` ni `/auth/login` a carga completa — ver
la sección **Auth / login** más abajo antes de intentarlo.

## Requisitos

- k6 instalado (ya lo tienes: `/c/Program Files/k6/k6`).
- El servidor corriendo (`node server/index.js`) con Redis accesible.
  **Importante**: `REDIS_HOST` por defecto apunta a una IP privada de AWS
  (`172.31.20.209`), inalcanzable fuera de esa VPC. Para probar en local, en
  tu `.env` pon `REDIS_HOST=127.0.0.1` (o la IP de tu Redis local/dev) antes
  de levantar el server.

## Ejecutar

```bash
# Gameplay (WebSocket) — el importante
k6 run loadtest/gameplay-ws.js

# Contra otro host/puerto
k6 run -e WS_URL="ws://mi-servidor:4517/socket.io/?EIO=4&transport=websocket" loadtest/gameplay-ws.js

# HTTP smoke
k6 run loadtest/http-smoke.js
k6 run -e BASE_URL="http://mi-servidor:4517" loadtest/http-smoke.js
```

## Ajustar la carga

Ambos scripts escalan con `ramping-vus` en 3 escalones (15% → 50% → 100% de
`MAX_VUS`, con un tramo de subida y otro de sostenido en cada escalón) y
bajan a 0 al final. Para encontrar el punto de quiebre real, sube `MAX_VUS`
en corridas sucesivas hasta que los thresholds empiecen a fallar:

```bash
k6 run -e MAX_VUS=50  loadtest/gameplay-ws.js
k6 run -e MAX_VUS=150 loadtest/gameplay-ws.js
k6 run -e MAX_VUS=300 loadtest/gameplay-ws.js
```

Variables de entorno de `gameplay-ws.js`:

| Variable             | Default | Qué controla                                              |
|----------------------|---------|------------------------------------------------------------|
| `MAX_VUS`            | 120     | Techo de VUs concurrentes (≈ jugadores simultáneos)         |
| `STAGE_STEP`         | 30s     | Duración de cada rampa de subida                            |
| `STAGE_HOLD`         | 1m      | Duración de cada tramo sostenido                             |
| `MOVE_INTERVAL_MS`   | 220     | Cada cuánto un jugador manda `mover` (cooldown real: 180ms) |
| `BOMB_PROBABILITY`   | 0.08    | Probabilidad de mandar `bomba` en cada tick de movimiento    |
| `ROOM_WAIT_MS`       | 15000   | Cuánto espera el creador de sala a que llegue el 2º jugador |
| `SESSION_TIMEOUT_MS` | 60000   | Duración máxima de una sesión/partida simulada              |

Nota sobre el emparejamiento: los VUs se agrupan en pares (VU impar crea
sala, VU par se une) — por eso las cifras interesantes salen con un número
de VUs **par**. Si usas un número impar, el último VU queda sin pareja y
simplemente se cierra tras `ROOM_WAIT_MS` sin jugar (cuenta como conexión
pura, no como partida).

## Cómo interpretar los resultados

Al final de cada corrida, k6 imprime un resumen. Lo que importa aquí:

- **`ws_connecting`** (built-in) — tiempo de establecer el WebSocket. Si su
  p95 se dispara al subir VUs, el cuello de botella está en aceptar
  conexiones nuevas (Node event loop, límite de sockets, etc.).
- **`room_join_error_rate`** (custom) — % de intentos de `unirse_sala` que
  fallaron (sala no encontrada / llena / color tomado). Si sube con la
  carga, indica contención en Redis (el estado de las salas vive ahí) o que
  el pub/sub entre las 2 instancias EC2 (`@socket.io/redis-adapter`) se
  está quedando corto.
- **`estado_juego_broadcast_ms`** (custom) — tiempo entre que un VU manda
  `mover`/`bomba` y recibe el siguiente `estado_juego`. Es la métrica más
  directa de "qué tan responsivo se siente jugar" bajo carga. Si su p95
  crece mucho al subir `MAX_VUS`, ahí está tu límite práctico de usuarios
  concurrentes.
- **`games_started` vs `games_finished`** — si muchas partidas arrancan pero
  pocas terminan, puede haber sockets muriendo a mitad de partida.
- **`unexpected_ws_errors`** — desconexiones/errores de socket no
  provocados por el script.

En paralelo, vale la pena mirar `GET /metrics` (Prometheus) del propio
servidor durante la corrida — expone `jugadoresConectados`, `salasActivas`,
`latenciaWebSocket` (histograma, el mismo dato que mide el servidor del lado
suyo) y `bombasColocadas`, que te dan la vista "desde adentro" para
contrastar con lo que ve k6 desde afuera.

**Redis como posible cuello de botella**: todo el estado de salas y de
partida vive en una sola instancia de Redis (`server/lobby/LobbyManager.js`,
sin cluster/sentinel configurado). Antes de asumir que el límite es Node,
revisa `INFO` / latencia de ese Redis durante la prueba — es un candidato
obvio a ser el techo real de "cuántas salas simultáneas soporta".

## Auth / login

No incluido en un script de carga masiva a propósito:

- `/auth/registro` envía un correo real (Gmail vía nodemailer) y crea filas
  reales en Postgres por cada request. Cargarlo = spam real + riesgo de que
  Google bloquee la cuenta de envío.
- Todas las rutas de `/auth` tienen rate limiting por IP real (`login`: 5
  intentos / 3 min; `registro`: 10/hora) vía `express-rate-limit`, usando
  `trust proxy = 1`. Un k6 corriendo desde una sola máquina golpea todo
  desde la misma IP, así que el limiter corta la prueba en segundos.

Si igual quieres medir capacidad de `/auth/login`:

1. Crea unas cuantas cuentas de prueba **directamente en Postgres** con
   `verificado = true` (evitando el flujo de email) — no hay endpoint para
   esto, hay que insertarlas a mano o con un script aparte.
2. Ten en cuenta que `ipReal()` (`server/auth/authRoutes.js`) confía en el
   header `X-Forwarded-For` sin validar que venga de un proxy real. Eso
   significa que, en un entorno controlado (tu propio servidor, no
   producción expuesta), puedes variar ese header por VU para no chocar
   con el rate limit y medir capacidad real de bcrypt/Postgres bajo carga.
   Aparte de la utilidad para testing: esto también es un hallazgo de
   seguridad — cualquiera puede spoofear ese header para saltarse el
   rate limiter de login, a menos que haya un proxy/ALB delante que lo
   sanee antes de llegar a Express. Vale la pena revisarlo aparte de esta
   prueba de carga.
