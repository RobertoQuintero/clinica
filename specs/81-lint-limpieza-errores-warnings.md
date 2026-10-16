# 81 — Lint: limpiar errores y warnings (excepto `set-state-in-effect`)

## Header

- **Estado:** Implementado
- **Depende de:** ninguna spec funcional. La futura spec 82 (`react-hooks/set-state-in-effect`) parte del estado que deja esta.
- **Modifica base de datos:** No.
- **Fecha:** 2026-10-15
- **Objetivo:** Que `npm run lint` termine sin warnings y sin errores de ninguna regla salvo `react-hooks/set-state-in-effect`, arreglando el código en vez de desactivar reglas y sin cambios funcionales visibles en ninguna pantalla.
- **Línea base (2026-10-15):** 131 problemas (78 errores, 53 warnings):
  - 71 `react-hooks/set-state-in-effect` (error), fuera de esta spec;
  - 45 `@typescript-eslint/no-unused-vars` (warning);
  - 7 `react-hooks/exhaustive-deps` (warning);
  - 3 `react-hooks/rules-of-hooks` (error);
  - 3 `@typescript-eslint/no-explicit-any` (error);
  - 1 `prefer-const` (error);
  - 1 `@next/next/no-img-element` (warning).

  Resultado esperado: **70 errores, todos `set-state-in-effect`** (uno de los 71 vive en `page copy.tsx`, que se borra) y **0 warnings**.

## Alcance

**Incluye:**

- **Borrar `app/dashboard/citas/page copy.tsx`.** Es una copia vieja de `citas/page.tsx` que nadie importa. Git conserva su historial.
- **`@typescript-eslint/no-unused-vars` (45).**
  - Se borran los imports, variables y funciones sin usar.
  - Si el parámetro sin usar es obligatorio por la firma (un callback o una posición fija), se le pone el prefijo `_` y `eslint.config.mjs` gana `argsIgnorePattern: "^_"`. Ese es el único cambio de configuración permitido.
  - Caso especial, `TabGeneral.tsx`: se borran `const url = ...` y la línea comentada `// window.open(url, "_blank")`.
- **`react-hooks/exhaustive-deps` (7).**
  - Las funciones `fetchX` de `servicios/page.tsx`, `servicios/[id_servicio]/opciones/page.tsx`, `usuarios/page.tsx`, `pacientes/[id]/expediente/useExpediente.ts` y `pacientes/[id]/expediente_medico/useExpedienteMedico.ts` se envuelven en `useCallback` y se agregan a las dependencias de su effect.
  - `TabPagar.tsx`: se agrega `onPagoFormChange` a las dependencias. El padre (`consultas/[id_consulta]/page.tsx`) pasa `setPagoForm`, un setter de `useState` ya estable, así que no cambia nada en el padre.
  - `pedidos/nuevo/page.tsx`: se quita `lines`, que sobra, de las dependencias del `useMemo`.
- **`react-hooks/rules-of-hooks` (3), en `TabGeneral.tsx`.** Los dos `useEffect` que reportan `totalServicios` y `totalProductos` al padre, y el `useAuth()`, se suben arriba del `return` temprano (`"No se encontró información."`). No llevan guarda: si la consulta no carga, los effects también corren.
- **`@typescript-eslint/no-explicit-any` (3).**
  - `database/connection.ts`: `ITransactionClient.queryParams` copia la firma real de `DB.queryParams` (devuelve el `IRecordSet` de `mssql`) sin escribir `any`.
  - `conteos/actions.ts`: el parámetro `tx` de `assertStockCountOwnership` usa `ITransactionClient`.
  - `citas/actions.ts`: `commonParams: any` pasa a `Record<string, unknown>`.
- **`prefer-const` (1):** `submitForm` en `useExpediente.ts` pasa a `const`.
- **`@next/next/no-img-element` (1):** `ImageSliderModal.tsx` usa `next/image`, y `next.config.ts` agrega Cloudinary a `images.remotePatterns`.

**No incluye:**

- `react-hooks/set-state-in-effect` (71 errores): es la spec 82, que se definirá en su propio `/spec`.
- Migrar fetch del cliente (`useEffect` + server action) a Server Components. Cada feature tendrá su propia spec.
- Quitar o revisar los `// eslint-disable-line react-hooks/exhaustive-deps` que ya existen y no generan warning.
- Desactivar o bajar la severidad de cualquier regla en `eslint.config.mjs` (solo se agrega `argsIgnorePattern`).
- Agregar lint a CI o a un hook de pre-commit.
- Arreglos que no reporte el linter, aunque se encuentren al tocar los archivos (por ejemplo, el `new Date(paciente.created_at)` de `TabGeneral.tsx`, que va contra la regla de fechas de `CLAUDE.md`).

## Modelo de datos

**Base de datos:** sin cambios. **Datos nuevos:** ninguno. Solo cambian tipos y configuración.

### Tipos: `database/connection.ts`

`ITransactionClient` deja de escribir `any` y toma la firma de `DB.queryParams`. `DB.queryParams` sigue sin anotar su retorno, así que lo infiere de `result.recordset` como `Promise<sql.IRecordSet<any>>`, que es lo mismo que reciben hoy los 10 archivos que usan la interfaz.

```ts
/** Cliente con la misma firma que DB.queryParams, pero atado a una transacción. */
export interface ITransactionClient {
  queryParams: DB["queryParams"];
}
```

- `DB` se declara más abajo en el mismo archivo. Como es una referencia de tipo, no importa el orden.
- El objeto `client` dentro de `DB.transaction` debe seguir cumpliendo la interfaz sin casts.

### Tipos: `app/dashboard/conteos/actions.ts`

```ts
async function assertStockCountOwnership(
  tx: ITransactionClient,   // antes: { queryParams(...): Promise<any[]> }
  id_stock_count: number,
  id_sucursal: number,
  id_empresa: number,
): Promise<{ status: StockCountStatus; id_user_counter: number }>
```

### Tipos: `app/dashboard/citas/actions.ts`

```ts
const commonParams: Record<string, unknown> = { ... };   // antes: any
```

Coincide con lo que acepta `db.queryParams(sql, params: Record<string, unknown>)`.

### Configuración: `eslint.config.mjs`

Se agrega un bloque después de `...nextTs`:

```js
{
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
},
```

### Configuración: `next.config.ts`

El cloud name se toma de `CLOUDINARY_URL` (`cloudinary://<api_key>:<api_secret>@<cloud_name>`): es lo que va después del `@`. Solo se extrae esa parte; la key y el secret nunca se copian a la configuración.

```ts
/** Cloud name de Cloudinary: lo que sigue al "@" en CLOUDINARY_URL. */
const cloudinaryCloudName = process.env.CLOUDINARY_URL?.split("@")[1]?.trim();

images: {
  remotePatterns: [
    { /* Facturapi, sin cambios */ },
    // Fotos de tratamientos subidas por app/api/upload (spec 81).
    ...(cloudinaryCloudName
      ? [{ protocol: "https" as const, hostname: "res.cloudinary.com", pathname: `/${cloudinaryCloudName}/**` }]
      : []),
  ],
},
```

- **Sin `CLOUDINARY_URL`:** no se agrega el patrón. El build no truena, pero `ImageSliderModal` no podrá mostrar las fotos. Es el mismo escenario en que hoy tampoco funcionan las subidas.
- `remotePatterns` se fija al hacer `next build` / `next dev`: si cambia la cuenta de Cloudinary, hay que volver a construir.

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional. Después de cada paso, `npm run lint` debe mostrar menos problemas que antes y ningún tipo nuevo de problema.

1. **Archivo muerto, `prefer-const` y configuración de ESLint.**
   - Borrar `app/dashboard/citas/page copy.tsx` y confirmar con `grep` que nadie lo importa.
   - `useExpediente.ts`: cambiar `let submitForm` a `const`.
   - `eslint.config.mjs`: agregar el bloque con `argsIgnorePattern: "^_"`.

2. **`no-explicit-any` (3).**
   - `database/connection.ts`: `ITransactionClient.queryParams: DB["queryParams"]`.
   - `conteos/actions.ts`: el parámetro `tx` de `assertStockCountOwnership` usa `ITransactionClient`.
   - `citas/actions.ts`: `commonParams: Record<string, unknown>`.
   - Verificar que el build no muestre errores de tipos en los 10 archivos que usan `ITransactionClient`.

3. **`rules-of-hooks` (3) en `TabGeneral.tsx`.**
   - Subir los dos `useEffect` de totales y el `useAuth()` arriba del `return` temprano.
   - Cualquier valor que necesiten y que hoy se calcule entre el `return` y su posición actual (`totalServicios`, `totalProductos`) también sube, sin cambiar su cálculo.
   - Prueba manual: abrir una consulta con servicios y productos, cambiar cantidades y confirmar que los totales del padre (pestaña Pagar) se actualizan igual que antes.

4. **`exhaustive-deps` (7).**
   - Envolver en `useCallback` las funciones `fetchX` y agregarlas a las dependencias:
     - `servicios/page.tsx` (`fetchServicios`);
     - `servicios/[id_servicio]/opciones/page.tsx` (`fetchData`);
     - `usuarios/page.tsx` (`fetchUsuarios`, `fetchSucursales`);
     - `useExpediente.ts` (`fetchPaciente`, `fetchConsultas`, `fetchLatestAntecedente`);
     - `useExpedienteMedico.ts` (`fetchPaciente`, `fetchAntecedentes`).
   - Las dependencias de cada `useCallback` son las que pida el linter. Ninguna debe ser un objeto o una función que se vuelva a crear en cada render.
   - `TabPagar.tsx`: agregar `onPagoFormChange` a las dependencias. No cambia nada en el padre: es `setPagoForm`, ya estable.
   - `pedidos/nuevo/page.tsx`: quitar `lines` de las dependencias del `useMemo`.
   - Prueba manual en cada pantalla:
     - carga una sola vez al entrar;
     - recarga cuando cambia lo que antes la recargaba (sucursal o id en la ruta);
     - en la pestaña Network no hay peticiones repetidas en bucle.

5. **`no-img-element` (1).**
   - `next.config.ts`: derivar `cloudinaryCloudName` de `CLOUDINARY_URL` y agregar el patrón condicional a `images.remotePatterns`.
   - `ImageSliderModal.tsx`: cambiar `<img>` por `next/image`, conservando el `<a target="_blank">` que lo envuelve, el `alt`, y el tamaño y aspecto actuales (`max-h-[60vh] max-w-full object-contain`).
   - Prueba manual: abrir el slider de imágenes de un tratamiento con varias fotos, recorrerlas y abrir una en otra pestaña.
   - Reiniciar `next dev` después de editar `next.config.ts`.

6. **`no-unused-vars` (45).**
   - Borrar imports, variables y funciones sin usar, archivo por archivo.
   - Ponerle `_` solo a los parámetros que exige una firma.
   - En `TabGeneral.tsx`, borrar `const url = ...` y `// window.open(url, "_blank")`.
   - Si borrar una variable deja sin uso otra cosa (un import, un estado), se borra también.
   - Si una variable "sin usar" en realidad se lee mediante un efecto secundario de su inicialización (por ejemplo, la llamada a un hook), se conserva la llamada y solo se quita la asignación.

7. **Verificación final.**
   - `npm run lint`: 0 warnings y 70 errores, todos `react-hooks/set-state-in-effect`.
   - `npm run build`: exitoso.
   - Recorrer las pantallas tocadas en los pasos 3 a 5.

## Criterios de aceptación

**Lint y build**

- [x] `npm run lint` reporta **0 warnings**.
- [x] `npm run lint` reporta **70 errores**, y los 70 son `react-hooks/set-state-in-effect`. *(Resultado real: **69**, todos `set-state-in-effect`. Baja uno porque al borrar la pestaña Citas de `CitasHoy.tsx` desapareció el `setLoading(true)` de su effect.)*
- [x] `npm run build` termina sin errores de tipos ni de compilación.

**Sin atajos**

- [x] `git diff` no agrega ningún `eslint-disable` ni `@ts-ignore` / `@ts-expect-error`.
- [x] En `eslint.config.mjs` el único cambio es el bloque de `argsIgnorePattern: "^_"`. No se desactiva ni se baja de severidad ninguna regla.
- [x] Los `// eslint-disable-line react-hooks/exhaustive-deps` que ya existían siguen intactos. *(Los dos de `TabGeneral` solo se movieron junto con sus effects.)*
- [x] `grep -rn "any" database/connection.ts app/dashboard/conteos/actions.ts app/dashboard/citas/actions.ts` no encuentra ningún tipo `any` escrito a mano en las líneas tocadas.

**Archivos y configuración**

- [x] `app/dashboard/citas/page copy.tsx` ya no existe, y nada lo importaba.
- [x] `next.config.ts` tiene un patrón `res.cloudinary.com` con `pathname` `/<cloud_name>/**`, derivado de `CLOUDINARY_URL`. La key y el secret no aparecen en la configuración.
- [ ] Sin `CLOUDINARY_URL` definida, `npm run build` sigue terminando bien.

**Comportamiento (prueba manual)**

- [ ] **Consulta (`TabGeneral` / `TabPagar`):**
  - al cambiar servicios o productos, el total y el saldo de la pestaña Pagar se actualizan igual que antes;
  - el monto sugerido de pago se sigue llenando con el saldo;
  - una consulta inexistente sigue mostrando "No se encontró información." sin errores en la consola.
- [ ] **Servicios, Opciones de servicio, Usuarios, Expediente y Expediente médico:**
  - cada pantalla carga sus datos una sola vez al entrar;
  - recarga cuando cambia la sucursal o el id de la ruta;
  - en la pestaña Network no hay peticiones repetidas en bucle.
- [x] **Pedidos > Nuevo:** los totales del carrito se recalculan igual que antes al agregar, quitar o cambiar cantidades.
- [ ] **Slider de imágenes de tratamiento:**
  - las fotos de Cloudinary se ven con el mismo tamaño y proporción que antes;
  - se puede recorrer entre varias;
  - el clic abre la original en otra pestaña;
  - la consola no muestra errores de `next/image` ("hostname not configured").
- [x] **WhatsApp en `TabGeneral`:** el botón sigue copiando el mensaje al portapapeles y no abre ninguna ventana, igual que hoy.

### Verificación en navegador (2026-10-15, `localhost:3000`)

- **Ejecutado:** Servicios, Opciones de servicio, Usuarios, Expediente y Expediente médico cargan y no entran en bucle de peticiones; Servicios recarga al cambiar de sucursal; Pedidos > Nuevo recalcula totales al agregar/quitar; consulta con servicios muestra totales y saldo coherentes; consulta inexistente muestra "No se encontró información." sin errores en consola; WhatsApp no abre ventana ni lanza alert; slider de tratamiento muestra y recorre las 2 fotos vía `/_next/image` sin errores de host; el dashboard no muestra pestaña activa.
- **Sin ejecutar** (por eso siguen sin marcar): cambiar cantidades/servicios en una consulta y ver el monto sugerido de pago (la consulta probada tenía saldo $0); recarga al cambiar sucursal en Opciones, Usuarios, Expediente y Expediente médico; clic en la foto para abrir la original en otra pestaña (se verificó `target="_blank"` y `href` de Cloudinary); tamaño "igual que antes" del slider (sin referencia previa; la foto de 627×627 se muestra proporcional a 542×542); `npm run build` sin `CLOUDINARY_URL`.
- **Observación:** las pantallas muestran varias respuestas 503 de server actions en dev, también en la carga inicial del layout; no formaron bucles ni dejaron pantallas sin datos.

## Decisiones

**Tomadas:**

- **Dividir en dos specs.** Esta (81) cubre todo menos `react-hooks/set-state-in-effect`, y la 82 hará ese refactor por patrón.
  - Los 71 `set-state-in-effect` cambian el comportamiento en tiempo de ejecución de ~50 componentes. El resto es mecánico o de bajo riesgo.
  - Separarlos permite revisar y probar cada parte por su lado, y que la 81 salga rápido.
- **Arreglar el código en vez de silenciar el linter.** No se agregan `eslint-disable` ni se bajan reglas. Un `disable` esconde el problema y lo hereda la siguiente persona que toque el archivo.
- **Borrar las variables sin usar en vez de ponerles el prefijo `_`.** El código muerto no documenta nada: Git conserva el historial. El prefijo `_` se reserva para parámetros que exige una firma, con `argsIgnorePattern: "^_"`.
- **Borrar `const url` y el `window.open` comentado en `TabGeneral.tsx`.** Hoy el botón solo copia al portapapeles. Reactivar `window.open` sería un cambio funcional y no le toca a esta spec.
- **Borrar `citas/page copy.tsx`.** Nadie lo importa, solo genera ruido en el lint y puede confundirse con la página real.
- **`useCallback` + dependencias para las `fetchX`,** en vez de moverlas dentro del effect. Cambia menos el código, y en algunas pantallas las mismas funciones se usan después de guardar para recargar.
- **`TabPagar` sin cambios en el padre.** `onPagoFormChange` es `setPagoForm`, un setter de `useState` que ya es estable. Agregarlo a las dependencias no provoca un loop.
- **Subir los hooks de `TabGeneral.tsx` arriba del `return` temprano, sin guarda.** Es la corrección mínima de un bug real (hooks condicionales). Que los effects de totales corran cuando la consulta no carga no tiene efecto visible.
- **`ITransactionClient.queryParams: DB["queryParams"]`.** Sigue igual que el método real sin escribir `any`, y no rompe a los 10 archivos que la usan. Cambiar a `unknown[]` obligaría a tipar las filas en decenas de llamadores, lo que sería otra spec.
- **`next/image` para el slider de tratamientos,** como pide `CLAUDE.md`.
- **El cloud name se deriva de `CLOUDINARY_URL` en `next.config.ts`** en vez de quedar escrito en el código. Así no se duplica la configuración ni se mete a Git un dato del entorno. El `pathname` queda restringido a ese cloud name, siguiendo el precedente de Facturapi.
  - *Reemplazada por la spec 83: el patrón acepta cualquier cuenta con `/*/image/upload/**`.*
- **Si falta `CLOUDINARY_URL`, se omite el patrón sin romper el build.** Sin esa variable las subidas tampoco funcionan, así que no es un escenario nuevo.
- **No se arregla nada que el linter no reporte** (por ejemplo, el `new Date(paciente.created_at)` de `TabGeneral.tsx`), aunque se vea al pasar. Así el diff queda auditable contra la línea base.

**Descartadas:**

- *Una sola spec con los 131 problemas:* mezcla cambios mecánicos con un refactor de comportamiento de ~50 componentes.
- *Bajar `set-state-in-effect` a `warn` u `off`:* la meta final (spec 82) es cumplir la regla, no esconderla.
- *Prefijo `_` para todas las variables sin usar:* conserva código muerto.
- *Mover las `fetchX` dentro del effect:* rompe los lugares que las reusan para recargar.
- *Abrir todo `res.cloudinary.com` en `remotePatterns`:* permitiría que el optimizador de Next sirva imágenes de cualquier cuenta de Cloudinary.
- *Hacer fallar el build cuando falte `CLOUDINARY_URL`:* bloquearía entornos (por ejemplo, el desarrollo de otras features) que no usan imágenes.
- *Agregar lint a CI o a un pre-commit:* queda fuera de esta spec.

## Riesgos

- **Loop de peticiones por un `useCallback` mal armado.** Si una `fetchX` depende de un objeto o una función que se vuelve a crear en cada render (por ejemplo, un objeto de contexto completo en vez de `id_sucursal`), el effect se dispara en cada render.
  - *Mitigación:* las dependencias del `useCallback` son valores primitivos o setters estables.
  - Además, la prueba manual del paso 4 revisa la pestaña Network en cada pantalla.
- **`next/image` cambia el tamaño o el recorte del slider.** `next/image` necesita `width`/`height` o `fill`, y las fotos de tratamientos tienen proporciones distintas.
  - *Mitigación:* conservar `max-h-[60vh] max-w-full object-contain` y validarlo visualmente con fotos verticales y horizontales.
- **Fotos con otro host o de otra cuenta.** Si alguna `ruta` guardada en la base no es de `res.cloudinary.com/<cloud_name>/`, por ejemplo una URL vieja o de otra cuenta, `next/image` lanzará un error y esa foto dejará de verse.
  - *Mitigación:* antes del paso 5, revisar en la base que todas las `ruta` de los archivos de tratamiento empiecen con `https://res.cloudinary.com/<cloud_name>/`.
  - Si aparecen otros hosts, se detiene el paso y se decide con el usuario.
- **Borrar una variable "sin usar" que tenía un efecto secundario.** Por ejemplo, `const x = useAlgo()`: el hook sí se tiene que llamar.
  - *Mitigación:* la regla del paso 6 conserva la llamada y solo quita la asignación, y `npm run build` detecta los usos que se rompan.
- **El conteo final no da exactamente 70.** Cambiar código cerca de un `setState` dentro de un effect podría agregar o quitar algún `set-state-in-effect`.
  - *Mitigación:* el criterio de fondo es que **todos** los errores restantes sean `set-state-in-effect` y no haya ninguno nuevo en archivos que no tenían. Si el número varía, se anota en la spec al cerrarla junto con la razón.
- **`CLOUDINARY_URL` cambia sin reconstruir.** `remotePatterns` queda fijo en el build, así que las fotos dejarían de verse.
  - *Mitigación:* queda documentado en el comentario de `next.config.ts`.
