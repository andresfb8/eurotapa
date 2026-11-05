# Conexión entre el voto del móvil, la TV y las fases

> Revisión aplicada el 2026-11-05. Archivos afectados: `src/services/contestStore.ts`,
> `src/components/admin/AdminPanel.tsx`, `src/components/gala/PodiumView.tsx`,
> `src/components/gala/GalaTVView.tsx`, `src/components/voting/VotingView.tsx` y `src/App.tsx`.

## Lo que no conectaba

1. **Reabrir un voto no lo borraba en Firestore.** `setDoc(..., { merge: true })` fusiona los mapas
   anidados: al escribir el mapa `votes` sin una persona, su campo seguía vivo en el servidor y el
   siguiente snapshot lo devolvía. En el móvil parecía reabierto y al momento volvía a estar sellado.
2. **“Volver al inicio” del podio solo cambiaba `phase`.** Los votos y la gala seguían completos:
   al volver a la gala se entraba directamente en el podio y los participantes no podían revotar.
3. **Entrar en la gala no reiniciaba `gala`.** El índice de jurado y `revealedTapaIds` pertenecían a
   una lista de jurados anterior. Si se reabría un voto y se volvía a la gala, el revelado quedaba
   descuadrado (jurados saltados o puntos de otro jurado).
4. **El modo `auto` se recalculaba en cada render.** Añadir o quitar un equipo cambiaba el sistema
   de recuento a mitad del concurso: los votos ya emitidos pasaban a significar otra cosa.
5. **Reabrir un voto durante la gala** borraba la papeleta y encogía la lista de jurados bajo el
   índice actual, además de impedir que esa persona volviera a votar (la votación ya estaba cerrada).
6. **Eliminar el concurso activo** dejaba la sesión apuntando al id borrado; la siguiente edición
   volvía a crear el documento.
7. **Una gala sin votos** se pintaba como un podio con todas las tapas a 0 puntos.

## Lo que se cambió

- **Votos por campo.** `submitVote` escribe `votes.<memberId>` con `updateDoc`, que reemplaza solo
  ese objeto; un voto nuevo ya no puede pisar ni borrar el de otra persona. Las escrituras completas
  del concurso (`syncMultiToCloud`) omiten `votes` a propósito.
- **Borrado real al reabrir.** `removeVote` usa `updateDoc` con `deleteField()` sobre
  `votes.<memberId>`, que es la única forma de eliminar el campo en Firestore.
- **Reset y simulación reemplazan el mapa.** `updateDoc({ votes: {} })` / `updateDoc({ votes })`
  sustituyen el mapa completo, sin fusión.
- **Reinicio de verdad desde el podio.** El botón pasa a “Reiniciar concurso”, pide confirmación y
  llama a `resetContest` (borra votos, vuelve a Sorteo, reinicia la gala y la cata). Se conservan
  equipos, fichas, orden y horas.
- **La gala se reinicia al entrar.** `setPhase('GALA_TV')` desde otra fase crea un `gala` vacío;
  el índice siempre empieza en el jurado 1 de la lista actual.
- **El tipo de voto se congela con el primer voto.** A partir de ahí no se puede cambiar el modo ni
  añadir/quitar equipos hasta reiniciar la votación; la UI lo desactiva y el store lo rechaza.
- **Reabrir solo durante la votación.** El botón desaparece fuera de `VOTACION` y el store ignora
  la llamada; así no se puede perder una papeleta ni descolocar la gala.
- **Eliminar el concurso activo mueve la sesión** al siguiente concurso disponible.
- **Gala sin votos** muestra “Todavía no hay votos” en vez de un podio falso.
- **Vista previa del voto combinado en el móvil.** En modo equipo, al sellar, el móvil enseña el
  reparto combinado que la TV va a revelar (mismo `buildJuryVotes`), no solo la papeleta personal.

## Simulación de votos

La simulación también podía dejar el concurso en un estado engañoso: sustituía los votos sin
confirmación, saltaba a la gala con el modo `auto` sin congelar y, al no quedar marcada, era fácil
confundir los resultados de prueba con los reales. Ahora:

- El botón pide confirmación y avisa de que los votos actuales se pierden.
- La simulación congela el tipo de voto y reinicia la gala igual que un arranque normal.
- `ContestState.isSimulation` marca el concurso; el panel y la TV muestran una etiqueta
  “Simulación” mientras esté activa.
- `resetContest` limpia la marca; “Reiniciar Concurso” devuelve el concurso a un estado real.
- El mapa de votos se reemplaza entero (`setDoc(..., { mergeFields: ['votes'] })`), no se fusiona
  con los votos que hubiera, y funciona aunque el documento del concurso aún no haya terminado de
  crearse.

## Cómo probarlo

1. `npm run dev:sandbox` y entrar como organizador con `9999`.
2. Votar con Marta y con Luis (mismo equipo), sellar los dos y comprobar que la tarjeta de sellado
   muestra el voto combinado. Abrir la gala y comparar ese reparto con el que revela la TV.
3. En `Votación`, pulsar “Reabrir voto”, recargar y comprobar que sigue sin voto (no vuelve solo).
4. Empezar la gala, revelar dos jurados, volver a `Votación`, reabrir un voto, votar de nuevo y
   entrar en la gala: debe empezar por el jurado 1 con la lista nueva.
5. Terminar la gala, “Reiniciar concurso” y comprobar que vuelve a Sorteo, con 0 votos y los móviles
   listos para votar otra vez.
6. Con un voto sellado, intentar añadir un equipo: debe estar bloqueado.
7. “Simular Votos y Abrir Gala” → confirmar → comprobar la etiqueta “Simulación” en panel y TV,
   revelar unos jurados y “Reiniciar Concurso”: la etiqueta desaparece y el concurso vuelve a
   Sorteo con 0 votos.

## Pendiente / riesgos conocidos

- Un voto enviado justo cuando el organizador abre la gala puede llegar tarde si el móvil aún no ha
  recibido el cambio de fase (latencia de Firestore). No hay transacción ni `votesClosedAt`.
- El registro global `app_meta/registry` sigue escribiéndose desde cada organizador; uno que solo
  conozca su concurso puede dejar fuera los demás de la lista de acceso.
- Las reglas de Firestore siguen abiertas y el PIN de organizador se comprueba en el cliente.
