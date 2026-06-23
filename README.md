#  Inception 

## Título 

BomberEci 

## Integrantes

Eduardo Rico Duarte 

## Resumen

Bombereci Arena es un videojuego multijugador competitivo desarrollado como una aplicación interactiva en tiempo real, inspirado en juegos clásicos de combate por arena como Bomberman.

El sistema permitirá la creación de múltiples partidas simultáneas, donde diferentes grupos de jugadores podrán competir de manera independiente dentro de sus propias salas de juego. Cada partida podrá contar con hasta seis participantes, combinando jugadores humanos con agentes controlados mediante inteligencia artificial cuando no se alcance la capacidad máxima de jugadores.

Los participantes competirán dentro de mapas compuestos por bloques destructibles e indestructibles utilizando bombas, movimientos estratégicos y habilidades especiales obtenidas durante la partida.

El proyecto contará inicialmente con diferentes modalidades de juego:

- **Supervivencia:** los jugadores compiten hasta que solamente uno permanezca activo dentro de la partida.

- **Eliminación por puntuación:** los jugadores reaparecen después de ser eliminados y gana quien consiga primero una cantidad determinada de eliminaciones.

- **Dominación de territorio (futuro):** los jugadores competirán por controlar la mayor cantidad de casillas del mapa durante un tiempo establecido.

Bombereci Arena busca aplicar conceptos de Arquitectura de Software mediante una solución distribuida basada en una arquitectura cliente-servidor, comunicación en tiempo real, manejo de múltiples usuarios concurrentes, sincronización de estados, inteligencia artificial y diseño modular.

La aplicación estará diseñada para administrar diferentes salas de juego ejecutándose al mismo tiempo, manteniendo la independencia del estado de cada partida y permitiendo una futura expansión hacia una mayor cantidad de jugadores y escenarios de juego.

---

## Descripción del Proyecto

### Antecedentes

Los videojuegos multijugador en tiempo real representan un reto importante dentro del desarrollo de software debido a la necesidad de coordinar múltiples usuarios que interactúan simultáneamente dentro de un mismo entorno virtual.

En este tipo de aplicaciones es necesario mantener un estado consistente del sistema, sincronizar las acciones realizadas por los jugadores y garantizar que todos los participantes reciban las actualizaciones de la partida de manera oportuna.

Los juegos de combate por arena basados en bombas, como los títulos de la familia Bomberman y Bomb It, presentan un escenario adecuado para aplicar estos desafíos debido a la cantidad de eventos concurrentes que pueden ocurrir durante una partida, tales como:

- Movimiento de jugadores.
- Colocación de bombas.
- Explosiones.
- Eliminación de participantes.
- Reaparición de jugadores.
- Obtención de habilidades especiales.

Bombereci Arena surge como una propuesta para desarrollar un sistema multijugador que no solo implemente la experiencia de juego, sino que también permita aplicar principios de arquitectura de software, sistemas distribuidos y programación concurrente dentro de un entorno interactivo.

---

### Problema que se busca resolver

En un videojuego multijugador existen diferentes desafíos relacionados con la comunicación, concurrencia y sincronización de información entre los participantes.

Cuando múltiples jugadores realizan acciones al mismo tiempo, el sistema debe garantizar que todos los usuarios tengan una representación consistente del estado actual de la partida.

Además, cuando existen diferentes partidas ejecutándose simultáneamente, el sistema debe ser capaz de administrar cada sala de manera independiente, evitando que los eventos de una partida afecten el funcionamiento de otras.

Algunos problemas que pueden presentarse en este tipo de sistemas son:

- Diferencias entre el estado visual de los jugadores conectados.
- Retrasos en la actualización de movimientos y eventos.
- Conflictos al modificar recursos compartidos como mapas, jugadores o bombas.
- Problemas de sincronización durante explosiones o eliminaciones simultáneas.
- Dificultad para administrar múltiples partidas activas al mismo tiempo.
- Limitaciones para agregar nuevos modos de juego o funcionalidades.

Bombereci Arena busca abordar estos problemas mediante una arquitectura cliente-servidor donde el servidor será responsable de administrar el estado oficial de cada partida, procesar las acciones recibidas y sincronizar los cambios con los clientes conectados.

---


## Épicas

### ÉPICA 1: Gestión de Partidas y Salas
| Feature ID | Nombre |
|---|---|
| F-1.1 | Creación y administración de salas |
| F-1.2 | Unión de jugadores a partidas |
| F-1.3 | Gestión de modos de juego |

### ÉPICA 2: Experiencia de Juego en Tiempo Real
| Feature ID | Nombre |
|---|---|
| F-2.1 | Movimiento y acciones del jugador |
| F-2.2 | Sistema de bombas y explosiones |
| F-2.3 | Power-ups y habilidades especiales |
| F-2.4 | IA como jugador sustituto |

### ÉPICA 3: Jugadores y Autenticación
| Feature ID | Nombre |
|---|---|
| F-3.1 | Registro e inicio de sesión |
| F-3.2 | Perfil y estadísticas del jugador |

### ÉPICA 4: Observabilidad y Monitoreo
| Feature ID | Nombre |
|---|---|
| F-4.1 | Registro de logs estructurados |
| F-4.2 | Métricas técnicas de concurrencia y rendimiento |
| F-4.3 | KPIs de negocio |
| F-4.4 | Dashboard de visualización |

### ÉPICA 5: IA Generativa *(Bono)*
| Feature ID | Nombre |
|---|---|
| F-5.1 | Asistente inteligente de estadísticas post-partida |

---


## Definición Global de DoR y DoD

### Definition of Ready (DoR)
Una historia de usuario está lista para entrar a desarrollo cuando cumple **todos** los siguientes criterios:

- La historia está redactada con Quién, Qué y Para Qué
- Los criterios de aceptación están escritos en formato Gherkin (Given-When-Then)
- La historia fue estimada por el equipo en Story Points
- No tiene dependencias bloqueantes sin resolver
- Fue revisada y aprobada por el Product Owner
- Está priorizada con MoSCoW
- Los mockups o diagramas necesarios están disponibles

---

### Definition of Done (DoD)
Una historia de usuario está lista para ser desplegada cuando cumple **todos** los siguientes criterios:

- El código fue desarrollado y tiene merge aprobado en la rama correspondiente
- Pruebas unitarias escritas con cobertura ≥ 80%
- Todos los criterios de aceptación Gherkin fueron verificados y están pasando
- Code review aprobado por al menos un integrante del equipo
- Sin errores críticos en el ambiente de staging
- Documentación técnica actualizada en la Wiki del repositorio
- El Product Owner aceptó la historia en la demo del sprint

---

## Historias de Usuario

---

### HU-01 — Registro de jugador
**Épica:** Jugadores y Autenticación | **Feature:** F-3.1  
**Prioridad MoSCoW:** Must | **Story Points:** 3

**Historia:**
> Como **jugador nuevo**, quiero **registrarme con usuario y contraseña**, para **acceder a las partidas y que mis estadísticas queden vinculadas a mi perfil**.

**Criterios de aceptación:**
```gherkin
Feature: Registro de jugador

  Scenario: Registro exitoso con datos válidos
    Given que el jugador accede al formulario de registro
    When ingresa un nombre de usuario único, correo válido y contraseña segura
    Then el sistema crea la cuenta
    And muestra un mensaje de bienvenida
    And redirige al lobby principal

  Scenario: Registro fallido por nombre de usuario duplicado
    Given que el jugador intenta registrarse
    When ingresa un nombre de usuario que ya existe en el sistema
    Then el sistema muestra el mensaje "El nombre de usuario ya está en uso"
    And no crea la cuenta

  Scenario: Registro fallido por contraseña débil
    Given que el jugador llena el formulario de registro
    When ingresa una contraseña de menos de 8 caracteres
    Then el sistema muestra el mensaje "La contraseña debe tener al menos 8 caracteres"
    And bloquea el envío del formulario
```

---

### HU-02 — Inicio de sesión
**Épica:** Jugadores y Autenticación | **Feature:** F-3.1  
**Prioridad MoSCoW:** Must | **Story Points:** 3

**Historia:**
> Como **jugador registrado**, quiero **iniciar sesión con mis credenciales**, para **acceder al lobby y unirme a partidas**.

**Criterios de aceptación:**
```gherkin
Feature: Inicio de sesión

  Scenario: Login exitoso
    Given que el jugador tiene una cuenta registrada
    When ingresa su usuario y contraseña correctos
    Then el sistema autentica al jugador
    And lo redirige al lobby principal con su nombre visible

  Scenario: Login fallido por credenciales incorrectas
    Given que el jugador accede al formulario de login
    When ingresa una contraseña incorrecta
    Then el sistema muestra "Credenciales inválidas"
    And no permite el acceso

  Scenario: Bloqueo por intentos fallidos
    Given que el jugador ha fallado el login 5 veces consecutivas
    When intenta iniciar sesión nuevamente
    Then el sistema bloquea el acceso por 5 minutos
    And muestra un mensaje informando el tiempo de bloqueo
```

---

### HU-03 — Crear sala de juego
**Épica:** Gestión de Partidas y Salas | **Feature:** F-1.1  
**Prioridad MoSCoW:** Must | **Story Points:** 5

**Historia:**
> Como **jugador autenticado**, quiero **crear una sala de juego eligiendo el modo y la capacidad**, para **invitar a otros jugadores y comenzar una partida personalizada**.

**Criterios de aceptación:**
```gherkin
Feature: Creación de sala de juego

  Scenario: Creación exitosa de sala
    Given que el jugador está en el lobby
    When selecciona "Crear sala", elige modo "Supervivencia" y capacidad de 4 jugadores
    Then el sistema genera una sala con código único
    And el jugador queda como anfitrión dentro de la sala
    And la sala aparece visible en el listado del lobby

  Scenario: Sala creada con IA para completar cupos
    Given que el anfitrión crea una sala con capacidad de 6
    And la partida inicia con solo 3 jugadores humanos
    When el sistema detecta que faltan jugadores
    Then agrega automáticamente 3 agentes de IA
    And notifica a los jugadores que "Los cupos restantes serán completados por IA"

  Scenario: Límite de salas simultáneas alcanzado
    Given que el servidor tiene el máximo de salas activas permitidas
    When un jugador intenta crear una sala nueva
    Then el sistema muestra "No hay capacidad disponible en este momento"
    And sugiere unirse a una sala existente
```

---

### HU-04 — Unirse a sala existente
**Épica:** Gestión de Partidas y Salas | **Feature:** F-1.2  
**Prioridad MoSCoW:** Must | **Story Points:** 3

**Historia:**
> Como **jugador autenticado**, quiero **unirme a una sala disponible desde el lobby**, para **competir con otros jugadores sin necesidad de crearla yo**.

**Criterios de aceptación:**
```gherkin
Feature: Unión a sala de juego

  Scenario: Unión exitosa a sala disponible
    Given que el jugador ve el listado de salas en el lobby
    When selecciona una sala con cupos disponibles y presiona "Unirse"
    Then el sistema lo agrega a la sala
    And todos los jugadores en la sala reciben una notificación en tiempo real del nuevo participante

  Scenario: Intento de unirse a sala llena
    Given que el jugador intenta unirse a una sala con 6 de 6 jugadores
    When presiona "Unirse"
    Then el sistema muestra "La sala está llena"
    And no permite el ingreso

  Scenario: Unión mediante código de sala
    Given que el jugador recibe un código de sala de un amigo
    When lo ingresa en el campo "Unirse por código"
    Then el sistema valida el código
    And agrega al jugador a la sala correspondiente
```

---

### HU-05 — Movimiento en tiempo real 
**Épica:** Experiencia de Juego en Tiempo Real | **Feature:** F-2.1  
**Prioridad MoSCoW:** Must | **Story Points:** 8

**Historia:**
> Como **jugador dentro de una partida**, quiero **mover mi personaje por el mapa y ver los movimientos de otros jugadores instantáneamente**, para **tomar decisiones estratégicas basadas en la posición real de todos los participantes**.

**Criterios de aceptación:**
```gherkin
Feature: Movimiento en tiempo real

  Scenario: Movimiento propio reflejado en todos los clientes
    Given que hay una partida activa con 4 jugadores conectados
    When el jugador presiona una tecla de dirección
    Then el servidor procesa el movimiento en menos de 100ms
    And todos los clientes conectados a esa sala reciben la actualización de posición
    And el personaje se mueve de forma fluida en todos los clientes

  Scenario: Colisión con bloque indestructible
    Given que el jugador intenta moverse hacia una celda con bloque indestructible
    When el servidor valida el movimiento
    Then el movimiento es rechazado
    And el personaje permanece en su posición actual en todos los clientes

  Scenario: Desconexión temporal de jugador
    Given que un jugador pierde conexión durante la partida
    When el servidor detecta la desconexión
    Then el personaje del jugador queda estático en su última posición
    And los demás jugadores ven al personaje como "desconectado"
    And si el jugador reconecta en menos de 30 segundos, retoma la partida
```

---

### HU-06 — Colocación de bombas y explosiones en tiempo real 
**Épica:** Experiencia de Juego en Tiempo Real | **Feature:** F-2.2  
**Prioridad MoSCoW:** Must | **Story Points:** 8

**Historia:**
> Como **jugador activo en una partida**, quiero **colocar bombas que exploten después de un tiempo y destruyan bloques o eliminen jugadores**, para **eliminar rivales y avanzar en el mapa estratégicamente**.

**Criterios de aceptación:**
```gherkin
Feature: Sistema de bombas y explosiones en tiempo real

  Scenario: Colocación y explosión de bomba
    Given que el jugador está en una celda libre del mapa
    When presiona la tecla de colocar bomba
    Then el servidor registra la bomba en esa celda
    And todos los clientes visualizan la bomba colocada en tiempo real
    And después de 3 segundos la bomba explota
    And la explosión se propaga en las 4 direcciones según el radio del jugador
    And todos los clientes muestran la animación de explosión simultáneamente

  Scenario: Jugador eliminado por explosión
    Given que un jugador está dentro del radio de explosión de una bomba
    When la bomba explota
    Then el servidor calcula la eliminación
    And notifica a todos los clientes que ese jugador fue eliminado
    And el jugador eliminado ve su pantalla de "eliminado" en tiempo real

  Scenario: Destrucción de bloque destructible
    Given que hay un bloque destructible dentro del radio de la explosión
    When la bomba explota
    Then el servidor elimina ese bloque del mapa
    And todos los clientes actualizan el mapa sin ese bloque
    And puede aparecer un power-up con probabilidad definida

  Scenario: Límite de bombas simultáneas
    Given que el jugador ya tiene el máximo de bombas activas colocadas
    When intenta colocar una bomba adicional
    Then el sistema no permite la acción
    And no muestra ninguna bomba nueva en ningún cliente
```

---

### HU-07 — Modo Supervivencia
**Épica:** Gestión de Partidas y Salas | **Feature:** F-1.3  
**Prioridad MoSCoW:** Must | **Story Points:** 5

**Historia:**
> Como **jugador competitivo**, quiero **participar en un modo Supervivencia donde el último jugador vivo gane**, para **experimentar partidas con alta tensión estratégica**.

**Criterios de aceptación:**
```gherkin
Feature: Modo de juego Supervivencia

  Scenario: Inicio de partida en modo Supervivencia
    Given que la sala tiene al menos 2 jugadores y está en modo Supervivencia
    When el anfitrión inicia la partida
    Then todos los jugadores aparecen en posiciones iniciales predefinidas del mapa
    And el servidor comienza a procesar eventos de la partida

  Scenario: Determinación del ganador
    Given que una partida de Supervivencia está en curso
    When todos los jugadores menos uno son eliminados
    Then el servidor detecta que queda un solo jugador activo
    And declara a ese jugador como ganador
    And notifica a todos los clientes el resultado de la partida

  Scenario: Empate por eliminación simultánea
    Given que quedan 2 jugadores activos en la partida
    When ambos son eliminados en la misma explosión simultáneamente
    Then el servidor declara empate
    And notifica a todos los clientes el resultado de empate
```

---

### HU-08 — Modo Eliminación por Puntuación
**Épica:** Gestión de Partidas y Salas | **Feature:** F-1.3  
**Prioridad MoSCoW:** Must | **Story Points:** 5

**Historia:**
> Como **jugador**, quiero **participar en un modo de eliminación por puntuación con reaparición**, para **tener partidas más largas donde la habilidad acumulada determine al ganador**.

**Criterios de aceptación:**
```gherkin
Feature: Modo Eliminación por Puntuación

  Scenario: Reaparición tras ser eliminado
    Given que un jugador es eliminado en modo Eliminación por Puntuación
    When el servidor procesa la eliminación
    Then el jugador eliminado respawn en una posición segura del mapa después de 3 segundos
    And su contador de muertes aumenta en 1
    And el jugador que realizó la eliminación suma 1 punto

  Scenario: Victoria por puntuación
    Given que la meta de la partida es 10 eliminaciones
    When un jugador alcanza 10 puntos
    Then el servidor finaliza la partida
    And declara a ese jugador como ganador
    And muestra el marcador final a todos los clientes

  Scenario: Marcador visible en tiempo real
    Given que hay una partida activa en modo Eliminación por Puntuación
    When cualquier jugador realiza una eliminación
    Then el marcador en pantalla de todos los clientes se actualiza en tiempo real
```

---

### HU-09 — Agente de IA como jugador
**Épica:** Experiencia de Juego en Tiempo Real | **Feature:** F-2.4  
**Prioridad MoSCoW:** Should | **Story Points:** 13

**Historia:**
> Como **sistema**, quiero **incorporar agentes de IA que reemplacen cupos vacíos en una sala**, para **garantizar que las partidas siempre sean dinámicas y competitivas incluso con pocos jugadores humanos**.

**Criterios de aceptación:**
```gherkin
Feature: Agentes IA como jugadores

  Scenario: IA completa cupos de sala
    Given que una sala tiene capacidad para 4 jugadores y solo hay 2 humanos
    When el anfitrión inicia la partida
    Then el servidor instancia 2 agentes de IA
    And los agentes aparecen en el mapa con nombres identificables como "Bot-1", "Bot-2"

  Scenario: IA realiza movimientos autónomos
    Given que hay un agente de IA activo en la partida
    When el servidor procesa el turno del agente
    Then el agente evalúa el mapa y selecciona una acción (moverse, colocar bomba o esperar)
    And la acción se propaga a todos los clientes igual que la de un jugador humano

  Scenario: IA evita su propia explosión
    Given que un agente de IA acaba de colocar una bomba
    When el temporizador de la bomba está por expirar
    Then el agente calcula una ruta de escape
    And se mueve fuera del radio de explosión antes de que detone
```

---

### HU-10 — Power-ups y habilidades especiales
**Épica:** Experiencia de Juego en Tiempo Real | **Feature:** F-2.3  
**Prioridad MoSCoW:** Should | **Story Points:** 5

**Historia:**
> Como **jugador en partida**, quiero **recoger power-ups que mejoren mis capacidades**, para **obtener ventajas estratégicas sobre mis rivales durante la partida**.

**Criterios de aceptación:**
```gherkin
Feature: Power-ups y habilidades especiales

  Scenario: Aparición de power-up al destruir bloque
    Given que una explosión destruye un bloque destructible
    When el servidor calcula la probabilidad de aparición
    Then si la probabilidad es favorable, se genera un power-up en esa celda
    And todos los clientes visualizan el power-up en el mapa

  Scenario: Jugador recoge power-up
    Given que hay un power-up en el mapa
    When el jugador se mueve a la celda del power-up
    Then el servidor aplica el efecto al jugador (mayor radio, más bombas o mayor velocidad)
    And el power-up desaparece del mapa en todos los clientes
    And el jugador ve en su HUD la mejora aplicada

  Scenario: Power-up de velocidad aumenta desplazamiento
    Given que el jugador recoge un power-up de velocidad
    When el jugador se mueve
    Then el servidor permite que se desplace más rápido que los jugadores sin ese power-up
```

---

### HU-11 — Perfil y estadísticas del jugador
**Épica:** Jugadores y Autenticación | **Feature:** F-3.2  
**Prioridad MoSCoW:** Should | **Story Points:** 3

**Historia:**
> Como **jugador registrado**, quiero **ver mi historial de partidas y estadísticas personales**, para **seguir mi progreso y comparar mi desempeño con otros jugadores**.

**Criterios de aceptación:**
```gherkin
Feature: Perfil y estadísticas del jugador

  Scenario: Acceso al perfil propio
    Given que el jugador está autenticado
    When accede a la sección "Mi Perfil"
    Then el sistema muestra partidas jugadas, victorias, eliminaciones realizadas y muertes recibidas

  Scenario: Actualización de estadísticas al finalizar partida
    Given que el jugador completó una partida
    When el servidor procesa el resultado final
    Then las estadísticas del jugador se actualizan automáticamente
    And están disponibles en su perfil en menos de 5 segundos

  Scenario: Comparación en tabla de líderes
    Given que el jugador accede a "Tabla de Líderes"
    When el sistema carga la información
    Then muestra el ranking de jugadores ordenado por victorias totales
```

---

### HU-12 — Registro de logs estructurados
**Épica:** Observabilidad y Monitoreo | **Feature:** F-4.1  
**Prioridad MoSCoW:** Must | **Story Points:** 5

**Historia:**
> Como **desarrollador u operador del sistema**, quiero **que todos los eventos relevantes del servidor se registren como logs estructurados en formato JSON**, para **facilitar el diagnóstico de errores, auditoría de partidas y trazabilidad de eventos concurrentes**.

**Criterios de aceptación:**
```gherkin
Feature: Registro de logs estructurados

  Scenario: Log generado al iniciar una partida
    Given que una sala inicia una partida
    When el servidor procesa el evento de inicio
    Then se genera un log estructurado con campos: timestamp, sala_id, modo_juego, jugadores[] y nivel de severidad INFO

  Scenario: Log generado al producirse una explosión
    Given que una bomba explota en una partida activa
    When el servidor procesa la explosión
    Then se registra un log con: timestamp, sala_id, jugador_id, posición_bomba, jugadores_eliminados[] y bloques_destruidos[]

  Scenario: Log de error ante evento inesperado
    Given que ocurre una excepción no controlada en el servidor
    When el sistema captura el error
    Then se registra un log con nivel ERROR que incluye: timestamp, tipo_error, stack_trace y sala_id afectada

  Scenario: Logs accesibles para consulta
    Given que el equipo de desarrollo necesita revisar eventos de una sala específica
    When consulta el sistema de logs filtrando por sala_id y rango de tiempo
    Then el sistema retorna los logs ordenados cronológicamente en formato JSON
```

---

### HU-13 — Métricas técnicas de concurrencia y rendimiento
**Épica:** Observabilidad y Monitoreo | **Feature:** F-4.2  
**Prioridad MoSCoW:** Must | **Story Points:** 8

**Historia:**
> Como **operador del sistema**, quiero **que el servidor capture métricas técnicas de concurrencia y rendimiento en tiempo de ejecución**, para **identificar cuellos de botella, problemas de latencia y garantizar la estabilidad bajo carga**.

**Criterios de aceptación:**
```gherkin
Feature: Métricas técnicas de concurrencia y rendimiento

  Scenario: Captura de latencia promedio de mensajes WebSocket
    Given que hay partidas activas con jugadores enviando eventos
    When el servidor procesa los mensajes
    Then registra la latencia de procesamiento por mensaje en milisegundos
    And calcula el promedio, máximo y percentil 95 cada 10 segundos

  Scenario: Captura de salas y jugadores concurrentes
    Given que el servidor está en operación
    When se consultan las métricas de concurrencia
    Then el sistema expone el número de salas activas, jugadores conectados y agentes de IA activos en ese instante

  Scenario: Captura de uso de recursos del servidor
    Given que el servidor está procesando partidas
    When el recolector de métricas ejecuta su ciclo
    Then registra uso de CPU y memoria RAM del proceso
    And almacena los valores con timestamp para análisis histórico

  Scenario: Alerta por latencia elevada
    Given que el percentil 95 de latencia supera los 200ms
    When el sistema de métricas detecta el umbral superado
    Then genera una alerta registrada en los logs con nivel WARN
    And la métrica queda visible en el dashboard
```

---

### HU-14 — KPIs de negocio
**Épica:** Observabilidad y Monitoreo | **Feature:** F-4.3  
**Prioridad MoSCoW:** Must | **Story Points:** 5

**Historia:**
> Como **product owner del proyecto**, quiero **que el sistema mida y exponga KPIs de negocio alineados con el valor del juego**, para **evaluar el éxito del producto, la retención de jugadores y la calidad de la experiencia**.

**KPIs definidos:**

| KPI | Descripción | Meta |
|---|---|---|
| Partidas completadas por día | Número de partidas que llegan a tener un ganador | ≥ 50 / día |
| Tasa de retención de jugadores | % de jugadores que juegan más de una sesión en 7 días | ≥ 40% |
| Duración promedio de partida | Tiempo promedio entre inicio y fin por modo de juego | Supervivencia: 5–10 min |
| Tasa de abandono de sala | % de jugadores que se desconectan antes de finalizar | ≤ 15% |

**Criterios de aceptación:**
```gherkin
Feature: KPIs de negocio

  Scenario: Conteo de partidas completadas
    Given que una partida finaliza con un ganador declarado
    When el servidor registra el resultado
    Then incrementa el contador diario de partidas completadas
    And el KPI es visible en el dashboard en tiempo real

  Scenario: Cálculo de tasa de retención
    Given que han pasado 7 días desde el registro de un jugador
    When el sistema ejecuta el cálculo de retención
    Then determina si el jugador jugó al menos una sesión adicional en esos 7 días
    And actualiza el KPI de retención porcentual

  Scenario: Medición de duración promedio de partida
    Given que una partida inicia y finaliza
    When el servidor registra los timestamps de inicio y fin
    Then calcula la duración total
    And la agrega al promedio acumulado por modo de juego visible en el dashboard

  Scenario: Detección de abandono de sala
    Given que un jugador se desconecta antes del fin de la partida
    When el servidor detecta la desconexión sin reconexión en 30 segundos
    Then lo registra como abandono
    And actualiza el KPI de tasa de abandono
```

---

### HU-15 — Dashboard de visualización de métricas
**Épica:** Observabilidad y Monitoreo | **Feature:** F-4.4  
**Prioridad MoSCoW:** Must | **Story Points:** 8

**Historia:**
> Como **operador o desarrollador**, quiero **acceder a un dashboard que visualice en tiempo real las métricas técnicas y KPIs de negocio del sistema**, para **tomar decisiones operativas y evaluar el estado del juego de manera rápida y visual**.

**Criterios de aceptación:**
```gherkin
Feature: Dashboard de métricas

  Scenario: Dashboard muestra métricas en tiempo real
    Given que el dashboard está abierto en el navegador del operador
    When hay partidas activas en el servidor
    Then el dashboard actualiza automáticamente cada 10 segundos sin necesidad de recargar la página
    And muestra salas activas, jugadores conectados, latencia promedio y KPIs de negocio

  Scenario: Visualización de histórico de métricas
    Given que el operador quiere analizar el comportamiento del sistema en las últimas 24 horas
    When selecciona el rango de tiempo en el dashboard
    Then el sistema muestra gráficas de línea con la evolución de latencia, concurrencia y partidas completadas

  Scenario: Dashboard indica estado del sistema
    Given que el operador accede al dashboard
    When el sistema está operando dentro de los umbrales normales
    Then muestra un indicador verde de "Sistema estable"
    And si alguna métrica supera su umbral, cambia a amarillo o rojo con descripción del problema
```

---

### HU-16 — Resumen inteligente de partida con IA generativa  *(Bono)*
**Épica:** IA Generativa | **Feature:** F-5.1  
**Prioridad MoSCoW:** Could | **Story Points:** 8

**Historia:**
> Como **jugador que acaba de terminar una partida**, quiero **recibir un resumen narrativo generado por IA con análisis de mi desempeño**, para **entender mis puntos fuertes y áreas de mejora de forma entretenida y personalizada**.

**Criterios de aceptación:**
```gherkin
Feature: Resumen inteligente de partida

  Scenario: Generación de resumen al finalizar partida
    Given que una partida ha terminado
    When el servidor recopila los eventos de la partida (movimientos, bombas, eliminaciones, power-ups)
    Then envía el resumen de datos a la API de IA generativa
    And la IA retorna un texto narrativo personalizado con el desempeño del jugador
    And el texto se muestra en la pantalla de resultados en menos de 5 segundos

  Scenario: Resumen contiene información relevante
    Given que el jugador ganó la partida con 5 eliminaciones
    When la IA genera el resumen
    Then el texto menciona logros destacados como racha de eliminaciones o uso estratégico de power-ups
    And sugiere al menos una área de mejora basada en los datos de la partida

  Scenario: Fallo de la IA no bloquea el flujo
    Given que la API de IA no responde en el tiempo esperado
    When el sistema detecta el timeout
    Then muestra un resumen básico con estadísticas numéricas sin el texto generado
    And no interrumpe la experiencia del jugador
```

---

## Priorización MoSCoW

| ID | Historia | Épica | MoSCoW | Story Points |
|---|---|---|---|---|
| HU-01 | Registro de jugador | Jugadores y Autenticación | Must | 3 |
| HU-02 | Inicio de sesión | Jugadores y Autenticación | Must | 3 |
| HU-03 | Crear sala de juego | Gestión de Partidas y Salas | Must | 5 |
| HU-04 | Unirse a sala existente | Gestión de Partidas y Salas | Must | 3 |
| HU-05 | Movimiento en tiempo real  | Experiencia de Juego en Tiempo Real | Must | 8 |
| HU-06 | Bombas y explosiones en tiempo real  | Experiencia de Juego en Tiempo Real | Must | 8 |
| HU-07 | Modo Supervivencia | Gestión de Partidas y Salas | Must | 5 |
| HU-08 | Modo Eliminación por Puntuación | Gestión de Partidas y Salas | Must | 5 |
| HU-12 | Registro de logs estructurados | Observabilidad y Monitoreo | Must | 5 |
| HU-13 | Métricas técnicas de concurrencia y rendimiento | Observabilidad y Monitoreo | Must | 8 |
| HU-14 | KPIs de negocio | Observabilidad y Monitoreo | Must | 5 |
| HU-15 | Dashboard de visualización de métricas | Observabilidad y Monitoreo | Must | 8 |
| HU-09 | Agente de IA como jugador | Experiencia de Juego en Tiempo Real | Should | 13 |
| HU-10 | Power-ups y habilidades especiales | Experiencia de Juego en Tiempo Real | Should | 5 |
| HU-11 | Perfil y estadísticas del jugador | Jugadores y Autenticación | Should | 3 |
| HU-16 | Resumen inteligente con IA generativa  | IA Generativa | Could | 8 |
| — | Modo Dominación de Territorio | Gestión de Partidas y Salas | Won't | — |

---

**Resumen por categoría:**

| Categoría | Historias | Story Points |
|---|---|---|
| Must | 12 | 63 |
| Should | 3 | 21 |
| Could | 1 | 8 |
| Won't | 1 | — |
| **Total** | **17** | **92** |

