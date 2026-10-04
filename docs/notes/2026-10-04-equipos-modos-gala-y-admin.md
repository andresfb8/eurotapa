# Equipos por tapa, modos de gala y nuevas opciones del admin

> Cambios aplicados el 2026-10-04. Archivos nuevos: `src/utils/teams.ts`,
> `src/utils/contestMigration.ts`. Archivos afectados: `src/types/contest.ts`,
> `src/services/mockData.ts`, `src/services/contestStore.ts`, `src/utils/scoring.ts`,
> `src/utils/whatsappExport.ts`, `src/utils/pins.ts`, `src/App.tsx` y los componentes
> de `src/components/` (draw, tasting, voting, gala y admin).

## 1. Equipos de hasta 3 personas por tapa

Hasta ahora el modelo era "una persona = una tapa = un PIN = un voto". Ahora hay dos entidades:

- **Team (tapa)**: `dishName`, `ingredients`, `description`, `photoUrl`, `tastingOrder`,
  `tastingTime`. Es la unidad que se cocina, se sortea y se puntúa.
- **Member (persona)**: `name`, `pin`, `teamId`. Cada persona emite su propio voto.

Implicaciones:

- El **sorteo** baraja equipos, no personas; la tarjeta de la TV muestra los nombres del
  equipo y sigue sin desvelar el plato. El mensaje de WhatsApp también agrupa por equipo.
- La **votación** reparte `N_tapas − 1 … 1` puntos y nadie puede votar la tapa de su
  propio equipo (el bloqueo es a nivel de equipo, no de persona).
- El **ranking y la gala** son por tapa; el spotlight de la gala sigue siendo por persona
  (cada miembro es un jurado), pero sus puntos suman a la tapa rival.
- Cualquier miembro del equipo puede editar la ficha compartida desde su móvil.

## 2. Migración automática

`normalizeContest()` convierte cualquier documento antiguo (array `participants`) en
equipos + miembros conservando los ids originales, de modo que votos, `revealedTapaIds` y
`activeTastingId` siguen siendo válidos. Los concursos antiguos quedan como equipos de
1 miembro y con modo de gala `CLASICA`. Al escribir en Firestore se elimina el campo
legado `participants` con `deleteField()`.

Probado con un test temporal de migración (documento legacy → equipos/miembros/votos
intactos) y en navegador con el flujo completo.

## 3. Modos de revelado de la gala (`galaMode`)

Configurables desde el panel (sección "Configuración de la Gala") y en caliente:

- **CLASICA** (por defecto): cada punto, de 1 a la máxima, uno a uno.
- **DRAMATICA**: los puntos bajos se entregan en un solo clic ("Reparto rápido") y el
  Top 3 se revela después uno a uno.
- **MAXIMA**: reparto rápido + solo la puntuación máxima.
- **DIRECTA**: el voto completo de cada jurado, de golpe.

El estado guarda `history` (una entrada por clic) para poder **deshacer**: el botón
"Deshacer" revierte el último paso y, si el jurado actual no tiene nada revelado, vuelve
al jurado anterior con sus puntos ya desplegados.

## 4. Otras opciones nuevas del admin

- **Reabrir voto** de una persona concreta (sin borrar toda la votación).
- **Recordatorio de votación** para copiar al grupo de WhatsApp, con la lista de pendientes.
- **PIN editable** por persona y botón para regenerarlo.
- **Copiar todos los enlaces** de acceso de una sola vez.
- **Horario automático de turnos**: hora de inicio + minutos por tapa → rellena
  `tastingTime` de cada equipo, que sale en el mensaje de WhatsApp del sorteo.

## Cómo probar

1. `npm run dev` y entrar como superadmin con `9999`.
2. El concurso demo trae 8 tapas y 13 personas (varios equipos de 2 y 3); comprobar la
   sección "Equipos de este Concurso".
3. Crear un concurso nuevo escribiendo una tapa por línea, con los miembros separados por
   comas (`Marta, Luis`).
4. "Simular Votos y Abrir Gala" → elegir modo dramático → "Ver TV" → "Reparto rápido" y
   Top 3, probando también "Deshacer" a mitad.
5. Abrir el enlace de una persona (con `?c=…&pin=…`) y sellar su voto de `N_tapas − 1` a 1.

## Riesgos aceptados / pendientes

- Los documentos antiguos solo se limpian al escribirlos; hasta entonces Firestore
  conserva el campo `participants` (ignorado por la app).
- Sigue pendiente la escritura por campo de votos concurrentes (dos votos simultáneos
  pueden pisarse) y las reglas de Firestore abiertas.
- Con equipos grandes el sorteo muestra nombres largos; el layout de tarjetas está
  preparado para partirse en varias líneas, pero conviene revisarlo en la TV real.
