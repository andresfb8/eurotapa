# Enlaces de acceso y política de PINs

> Cambios aplicados el 2026-09-28. Archivos afectados: `src/utils/appUrl.ts`, `src/utils/pins.ts`,
> `src/services/contestStore.ts`, `src/components/admin/AdminPanel.tsx`,
> `src/components/admin/CreateContestModal.tsx`, `src/components/auth/LoginView.tsx`, `src/App.tsx`.

## Problema 1 — Los enlaces salían como `localhost`

`AdminPanel` construía el enlace con `window.location.origin`, es decir la URL desde la que navegaba
el organizador. En desarrollo eso producía `http://localhost:5174/?c=...&pin=...`, inútil para quien
lo recibía por WhatsApp.

**Solución**
- `src/utils/appUrl.ts` centraliza la URL pública. Se configura con `VITE_PUBLIC_URL` (`.env`) y, si no
  existe, cae al host actual y por último a `https://eurotapa-2026.web.app`.
- El panel avisa cuando se está sirviendo en local, recordando que los enlaces apuntan al sitio publicado
  y que hay que desplegar para que los concursantes reciban la última versión.

## Problema 1b — El enlace no funcionaba en otro móvil

El estado de los concursos vivía solo en el `localStorage` del organizador. Se escribía en Firestore
(`concursos/{id}` y el resumen `app_meta/registry`) pero **nunca se leía**: no había ninguna llamada a
`getDoc`. En un dispositivo nuevo, `?c=...&pin=...` no encontraba el concurso, caía al concurso demo y
el PIN daba "código no reconocido".

**Solución**
- `resolveAccessFromUrl()` lee los parámetros `c` / `pin` / `role`, descarga el concurso con `getDoc` si no
  está en caché y resuelve la sesión (participante, TV o superadmin) antes de renderizar. Mientras tanto la
  app muestra "Cargando concurso…".
- Los parámetros de la URL se consumen una sola vez y se limpian con `history.replaceState`, para que el PIN
  no quede visible en la barra de direcciones y para que "Salir" no se deshaga al recargar.
- El registro `app_meta/registry` se lee al mostrar el login, de modo que un móvil nuevo puede listar los
  concursos y descargar bajo demanda el que elija (login sin enlace).
- Los dispositivos de participantes **no** reescriben `app_meta/registry` (`registryWritesEnabled`), porque
  solo conocen su propio concurso y lo dejarían incompleto.

## Problema 2 — PINs repetidos entre concursos

Los PIN se generaban como `1001, 1002, 1003...` en cada concurso, así que colisionaban casi siempre. Al
iniciar sesión sin contexto de concurso, `loginWithCode` recorría todos los concursos y entraba en el
**primero** que coincidía, sin avisar. Además el `adminPin` de *cualquier* concurso servía como superadmin.

**Solución**
- `src/utils/pins.ts` genera PINs únicos dentro del concurso (hueco libre 1001-1099 y, si se agota, aleatorio
  de 4 dígitos), nunca `9999`.
- El contexto manda: si el enlace o el selector indican un concurso, el PIN se valida **solo** en ese concurso
  y nunca se cae a otro.
- Sin contexto, si el PIN existe en varios concursos se pide elegir concurso en lugar de adivinar.
- Superadmin: solo el PIN maestro `9999` o el `adminPin` del concurso seleccionado.
- Los participantes se comprueban antes que el `adminPin`, de modo que un `adminPin` que coincida con el PIN
  de un participante no le da acceso de administrador a esa persona.

## Cómo probar

1. `npm run dev` y entrar como superadmin con `9999`.
2. Crear un concurso y copiar el enlace de un participante: debe empezar por `https://eurotapa-2026.web.app`.
3. Abrir ese enlace en una ventana de incógnito (dispositivo "nuevo"): debe entrar directamente al espacio
   personal del participante correcto, incluso si el PIN existe en otro concurso.
4. Probar un enlace con un PIN que no pertenece al concurso: debe mostrar un aviso claro, no entrar.
5. `npm run build && firebase deploy --only hosting` para publicar.

## Riesgos aceptados / pendientes

- **Reglas de Firestore abiertas** (`allow read, write: if true`). Cualquiera que conozca el id de un concurso
  puede leer votos y PINs, o modificarlos. Aceptado de momento para un concurso entre amigos.
- **PIN en la URL**: quien reenvíe su enlace reenvía su acceso.
- **Votos concurrentes**: cada móvil guarda el mapa completo de `votes`, así que dos votos enviados en el mismo
  instante podrían pisarse. Mitigable escribiendo por campo (`votes.<id>`) en una próxima iteración.
- **Registro global**: `app_meta/registry` es un único documento compartido por todos los concursos del proyecto.
