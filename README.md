
# Business Case – BomberEci Arena

## 1. Resumen Ejecutivo

### Descripción de la aplicación propuesta

BomberEci Arena es un videojuego multijugador desarrollado en Java que combina mecánicas clásicas inspiradas en los juegos tipo Bomberman con elementos modernos de inteligencia artificial y múltiples modos de juego competitivos.

La plataforma permitirá partidas de hasta cuatro jugadores simultáneos. Cuando no existan suficientes jugadores humanos conectados, los espacios restantes serán ocupados automáticamente por jugadores controlados por inteligencia artificial, garantizando una experiencia de juego completa en todo momento.

Inicialmente se desarrollarán dos modos de juego:

* Supervivencia: el último jugador en pie gana la partida.
* Eliminación por puntuación: gana el primer jugador que logre eliminar diez oponentes.

Como extensión futura se contempla un tercer modo denominado Dominación de Territorio, donde los jugadores deberán pintar baldosas del mapa con su color y obtener la mayor cantidad posible antes de finalizar el tiempo de juego.

### Objetivo principal

Diseñar e implementar una plataforma de juego multijugador que permita demostrar conceptos avanzados de arquitectura de software, concurrencia, comunicación distribuida y diseño orientado a objetos mediante una aplicación interactiva y escalable.

### Valor esperado

El proyecto permitirá construir una solución que combine entretenimiento, competencia en tiempo real y demostración de conceptos arquitectónicos modernos, sirviendo como caso de estudio para sistemas concurrentes y distribuidos.

---

## 2. Problema / Oportunidad

### Contexto actual

Los videojuegos multijugador representan uno de los dominios más exigentes para la ingeniería de software debido a la necesidad de sincronizar múltiples usuarios, mantener consistencia en el estado compartido del sistema y responder en tiempo real a eventos concurrentes.


### Impacto de no resolverlo

Sin una aplicación que integre escenarios reales de concurrencia y sistemas distribuidos:

* Los conceptos arquitectónicos permanecen únicamente en el ámbito teórico.
* Resulta difícil evaluar problemas de sincronización y coordinación entre procesos.
* Se limita la comprensión de arquitecturas cliente-servidor en escenarios de tiempo real.

### Oportunidad

BomberEci Arena ofrece un entorno ideal para implementar y validar conceptos como:

* Arquitectura cliente-servidor.
* Comunicación en red.
* Gestión concurrente de recursos compartidos.
* Inteligencia artificial para agentes autónomos.
* Escalabilidad para múltiples partidas simultáneas.
* Diseño modular y extensible.

---

## 3. Objetivos del Proyecto

### Objetivo General

Desarrollar una plataforma multijugador basada en una arquitectura distribuida que permita partidas competitivas en tiempo real con soporte para jugadores humanos e inteligencia artificial.

### Objetivos Específicos

* Implementar partidas de hasta cuatro jugadores simultáneos.
* Garantizar la sincronización del estado del juego entre todos los clientes conectados.
* Incorporar jugadores controlados por inteligencia artificial cuando no existan suficientes usuarios humanos.
* Implementar múltiples modos de juego reutilizando la misma arquitectura base.
* Permitir la incorporación futura de nuevas reglas, poderes y modalidades de juego.
* Aplicar principios de diseño orientado a objetos y patrones arquitectónicos.

### Indicadores de Éxito

* Partidas funcionales con cuatro jugadores simultáneos.
* Sincronización correcta de movimientos, bombas y explosiones.
* Funcionamiento estable de los jugadores IA.
* Implementación completa de los modos Supervivencia y Eliminación por Puntuación.
* Arquitectura modular que permita agregar nuevas modalidades sin afectar el núcleo del sistema.

---

## 4. Alcance de la Solución

### Funcionalidad Principal

La aplicación permitirá:

* Crear y administrar partidas multijugador.
* Controlar personajes dentro de un mapa compuesto por bloques destructibles e indestructibles.
* Colocar bombas con temporizador.
* Eliminar jugadores mediante explosiones.
* Obtener poderes especiales destruyendo bloques.
* Competir bajo diferentes reglas de juego.

### Modos de Juego Iniciales

#### Supervivencia

Los jugadores son eliminados permanentemente durante la ronda. El último sobreviviente es declarado ganador.

#### Eliminación por Puntuación

Los jugadores reaparecen después de ser eliminados. Gana el primero que alcance diez eliminaciones.

### Funcionalidades Futuras

#### Dominación de Territorio

Los jugadores pintarán las baldosas del mapa con su color al desplazarse. Al finalizar el tiempo establecido, ganará quien posea la mayor cantidad de territorio controlado.

### Usuarios Objetivo

* Jugadores casuales.
* Estudiantes interesados en videojuegos multijugador.
* Docentes y evaluadores académicos que requieran evidencias de aplicación de conceptos de arquitectura de software.

### Diferenciadores

* Integración automática de inteligencia artificial para completar partidas.
* Múltiples modos de juego sobre una arquitectura común.
* Sistema extensible de poderes y reglas.
* Diseño orientado a demostrar conceptos de concurrencia y sistemas distribuidos.

---

## 5. Beneficios Esperados

### Beneficios Cuantitativos

* Reducción del tiempo necesario para probar partidas gracias a la incorporación automática de jugadores IA.
* Reutilización de más del 80% de los componentes principales entre diferentes modos de juego.
* Capacidad de soportar múltiples partidas concurrentes utilizando la misma infraestructura.

### Beneficios Cualitativos

* Experiencia de juego dinámica y competitiva.
* Comprensión práctica de arquitecturas distribuidas.
* Aplicación real de conceptos de concurrencia.
* Mayor facilidad para extender funcionalidades futuras.
* Base sólida para futuras versiones del producto.

---

## 6. Análisis de Viabilidad

### Viabilidad Técnica

Tecnologías propuestas:

* Java 17
* JavaFX
* Maven
* Programación Orientada a Objetos
* Sockets TCP
* ExecutorService y programación concurrente
* JUnit para pruebas

La solución es técnicamente viable debido a que las tecnologías seleccionadas son maduras, ampliamente documentadas y compatibles con los objetivos del proyecto.

### Viabilidad Económica

El proyecto utilizará herramientas y frameworks de código abierto, por lo que no requiere costos de licenciamiento.

Los principales recursos necesarios corresponden al tiempo de desarrollo y pruebas.

### Viabilidad Operativa

El alcance ha sido definido para ser desarrollado por un único integrante, priorizando una arquitectura sólida y funcionalidades esenciales antes de incorporar características avanzadas.

---

## 7. Riesgos y Mitigaciones

| Riesgo                                     | Impacto | Mitigación                                                                |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------- |
| Problemas de sincronización entre clientes | Alto    | Centralizar la lógica crítica en el servidor                              |
| Errores de concurrencia                    | Alto    | Uso de estructuras concurrentes y pruebas continuas                       |
| Complejidad excesiva del proyecto          | Medio   | Desarrollo incremental por iteraciones                                    |
| Desbalance entre jugadores humanos e IA    | Medio   | Ajustar comportamientos de IA mediante pruebas                            |
| Retrasos en funcionalidades avanzadas      | Bajo    | Priorizar modos principales y dejar extensiones como objetivos opcionales |

---

## 8. Conclusión y Recomendación

BomberEci Arena constituye una solución adecuada para demostrar conceptos fundamentales de arquitectura de software, sistemas distribuidos y programación concurrente dentro de un entorno práctico y atractivo para los usuarios.

La combinación de múltiples modos de juego, inteligencia artificial, sincronización en tiempo real y arquitectura cliente-servidor convierte al proyecto en una alternativa viable, escalable y alineada con los objetivos académicos del curso.

Se recomienda su desarrollo debido a que ofrece un equilibrio adecuado entre complejidad técnica, valor educativo y viabilidad de implementación dentro del tiempo disponible para el proyecto.
