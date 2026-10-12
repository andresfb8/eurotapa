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

## 2. Dirección de Diseño e Identidad Visual ("fiesta")

> Rama `rediseno-fiesta`. Sustituye a la dirección editorial minimalista anterior (fondo hueso,
> serif fina y pasteles desaturados), que sigue en `master`.

Una cena entre amigos, no una revista: color, tipografía con carácter y botones que apetece pulsar.

* **Paleta** (`src/styles/tokens.css`):
  * Lienzo crema cálido `#FFF4E3`, superficies blancas, tinta berenjena `#1E1A2B`.
  * Acentos saturados: **tomate** `#E8472B` (acción principal), **azafrán** `#FFB81F` (puntos,
    líder, oro) y **oliva** `#5C8A3A` (confirmado).
  * Pasteles semánticos más vivos para avisos y estados.
* **Tema TV** (`[data-theme="tv"]`): escenario oscuro berenjena con el azafrán como color de los
  puntos, para que fotos y cifras destaquen desde el otro lado del salón.
* **Tipografía**: titulares, nombres de plato y cifras grandes en `Bricolage Grotesque` (700–800);
  cuerpo en `Geist`; etiquetas y contadores pequeños en `Geist Mono`.
* **Forma**: radios de 10–22px, botones píldora con sombra dura desplazada ("pegatina"), bordes de
  2px. Animaciones cortas con rebote; todo respeta `prefers-reduced-motion`.
* **Móvil**: objetivos táctiles de 48px, acción principal fija abajo y al alcance del pulgar,
  confirmaciones como hoja inferior, textos de 16px para que el teléfono no haga zoom.
* **TV (monitor de 27")**: cada pantalla ocupa el 100% del monitor sin scroll. El escenario es un
  contenedor de tamaño y todo se mide en `cqw` / `cqh`, así que se ve igual en 1920×1080 y en
  2560×1440. Los controles del organizador van en una barra inferior que la TV pública no muestra.
* **Restricciones**:
  * Sin emojis en la interfaz; iconos SVG (`Icons.tsx`) y confeti en CSS (`Confetti.tsx`).
  * Sin degradados chillones sobre el contenido: solo halos suaves de fondo.

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
| **DEC-03** | Dirección estética "fiesta": crema, tomate y azafrán, con TV oscura | Estilo editorial minimalista (el anterior) | Es una cena entre amigos: más color y carácter, votación cómoda con el pulgar y una TV que se lee de lejos. |
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
