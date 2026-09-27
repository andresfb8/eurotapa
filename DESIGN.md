# EuroTapa — Documento de Especificación y Diseño del Sistema

> **Gala gastronómica y sistema de puntuación en vivo estilo Eurovisión para concursos de tapas entre amigos.**  
> Aplicando los principios estéticos y directrices de diseño de `brandkit` y `minimalist-ui`.

---

## 1. Resumen Ejecutivo y Entendimiento del Problema

* **Objetivo**: Proporcionar una plataforma web colaborativa en tiempo real para organizar, presentar y evaluar concursos gastronómicos/tapas entre amigos con la emoción y dinámica de la gala de Eurovisión.
* **Público Objetivo**: Grupos de amigos (10 a 25 comensales/cocineros) reunidos presencialmente, acompañados de una pantalla central (Smart TV o proyector) y el organizador (Superadmin).
* **Flujo Operativo**:
  1. **Sorteo de Degustación**: Sorteo interactivo animado en la TV que fija el orden en el que se cocinarán y probarán las tapas, con exportación directa para compartir por WhatsApp.
  2. **Presentación de Fichas (Cata)**: Durante la cena, la TV proyecta la foto, ingredientes y descripción de la tapa que se está degustando.
  3. **Votación Móvil**: Tras probar todas las tapas, los participantes entran desde su móvil con su PIN para repartir sus votos (de $N-1$ hasta 1) sin votar por su propia tapa.
  4. **Gran Gala en Vivo**: El superadmin avanza la revelación votante a votante; la TV muestra los puntos otorgados y reordena el ranking general en tiempo real con animaciones fluidas hasta coronar el podio.

---

## 2. Dirección de Diseño e Identidad Visual (`brandkit` + `minimalist-ui`)

* **Paleta Cromática (Monocromo Cálido + Acentos Pastel Desaturados)**:
  * Fondo de Lienzo (*Canvas*): Blanco hueso cálido `#F7F6F3` / `#FBFBFA`.
  * Superficies y Tarjetas: Blanco puro `#FFFFFF` con borde estructural sutil `border: 1px solid #EAEAEA`.
  * Tipografía Primaria: Off-black `#111111` (cuerpo en `#2F3437`, meta-datos en gris neutro `#787774`).
  * Acentos Semánticos Pastel:
    * *Pale Green* `#EDF3EC` (Texto `#346538`) para estados confirmados y líder temporal.
    * *Pale Yellow* `#FBF3DB` (Texto `#956400`) para medallas y destacados de oro.
    * *Pale Red* `#FDEBEC` (Texto `#9F2F2D`) para la tapa propia excluida de votación.
    * *Pale Blue* `#E1F3FE` (Texto `#1F6C9F`) para turnos activos en cata.
* **Tipografía Editorial**:
  * Titulares de gala y nombres de platos: Tipografía serif con carácter (`Newsreader`, `Playfair Display` o `Instrument Serif`) con interletrado ajustado (`letter-spacing: -0.02em`).
  * Interfaz de usuario, etiquetas y botones: Sans-serif limpia geométrica (`Geist Sans`, `SF Pro Display`, `Switzer`).
  * Puntuaciones, códigos PIN y puestos: Monospaced limpia (`Geist Mono`, `SF Mono`).
* **Restricciones Estéticas Absolutas**:
  * Sin emojis en el código ni la interfaz; utilización exclusiva de iconos vectoriales SVG limpios.
  * Sin degradados chillones, sombras excesivas ni efectos de cristal 3D estridentes.
  * Bordes redondeados sobrios (`4px` a `8px`), con espaciado amplio y elegante.

---

## 3. Arquitectura Técnica

* **Frontend**: SPA basada en React + TypeScript (con Vite) y CSS modular puro.
* **Backend y Sincronización**: Firebase (Firestore / Realtime Database + Storage/DataURLs comprimidas en cliente para fotografías de tapas).
* **Rutas de la Aplicación**:
  * `/tv`: Modo Pantalla Completa para proyector o Smart TV. Subscripción en tiempo real a los cambios de estado.
  * `/votar`: Interfaz móvil táctil para los participantes (login por PIN, ficha de tapa, selector de votos).
  * `/admin`: Mando de control protegido por contraseña para el organizador.

---

## 4. Registro de Decisiones de Diseño (Decision Log)

| ID | Decisión | Alternativas | Justificación |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Arquitectura en tiempo real móvil $\leftrightarrow$ TV | Local/offline, WebSockets | Firebase garantiza sincronización instantánea (<50ms) sin coste ni mantenimiento de servidores. |
| **DEC-02** | Regla estricta Eurovisión | Voto libre | Bloqueo de auto-voto en cliente y base de datos para garantizar imparcialidad total. |
| **DEC-03** | Dirección estética (`brandkit` + `minimalist-ui`) | Interfaz genérica / colorida | Estilo editorial gastronómico: fondo hueso `#F7F6F3`, serif con carácter y microanimaciones FLIP. |
| **DEC-04** | Estado de gala sincronizado en el documento | Coordinación local WebRTC | El admin muta `gala.votanteActualIndex` y la TV reacciona de forma determinista y sin desincronizaciones. |
| **DEC-05** | Formato de votación con contador de puntos libres | Desplegable numérico sin guía | Evita duplicar puntuaciones y orienta al usuario en tiempo real sobre qué puntos le quedan por asignar. |
| **DEC-06** | Exportación de texto para WhatsApp | Generar solo imagen | Un texto formateado es universal, se lee rápido en cualquier móvil y no depende de compresión de imagen. |
| **DEC-07** | Subida dual de fotos con compresión en el cliente | Solo admin o almacenamiento sin comprimir | Da total flexibilidad para que cada uno presuma de su plato, garantiza carga inmediata y no satura el ancho de banda. |
| **DEC-08** | Visualización combinada (Ranking + Foto activa) | Pantallas separadas para foto y ranking | Permite a los asistentes ver la foto de la tapa premiada mientras observan cómo su barra sube puestos en el marcador general. |
| **DEC-09** | Ficha completa (Nombre, foto, ingredientes, descripción) | Solo nombre y foto | Enriquece la experiencia de degustación, ayuda a personas con alergias y sirve de "chuleta" visual al votar. |
| **DEC-10** | Modo Degustación en TV previo a la votación | Solo usar la TV para los resultados | Da protagonismo a cada participante mientras presenta y sirve su plato. |
| **DEC-11** | Criterio de desempate por máxima puntuación | Sorteo aleatorio de desempate | Respeta la fidelidad del formato Eurovisión y premia a la tapa que más apasionó a los comensales. |
| **DEC-12** | Cierre forzoso de votación por el Admin | Bloquear la app hasta recibir el 100% de votos | Evita que un fallo de conexión o un olvido arruine el clímax de la fiesta. |

---

## 5. Casos Límite y Robustez

1. **Persistencia y Resiliencia**: Si el navegador de la TV se recarga o pierde conexión puntualmente, la suscripción en tiempo real recupera el estado exacto de la gala sin reiniciar la puntuación.
2. **Desempates Automáticos**: Cálculo ponderado en caso de empate según el número de puntuaciones máximas recibidas.
3. **Optimización Móvil**: Interfaz optimizada para pantallas táctiles con botones amplios, confirmación previa al sellado del voto y validación en tiempo real de puntuaciones faltantes.
