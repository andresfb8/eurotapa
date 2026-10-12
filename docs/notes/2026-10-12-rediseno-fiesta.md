# Rediseño "fiesta" (rama `rediseno-fiesta`)

> Cambios aplicados el 2026-10-12 en la rama `rediseno-fiesta`. `master` y la web publicada
> conservan el diseño anterior. Solo cambia la capa visual: ni `contestStore`, ni la puntuación,
> ni los tipos del concurso.

## Qué cambia

- **Base** (`src/styles/tokens.css`, `main.css`, `index.html`): paleta crema / tomate / azafrán /
  oliva, titulares en Bricolage Grotesque, botones píldora con sombra dura, tarjetas con borde de
  2px. Tema oscuro para la TV bajo `[data-theme="tv"]`. Se quita `user-scalable=no` del viewport.
- **Móvil, votación** (`voting/VotingView.tsx`, `RankingBallot.tsx`, `ConfirmDialog.tsx`):
  - Cabecera de una línea; la ficha propia se pliega durante cata y votación.
  - Progreso fijo arriba ("4/7" + barra segmentada) y botón de sellar fijo abajo.
  - Tapas por ordenar como rejilla de fotos: un toque añade y la etiqueta "+6" dice cuántos
    puntos se lleva. El botón "i" abre la ficha y la nota.
  - Filas del ranking con medalla de puntos sobre la foto, flechas y asa de arrastre a la derecha.
    "Quitar del ranking" está dentro de la ficha desplegada.
  - Confirmación como hoja inferior en móvil; pantalla de voto sellado con sello y confeti.
- **TV** (`components/tv/TVShell.tsx`, `TVStage.module.css`):
  - `TVStage` es un contenedor de tamaño que ocupa toda la pantalla; cada vista se mide en
    `cqw` / `cqh`. `TVShell` (TV pública) solo muestra una franja al mover el ratón.
  - `FullscreenButton` pone en pantalla completa el escenario, sin la barra del organizador.
  - **Gala**: marcador que reparte toda la altura, con barra de progreso respecto al líder; el
    último punto revelado sale en grande junto a la foto de la tapa; confeti en la máxima. Con más
    de 10 tapas el marcador pasa a dos columnas (el FLIP anima también el cambio de columna).
  - **Podio**: pedestales 2º-1º-3º y clasificación completa en columna lateral.
  - **Degustación y votación**: foto a sangre a la izquierda y ficha grande a la derecha.
  - **Sorteo**: rejilla de turnos con números gigantes.
  - Los controles del organizador van en una barra inferior (`canControl`).

## Probado en el modo de pruebas (`npm run dev:sandbox`)

- Móvil 375×812: acceso, cata, votación (añadir, arrastrar, hoja de confirmación, sellar) y
  segunda pantalla de la gala. Sin scroll horizontal.
- TV a 1920×1080 y 2560×1440: sorteo, degustación, votación, gala y podio sin scroll; a
  2560×1440 las filas del marcador miden 132px con títulos de 42px y puntos de 74px.

## Pendiente / a revisar

- Las flechas del ranking miden 48×36px (por debajo de los 48px de alto del resto de controles)
  para que la lista no crezca demasiado.
- No se ha probado con más de 10 tapas (marcador a dos columnas) ni en un televisor real.
- El panel de administración solo hereda los estilos base; no se ha rediseñado.
