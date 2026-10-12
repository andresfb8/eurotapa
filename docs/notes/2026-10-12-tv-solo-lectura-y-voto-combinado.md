# TV de solo lectura, voto combinado por equipo y limpieza de interfaz

> Cambios aplicados el 2026-10-12. Archivos nuevos: `src/utils/juries.ts`,
> `src/components/Icons.tsx`, `src/components/ConfirmDialog.tsx`. Archivos afectados:
> `src/App.tsx`, `src/utils/scoring.ts`, `src/services/contestStore.ts` y los componentes de
> draw, tasting, gala, voting, auth, admin, `Navigation` y `RulesModal`.

## 1. Voto combinado por equipo

Antes cada persona era un jurado y sus puntos se sumaban tal cual, así que una tapa de 3
cocineros recibía votos de menos gente que una individual. Ahora cada persona sigue votando
en su móvil, pero la gala y la clasificación usan **un voto por tapa** (`buildJuryVotes`):

- Se suman los puntos que los miembros del equipo dieron a cada tapa rival.
- Las rivales se ordenan por esa suma y el equipo reparte de nuevo `N_tapas − 1 … 1`.
- Empate en la suma: gana la que tenga las notas individuales más altas; si siguen iguales,
  la que se sirvió antes (`tastingOrder`).
- Si falta el voto de algún miembro se combina con los que hayan votado (la TV lo indica);
  un equipo donde no ha votado nadie no reparte puntos.

`state.votes` sigue guardando un `VoteRecord` por persona; el voto del equipo se calcula al
vuelo. `gala.currentVoterIndex` pasa a ser el índice del jurado (equipo), no de la persona.

## 2. Pantalla de TV de solo lectura

El Modo TV se abre sin PIN, así que ya no muestra ningún control (`canControl = false`):
ni sorteo, ni pasar tapas, ni abrir votación, ni revelar votos, ni reiniciar. El organizador
lo maneja todo desde la pestaña "Ver TV" del panel de superadmin.

## 3. Interfaz

- Las pistas de PIN de la pantalla de acceso solo aparecen en desarrollo (`import.meta.env.DEV`).
- La confirmación al sellar el voto es un diálogo propio que muestra el reparto completo.
- Emojis sustituidos por iconos SVG (`Icons.tsx`); los mensajes de WhatsApp los conservan.

## 4. Sorteo con antelación

El sorteo se hace días antes del concurso para que los equipos piensen y ensayen su tapa.
`ContestState.drawDoneAt` (fecha ISO) marca que el orden es oficial:

- **Sin sortear:** la TV y los móviles muestran "Sorteo pendiente" y no enseñan turnos. El
  organizador puede sortear al azar o colocar los equipos a mano y pulsar "Fijar este orden
  sin sortear".
- **Sorteado:** cada persona ve en su móvil su turno, la hora y el orden completo (solo
  nombres). El botón de sorteo pasa a "Repetir Sorteo" y pide confirmación.
- **Imprevistos:** las flechas siguen moviendo equipos después del sorteo; el cambio llega al
  momento a los móviles. Las horas (`tastingTime`) pertenecen al turno, así que al
  intercambiar dos equipos cada uno hereda la hora de su nuevo puesto.

El sorteo se puede hacer desde el propio panel de admin (tarjeta "Sorteo y Horario de
Turnos") o en directo desde "Ver TV"; ambos usan `runAnimatedDraw` (`src/utils/draw.ts`,
barajado Fisher–Yates). Las horas son opcionales: "Poner horas" las genera y "Quitar horas"
deja solo el orden de salida.

Los concursos existentes no tienen `drawDoneAt` y aparecen como "Sorteo pendiente" hasta
que se sortee o se fije el orden actual.

## 5. Votación

- **Voto por orden** (`RankingBallot.tsx`): se tocan las tapas de la favorita a la que menos
  y la posición decide los puntos (`N_tapas − 1 … 1`). Después se ajusta arrastrando o con
  las flechas. Durante el arrastre las filas no cambian de sitio en el DOM (mover el nodo
  suelta el `pointer capture`): se desplazan con `transform` y el orden se aplica al soltar.
- El ranking a medias se guarda en `localStorage` (`eurotapa_vote_draft_<memberId>`) y se
  borra al sellar.
- **La votación se cierra al empezar la gala**: en `GALA_TV` / `PODIO` quien no votó ve
  "Votación cerrada" y `submitVote` ignora los votos fuera de `VOTACION`.
- **TV durante la votación** (`VotingTVView.tsx`): pase automático de todas las tapas en
  orden de salida (10 s cada una) con el contador de votos sellados.
- **Empates totales**: comparten puesto (1º, 1º, 3º). Con 0 puntos no se comparte, para que
  el marcador no arranque con todas en primer lugar.

## 5b. El móvil durante la gala (`GalaCompanion.tsx`)

En `GALA_TV` y `PODIO` el portal del participante sustituye la ficha por una segunda
pantalla centrada en su tapa. Solo usa lo que la TV ya ha revelado (`gala.revealedTapaIds`
y los jurados anteriores a `currentVoterIndex`):

- **Gala:** puesto y puntos en directo, distancia al puesto de arriba, jurados que faltan
  por puntuarla, aviso "X te acaba de dar N puntos", aviso cuando su propio voto está en
  pantalla, puntos recibidos por jurado y clasificación en directo.
- **Podio:** puesto final, "mayor fan", puntos recibidos de cada jurado, el voto que emitió
  su equipo, clasificación final y botón para copiar su resultado para WhatsApp.

## 6. Modo de pruebas (sandbox)

`npm run dev:sandbox` (puerto 5174, modo Vite `sandbox`, `.env.sandbox`) arranca la app con
el concurso de demostración guardado solo en el navegador: no lee ni escribe en Firestore
y usa claves de `localStorage` propias. Sirve para recorrer todas las fases sin tocar
concursos reales. PIN de demo: `9999` (organizador) y `1001`… (participantes).

## Riesgos aceptados / pendientes

- El bloqueo de la TV es solo de interfaz: las reglas de Firestore siguen abiertas.
- `MASTER_PIN` (`9999`) sigue abriendo el panel de cualquier concurso.
- Reabrir o borrar un voto a mitad de gala cambia la lista de jurados y puede descuadrar el
  índice del jurado actual.
