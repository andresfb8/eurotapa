# Enlace con PIN, fichas con foto y sincronización real con la nube

> Cambios aplicados el 2026-11-16. Archivos nuevos: `src/services/cloudStatus.ts` y esta nota.
> Archivos afectados: `src/services/firebase.ts`, `src/services/contestStore.ts`,
> `src/utils/contestMigration.ts`, `src/components/auth/LoginView.tsx`,
> `src/components/admin/AdminPanel.tsx`, `src/components/RulesModal.tsx`, `src/utils/appUrl.ts`,
> `src/utils/whatsappExport.ts`, `src/App.tsx` y
> `docs/notes/2026-09-28-enlaces-acceso-y-pines.md` (referencia).

## 1. El enlace no lleva el PIN; el PIN solo va en el mensaje

**Lo que pasaba.** El enlace `?c=…&pin=…` creaba la sesión del participante sin pedir nada, así que
nadie sabía cuál era su código. Al pasar a "pedir el PIN", la pantalla lo mostraba para saludar por
su nombre… y entonces el enlace volvía a ser la llave: quien lo recibiera podía entrar.

**Cómo funciona ahora.**

- El enlace es solo `?c=<concurso>`: elige el concurso y nada más. Nunca identifica a nadie.
- La pantalla de acceso pide el PIN y **no** muestra ningún código.
- El código viaja únicamente en el mensaje privado de WhatsApp, que genera el panel: nombre, código
  y enlace (`formatParticipantAccessMessage`). Los enlaces viejos con `?pin=` se ignoran: el
  parámetro se borra de la barra de direcciones y la persona tiene que teclear su código.
- `role=tv` sigue entrando directo (la pantalla de TV no tiene controles ni datos personales).

## 2. Los cambios del organizador no llegaban a los móviles

`normalizeContest()` deja los campos opcionales como `undefined` (`photoUrl`, `tastingTime`,
`lastAwardedTapaId`, `createdAt`…). Firestore rechaza cualquier documento con un `undefined`:

```
Function setDoc() called with invalid data. Unsupported field value: undefined
```

El error quedaba en un `console.warn` y la escritura se perdía: el sorteo, la fase y las fichas
vivían solo en el navegador del organizador, y los móviles seguían leyendo el documento antiguo
(entraban con su enlace pero veían "Sorteo pendiente"). Comprobado con el SDK real
(`firebase@12.19.0`).

- `initializeFirestore(app, { ignoreUndefinedProperties: true })` en `src/services/firebase.ts`.
- `stripUndefined()` limpia además el payload, respetando los `FieldValue` (`deleteField()`).
- Los fallos ya no son silenciosos: `src/services/cloudStatus.ts` los registra por operación y el
  panel muestra **"Los cambios no están llegando a la nube"** con el detalle.

## 3. Fichas, fotos y gala

Tres fallos más, encontrados probando el circuito completo "el concursante manda su tapa → la TV y
la gala la enseñan":

### 3.1. El historial de la gala no se podía guardar

`gala.history` es una lista de clics y cada clic es una lista de tapas (`string[][]`). Firestore
**no admite arrays anidados** (`Nested arrays are not supported`), así que la primera pulsación de
"revelar" hacía fallar la escritura y la gala no avanzaba en los demás móviles. Ahora viaja como
`"a|b"` y `normalizeGala()` lo vuelve a partir al leer.

### 3.2. Las fotos no caben en el documento del concurso

Una foto es un data URL de 60-200 KB y el límite de Firestore es **1 MiB por documento**: con nueve
fotos, cualquier escritura fallaría. Cada foto vive ahora en su propio documento
(`concursos/{id}/fotos/{teamId}`), se lee en vivo y se mezcla con el equipo para las pantallas
(`state`); en el documento del concurso el campo `photoUrl` del equipo queda vacío.

### 3.3. Incidente: `teams.0.dishName` corrompió un concurso

La primera versión de la escritura "por campo" usaba una ruta con índice (`teams.0.dishName`).
Firestore **no indexa arrays con rutas**: interpretó `0` como clave de mapa y **sustituyó el array
`teams` por un mapa con un solo equipo**, borrando los otros ocho del concurso
`contest_mwjgow16`. Se restauraron los nueve equipos a partir de los 16 miembros (ids
`t_mwjgow16_1…9`, fichas vacías) y se borró `drawDoneAt`, porque el orden sorteado se perdió con
los equipos.

La escritura correcta es una **transacción**: leer el documento, buscar el equipo por su `id`,
parchear sus cuatro campos y volver a escribir el array completo. Nunca rutas con índice.

## 4. Varias personas en la misma tapa: quién rellena la ficha

La ficha (nombre, foto, ingredientes y descripción) es **del equipo**, no de una persona: cualquiera
de sus miembros puede completarla, y no hay un "dueño" del plato.

**Lo que pasaba.** Al guardar se escribía la ficha entera con la copia que tenía ese móvil, así que
el último que guardaba machacaba lo del otro: si Ana cambiaba el nombre mientras Luis escribía la
descripción, uno de los dos cambios desaparecía. Con la foto pasaba lo mismo (podía quedar sin foto
recién subida).

**Lo que hace ahora.**

- `TapaEditModal` guarda una copia de la ficha **tal como estaba al abrirla** y la manda como
  `baseline`; la transacción compara campo a campo y escribe **solo lo que esa persona ha cambiado**.
  Si Ana pone el nombre y Luis la descripción y la foto, se quedan las tres cosas.
- Si no tocas la foto, no se reescribe (y no puede borrar la que acaba de subir tu compañero).
- Cada guardado firma la ficha (`lastEditedBy` / `lastEditedAt`) y la tarjeta muestra
  "Ficha actualizada por Ana", con el recordatorio de que entre los dos podéis editarla.

**Límite conocido.** Si los dos cambian **el mismo campo** a la vez, gana el último: no hay fusión de
texto ni bloqueo. Para un equipo de 2-3 personas basta con que uno lleve la foto y el otro el texto.

## Cómo probar

1. `npm run dev` y entrar como organizador.
2. "Equipos de este Concurso" → **Mensaje** en una persona: el texto lleva su nombre, su código y un
   enlace `?c=…` **sin** PIN.
3. Abrir ese enlace en una ventana de incógnito: pide el PIN, no enseña ningún código y no entra
   solo. Escribirlo y entrar.
4. Entrar como participante, "Editar ficha y foto": guardar nombre, ingredientes, descripción y una
   foto. En Firestore: `teams` sigue siendo un array, la ficha está en su equipo y la foto en
   `concursos/{id}/fotos/{teamId}`.
5. Equipo de dos personas: abrir la ficha con una, guardar la descripción con la otra y después
   cambiar solo el nombre con la primera. En Firestore deben quedar las dos cosas y `lastEditedBy`
   con el nombre de quien guardó al final.
6. Abrir el enlace TV (`?c=…&role=tv`): en degustación debe enseñar el nombre, los ingredientes y la
   foto; en la gala, la tapa con su foto al revelar sus puntos.
7. Hacer el sorteo y comprobar en otro móvil que aparece "Orden oficial · sorteado el …".

## Pendiente / riesgos conocidos

- Las reglas de Firestore siguen abiertas (`allow read, write: if true`): cualquiera con el id de un
  concurso puede leer sus fichas y sus fotos.
- El PIN se comprueba en el cliente. Ahora no viaja en el enlace, pero sigue siendo un código de 4
  dígitos.
- Si un móvil guarda la ficha justo cuando el organizador elimina equipos, la transacción reescribe
  el array con el equipo encontrado por id: no rompe nada, pero puede reintroducir un equipo que se
  acaba de borrar si la lectura y la escritura se cruzan.
- Las fotos se guardan como data URL en su documento: bien por debajo del 1 MiB, pero un concurso de
  muchas tapas multiplica las lecturas al abrir la app.
