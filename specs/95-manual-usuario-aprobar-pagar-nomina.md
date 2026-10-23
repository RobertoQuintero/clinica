# 95 — Manual de usuario: aprobar y pagar un periodo de nómina

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 94 (`nomina-aprobar-pagar-periodo`): las tres transiciones, el candado del aviso "Recalcula",
    las advertencias ámbar, el sello y el "Historial de estatus". Es lo que esta spec documenta.
  - 92 (`manual-usuario-nomina`): `content/manual/nomina/`, el encabezado YAML, las plantillas de
    página, los recuadros de llamada y `PAYROLL_MANUAL_TOPICS`.
  - 93 (`sucursal-demo-capturas-manual`): la Sucursal Demo, `scripts/manual-captures/`,
    `npm run capture:manual` y `public/manual/nomina/manifest.json`.
- **Modifica base de datos:** No. (La preparación de capturas escribe datos de la Empresa Demo
  por la interfaz real, como ya hacía; no hay DDL.)
- **Dependencias nuevas (npm):** Ninguna.
- **Fecha:** 2026-10-23
- **Objetivo:** Documentar en el manual de Nómina el ciclo de aprobar, desaprobar y marcar como
  pagado un periodo, y borrar las cinco afirmaciones de que esos estados "todavía no están
  disponibles".

### Contexto (2026-10-23)

- La spec 94 quedó **Implementado** y dejó fuera de alcance el manual a propósito: cinco lugares
  del manual afirman hoy que Aprobada y Pagada no existen, y conviene reescribirlos juntos.
- Los cinco lugares: `conceptos-basicos.md` (la lista de estados y la sección "Todavía no
  disponible"), `avisos-y-preguntas.md` (la pregunta "¿Por qué no encuentro los botones Aprobar o
  Pagar?"), `periodos.md` y `procesar-nomina.md` (describen el ciclo como si terminara en
  "En cálculo") y `tutorial-nomina-ordinaria.md` (termina al revisar el cálculo).
- Las tres acciones viven todas en la pantalla **Procesar nómina**, así que el ciclo se documenta
  ahí y no en una página nueva: las páginas de la sección "Pantallas" son una por pantalla.
- La Empresa Demo no tiene hoy ningún periodo aprobado ni pagado, y su última semana calculada
  queda a propósito con "Recalcula" pendiente (ahí Aprobar sale deshabilitado). Las capturas
  nuevas necesitan semanas más viejas, que quedan limpias.
- El script de capturas solo abre una ruta y recorta: no puede abrir el plegable "Historial de
  estatus" antes de la foto.
- Esta spec no cambia una línea de código de la app salvo un `data-manual-capture` para anclar
  una captura; todo lo demás es contenido del manual y el andamio de capturas.

## Alcance

**Entra:**

- **Reescritura de las cinco afirmaciones obsoletas.**
  - `conceptos-basicos.md`: la lista "Los estados de un periodo" gana **Aprobada** y **Pagada**
    descritas de verdad; la sección "Todavía no disponible" deja de mencionarlas (se queda con el
    timbrado del CFDI, las cuotas patronales del IMSS y el finiquito).
  - `avisos-y-preguntas.md`: la pregunta "¿Por qué no encuentro los botones Aprobar o Pagar?" se
    sustituye por las tres preguntas nuevas.
  - `periodos.md`: el párrafo de acciones nombra los cuatro estados y dice que el lápiz y el bote
    de basura solo existen en **Programada**.
  - `procesar-nomina.md`: deja de describir el ciclo como si terminara en **En cálculo**.
  - `tutorial-nomina-ordinaria.md`: llega hasta **Pagada**.
- **Tres secciones "Cómo…" nuevas en `procesar-nomina.md`**: "Cómo aprobar un periodo", "Cómo
  marcarlo como pagado" y "Cómo desaprobar un periodo", con los textos exactos de pantalla:
  botones "Aprobar", "Marcar como pagada" y "Desaprobar"; títulos de confirmación
  "¿Aprobar {código}?", "¿Marcar {código} como pagada?" y "¿Desaprobar {código}?"; el campo
  **Motivo** de 5 a 200 caracteres; las advertencias ámbar ("N empleado(s) con ISR no calculado",
  "N empleado(s) con IMSS no calculado", "El periodo no tiene ningún empleado calculado" y "La
  fecha de pago del periodo es el DD/MM/AAAA; aún no llega"); y el motivo del botón deshabilitado.
- **"Qué ves en la pantalla" de `procesar-nomina.md`** suma el sello ("Aprobada por … el …",
  "Pagada por … el …") y el plegable **"Historial de estatus"** con sus columnas Fecha, Autor,
  Cambio y Motivo.
- **Nota de congelamiento** en `horas-extra.md`, `faltas.md`, `retardos.md` y
  `detalle-empleado.md`: con el periodo en **Aprobada** o **Pagada** la pantalla queda de solo
  lectura (desaparece la columna **Acciones**) y para corregir hay que desaprobar primero.
- **Los tres tutoriales terminan en el pago.** `tutorial-nomina-ordinaria.md` gana los pasos de
  aprobar y pagar; `tutorial-aguinaldo.md` y `tutorial-ptu.md` ganan un paso final que enlaza a la
  sección de aprobación de `procesar-nomina.md`.
- **Avisos existentes, ampliados.** En `avisos-y-preguntas.md`, el aviso "Recalcula la nómina"
  añade que mientras esté activo **Aprobar** está deshabilitado; el aviso "No calculado" añade que
  al aprobar aparece como advertencia ámbar y **no** bloquea.
- **Tres capturas nuevas**, reales, generadas desde la Sucursal Demo:
  - `procesar-nomina-aprobar` — encabezado de un periodo en **En cálculo** limpio, con Recalcular,
    Revertir y Aprobar;
  - `procesar-nomina-sello` — encabezado de un periodo **Pagada**, con el badge y las dos líneas
    del sello;
  - `procesar-nomina-historial` — el plegable "Historial de estatus" abierto, con sus cuatro
    cambios y el motivo de la desaprobación.
- **Andamio de capturas** (`scripts/`):
  - `beforeCapture?: (page: Page) => Promise<void>` opcional en `IManualCaptureDefinition`, para
    abrir el `<details>` antes de la foto;
  - dos `ManualCapturePreparedState` nuevos, `approvedPeriod` y `paidPeriod`;
  - `prepare.ts` aprueba una semana vieja y lleva otra por el ciclo completo
    (aprobar → desaprobar con motivo → aprobar → marcar como pagada), de forma idempotente.
- **Dos anclas de captura en la app**: `data-manual-capture="payroll-period-header"` en el bloque
  del encabezado de Procesar nómina y `data-manual-capture="payroll-status-log"` en el `<details>`
  del historial. Son atributos de datos, sin efecto visual.
- **`updated: "2026-10-23"`** en las páginas tocadas, y solo en ellas.
- **Documentación.** `docs/sucursal-demo.md`, `docs/manual-usuario.md` y los comentarios de
  `scripts/capture-manual-screenshots.ts` / `scripts/manual-captures/nomina.ts` pasan de 16 a 19
  capturas; `docs/sucursal-demo.md` describe además los dos estados preparados nuevos.

**Fuera de alcance:**

- Página nueva del manual (de "Pantallas" o de "Tutoriales"): las tres acciones viven en Procesar
  nómina y ahí se documentan.
- Cambiar la infraestructura de Ayuda: registro de módulos, plantillas, secciones, recuadros de
  llamada, rutas y permisos se quedan igual. No se agrega nada a `PAYROLL_MANUAL_TOPICS` ni a
  `EMPLOYEE_SETUP_ANCHORS`.
- Cualquier cambio de comportamiento de la app: esta spec no toca acciones de servidor, SQL,
  validaciones ni la UI más allá de los dos `data-manual-capture`.
- Manuales de otros módulos.
- Documentar funciones que no existen (recibos, timbrado, dispersión, doble firma, reabrir un
  periodo pagado, aprobar en lote). Siguen en "Todavía no disponible" cuando aplique.
- Re-tomar a mano las 16 capturas existentes: `npm run capture:manual` las regenera todas de una
  vez, y eso es el flujo normal.
- Traducir el manual o cambiar su tono.

## Modelo de datos

**No introduce ninguna estructura de base de datos.** Lo único "estructural" es contenido y
andamio de capturas:

- Tres nombres de captura nuevos (`procesar-nomina-aprobar`, `procesar-nomina-sello`,
  `procesar-nomina-historial`), que deben existir a la vez como marcador `captura:<name>` en el
  Markdown y como definición en `scripts/manual-captures/nomina.ts` — el script falla con el
  nombre exacto si sobra o falta alguno.
- `ManualCapturePreparedState` (`scripts/manual-captures/types.ts`) gana dos valores:

```ts
export type ManualCapturePreparedState =
  | "latestCalculatedPeriod"
  | "recalculationPending"
  | "christmasBonusCalculated"
  | "ptuDistributionClosed"
  | "approvedPeriod" // semana vieja aprobada (estatus 3), sin avisos pendientes
  | "paidPeriod"     // semana vieja aprobada, desaprobada, reaprobada y pagada (estatus 4)
  | "none";
```

- `IManualCaptureDefinition` gana un paso opcional previo a la foto:

```ts
/** Interacción opcional antes de la captura (p. ej. abrir un <details>). */
beforeCapture?: (page: Page) => Promise<void>;
```

## Plan de implementación

1. **Contenido del manual (sin tocar scripts ni app).**
   - Reescritura de `conceptos-basicos.md`, `periodos.md`, `procesar-nomina.md`,
     `avisos-y-preguntas.md` y `tutorial-nomina-ordinaria.md`; paso final en
     `tutorial-aguinaldo.md` y `tutorial-ptu.md`; nota de congelamiento en `horas-extra.md`,
     `faltas.md`, `retardos.md` y `detalle-empleado.md`.
   - Los tres marcadores `captura:` nuevos quedan colocados: `procesar-nomina-aprobar` y
     `procesar-nomina-historial` en `procesar-nomina.md`, `procesar-nomina-sello` en
     `tutorial-nomina-ordinaria.md`.
   - `updated: "2026-10-23"` en las once páginas tocadas.
   - *Verificación:*
     - cada botón, título de modal, etiqueta de campo, columna y advertencia citados existen con
       ese texto exacto en el código (Grep contra `PayrollCalculationActions.tsx`,
       `PayrollPeriodStatusStamp.tsx`, `PayrollPeriodStatusLog.tsx`, `procesar/page.tsx` y
       `lib/payroll/periodStatus.ts`);
     - en `npm run dev`, `/dashboard/ayuda/nomina` lista las mismas páginas en el mismo orden, las
       once abren sin error de encabezado, los enlaces internos y las anclas nuevas navegan sin
       recarga completa y los tres marcadores se ven como recuadro punteado;
     - ninguna página menciona tablas, columnas, números de spec ni ids de rol.

2. **Anclas de captura en la app.**
   - `data-manual-capture="payroll-period-header"` en el `div` del encabezado de
     `procesar/page.tsx` que contiene el título, el badge, el sello y los botones;
     `data-manual-capture="payroll-status-log"` en el `<details>` de `PayrollPeriodStatusLog`.
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` limpios; la pantalla se ve idéntica en
     claro y oscuro; los dos elementos se resuelven con un selector en el navegador.

3. **Andamio de capturas.**
   - `types.ts`: `beforeCapture` y los dos estados preparados nuevos.
   - `capture-manual-screenshots.ts`: ejecuta `beforeCapture` después del `waitForLoadState` y
     antes de medir el elemento.
   - `prepare.ts`: tras calcular las semanas y antes de dejar "Recalcula" pendiente, aprueba
     `weeklyPeriodIds[0]` y lleva `weeklyPeriodIds[1]` por el ciclo completo (aprobar, desaprobar
     con el motivo "Faltaba justificar una falta del periodo", aprobar de nuevo y marcar como
     pagada); devuelve los dos ids en `periodIdsByState`. Cada transición se salta si el periodo
     ya está en ese estatus, para que el script se pueda correr dos veces.
   - `nomina.ts`: las tres definiciones nuevas, con `target` por locator y, en el historial,
     `beforeCapture` que abre el plegable "Historial de estatus".
   - *Verificación:*
     - `npm run seed:demo` y después `npm run capture:manual` sobre una base demo recién sembrada:
       19 marcadores coinciden con 19 definiciones, se escriben 19 PNG y el manifiesto los lista;
     - correrlo **dos veces seguidas** termina igual, sin error de estatus;
     - las tres capturas nuevas muestran lo esperado (botones, sello de dos líneas, historial
       abierto con cuatro filas y el motivo visible), en tema claro y sin el indicador de Next;
     - `periodos-listado` ahora incluye filas con los badges **Aprobada** y **Pagada**;
     - el borrado documentado de la Empresa Demo elimina todo sin que la bitácora de estatus ni el
       sello bloqueen por llave foránea.

4. **Documentación.**
   - `docs/sucursal-demo.md`: 19 capturas, los dos estados preparados nuevos y qué periodos de la
     demo quedan aprobado y pagado; `docs/manual-usuario.md`: 19 PNG y mención del `beforeCapture`
     en el apartado de capturas; comentarios de cabecera de los dos scripts.
   - *Verificación:* lo documentado coincide con lo ejecutado; `npx tsc --noEmit` y `npm run lint`
     limpios.

## Criterios de aceptación

**Contenido**

- [ ] Ninguna página del manual afirma que **Aprobada** o **Pagada** no están disponibles
      (`grep -ri "todavía no" content/manual/nomina/` no devuelve ninguna línea sobre aprobar o
      pagar).
- [ ] `conceptos-basicos.md` describe los cuatro estados, y la sección "Todavía no disponible"
      solo menciona el timbrado del CFDI, las cuotas patronales del IMSS y el finiquito.
- [ ] `procesar-nomina.md` tiene las tres secciones "Cómo aprobar un periodo", "Cómo marcarlo como
      pagado" y "Cómo desaprobar un periodo", y describe el sello y el "Historial de estatus".
- [ ] El manual dice que **Pagada** es definitiva y que la única salida de **Aprobada** es
      desaprobar con motivo (en un recuadro "Atención").
- [ ] El manual explica que **Aprobar** queda deshabilitado mientras haya un aviso "Recalcula" y
      que las advertencias ámbar no bloquean.
- [ ] `horas-extra.md`, `faltas.md`, `retardos.md` y `detalle-empleado.md` dicen qué pasa con el
      periodo en **Aprobada** o **Pagada** y cómo corregir.
- [ ] Los tres tutoriales terminan en el pago del periodo.
- [ ] Las tres preguntas frecuentes nuevas están, y la obsoleta ya no.
- [ ] Todo botón, campo, columna, título de modal y advertencia citado existe con ese texto exacto
      en el código.
- [ ] Ninguna página nombra tablas, columnas, SQL, números de spec ni ids de rol.
- [ ] Las once páginas tocadas tienen `updated: "2026-10-23"` entre comillas; las demás conservan
      su fecha.

**Capturas**

- [ ] `npm run capture:manual` valida 19 marcadores contra 19 definiciones y escribe 19 PNG más el
      manifiesto.
- [ ] Las tres capturas nuevas muestran, respectivamente, los botones de un periodo en cálculo, el
      sello completo de un periodo pagado y el historial abierto con el motivo de la desaprobación.
- [ ] Correr `npm run capture:manual` dos veces seguidas no falla ni duplica transiciones.
- [ ] Las 16 capturas anteriores siguen mostrando lo mismo que antes (la semana con "Recalcula"
      pendiente no se aprobó).

**Calidad**

- [ ] La app no cambia de comportamiento: los únicos cambios en `app/` son los dos atributos
      `data-manual-capture`.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan sin errores.
- [ ] `docs/sucursal-demo.md`, `docs/manual-usuario.md` y los comentarios de los scripts dicen 19.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| Sin página nueva: todo en `procesar-nomina.md` | Las páginas de "Pantallas" son una por pantalla y las tres acciones viven en Procesar nómina. Una página aparte obligaría a repetir el "Qué ves en la pantalla". |
| Capturas reales, no marcadores pendientes | La regla del manual es que cada página traiga capturas de verdad, y la Sucursal Demo ya existe justo para eso. Un recuadro "pendiente" no se ve en producción, así que la sección quedaría sin imagen. |
| Las capturas usan semanas **viejas**, no la última calculada | La última semana calculada de la demo termina a propósito con "Recalcula" pendiente, donde **Aprobar** sale deshabilitado. Aprobarla además rompería las capturas de Horas extra, Faltas y Retardos. |
| Un periodo aprobado **y** otro pagado en la demo | El sello de dos líneas y el historial con una desaprobación solo existen si alguien recorrió el ciclo completo. Un solo periodo no puede mostrar los dos estados a la vez. |
| `beforeCapture` opcional en la definición de captura | El "Historial de estatus" es un `<details>` cerrado; sin un clic previo la foto sería un título plegado. Es tres líneas en el script y sirve para cualquier plegable futuro. |
| Dos `data-manual-capture` nuevos en la app | Es el patrón que ya usa `preparar-empleado-datos-personales`. Recortar "content" daría una foto altísima de toda la tabla, donde los botones no se distinguen. |
| Nota de congelamiento en las cuatro pantallas afectadas | Es la pregunta que va a llegar ("¿por qué no puedo justificar esta falta?") y se responde donde el usuario está parado, no solo en Conceptos básicos. |
| Los tres tutoriales llegan hasta pagar | Un tutorial que termina en "calculado" dejaría al usuario a medio ciclo, y el de nómina ordinaria se llama "de principio a fin". |
| El motivo de la desaprobación se documenta con su mínimo y su máximo | Es la única validación del flujo que el usuario puede provocar, y el botón de confirmar se queda deshabilitado sin explicación si no se sabe. |
| `updated` solo en las páginas tocadas | La fecha dice cuándo se revisó esa página; tocarlas todas la volvería ruido. |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Página nueva de "Pantallas" para el ciclo de autorización | Rompe la regla de una página por pantalla y parte en dos la documentación de Procesar nómina. |
| Tutorial nuevo "Aprobar y pagar un periodo" | Serían cinco pasos que ya caben como los dos últimos del tutorial de nómina ordinaria; un tutorial extra se desincroniza con él. |
| Solo marcadores de captura, sin extender la demo | En producción no se renderiza nada, así que las secciones nuevas quedarían sin imagen y haría falta otra spec para cerrarlas. |
| Capturar el `<details>` cerrado para no tocar el script | La foto no mostraría ninguna fila del historial, que es justo lo que se documenta. |
| Aprobar la última semana calculada de la demo | Congelaría Horas extra, Faltas y Retardos de esa semana y rompería cuatro capturas existentes, además de dejar **Aprobar** deshabilitado. |
| Documentar a qué rol pertenece cada acción | El manual no nombra roles por id y las tres acciones las puede hacer quien ya opera nómina: no hay nada que distinguir. |
| Dejar la pregunta frecuente obsoleta "por compatibilidad" | Una respuesta falsa es peor que ninguna; quien buscaba los botones ahora los encuentra. |

## Riesgos identificados

- **Texto del manual que se desincroniza del código.** Las secciones nuevas citan diez textos
  exactos de pantalla (botones, títulos de modal, advertencias). Un cambio de copy en
  `PayrollCalculationActions` dejaría el manual mintiendo.
  - Mitigación: la regla de mantenimiento ya obliga a que la spec que cambie la pantalla actualice
    la página. Los textos citados se concentran en tres secciones contiguas, fáciles de revisar.
- **`prepare.ts` deja la demo en un estado del que no se puede volver.** Un periodo pagado no se
  recalcula ni se revierte, así que una corrida posterior del script no puede deshacerlo.
  - Mitigación: se eligen dos semanas viejas, que ninguna otra captura usa, y el flujo documentado
    para rehacer la demo es borrarla y volver a sembrarla.
- **Borrado de la Empresa Demo bloqueado por llave foránea.** El sello apunta a `dbo.users` y la
  bitácora de estatus a los periodos.
  - Mitigación: el borrado elimina los periodos antes que los usuarios y la bitácora cae por
    `ON DELETE CASCADE`; de todas formas es un punto explícito de verificación del paso 3.
- **La captura por locator se rompe si cambia el encabezado.** Las dos capturas nuevas dependen de
  `data-manual-capture="payroll-period-header"`.
  - Mitigación: el script falla con el nombre exacto de la captura cuando el elemento no existe,
    así que se nota al regenerar, no en silencio.
- **Las 16 capturas existentes se regeneran todas.** Cualquier deriva de la demo (fechas, datos
  sembrados) aparecerá en ellas aunque esta spec no las toque.
  - Mitigación: se comparan contra las actuales antes de confirmar, y es el comportamiento normal
    del flujo de capturas.
