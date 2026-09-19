# 52 — Nómina: periodos de nómina (alta, listado, edición y borrado)

## Header

- **Estado:** Implementado
- **Depende de:**
  - [51 — Empleados: campo periodo de pago](51-periodo-pago-empleado.md): reusa el catálogo `RH.payment_periods` (claves SAT `c_PeriodicidadPago`) como frecuencia del periodo.
  - [25 — Módulo de Empleados (RH)](25-empleados-alta-listado-detalle.md): primer módulo de RH; esta spec abre el módulo hermano de Nómina.
- **Modifica base de datos:** Sí. Crea `payroll.periods` en el esquema `payroll`, que ya existe. Ya contiene los catálogos `cat_taxed_exempt`, `perceptions` y `tablas_retencion`; esta spec no los consume.
- **Fecha:** 2026-09-18
- **Objetivo:** Crear la pantalla `/dashboard/nomina/periodos`, donde los roles 1 y 4 dan de alta, listan, editan y eliminan periodos de nómina de la sucursal seleccionada. Cada periodo tiene código autogenerado, frecuencia SAT y calendario de fechas de inicio, fin, corte y pago. Es la base del módulo de nómina.

Referencias de diseño y negocio: `references/nomina/periodos.html` (pantalla) y `references/nomina/reglas_modulo_nomina.md` (reglamento).

## Alcance

**Incluye:**

- **Base de datos:**
  - Se crea la tabla `payroll.periods`, con FK a `RH.payment_periods` y a la tabla de sucursales, un `CHECK` de estatus y `UNIQUE (id_sucursal, codigo)`.
  - El DDL se documenta en `queries.txt`, al final del bloque existente `NOMINA PAYROLL`, después de `tablas_retencion`.
- **Frecuencias ofrecidas:** solo las claves SAT del catálogo activo que tienen una letra y una regla de fechas definidas:

  | Clave | Frecuencia | Letra |
  |---|---|---|
  | 01 | Diario | D |
  | 02 | Semanal | S |
  | 03 | Catorcenal | C |
  | 04 | Quincenal | Q |
  | 05 | Mensual | M |
  | 06 | Bimestral | B |
  | 10 | Decenal | X |

  Las claves 07, 08, 09 y 99 no aparecen en el selector.
- **Código autogenerado** `NOM-{año}-{letra}{consecutivo de 2 dígitos}`:
  - El año es el de `fecha_inicio`.
  - El consecutivo es por sucursal, año y frecuencia.
  - Se genera en el servidor al insertar, es de solo lectura y no se regenera al editar.
- **Autocompletado de fechas** en el modal de alta:
  - Se calcula en una server action, porque necesita el último periodo registrado.
  - Las 4 fechas quedan editables.
  - Al cambiar la frecuencia se recalculan.
  - Regla:
    - **Inicio:** el día siguiente al fin del último periodo de esa frecuencia en la sucursal. Si no hay periodo previo: el lunes de la semana actual (semanal), el día 1 o 16 (quincenal) o el día 1 (mensual).
    - **Fin:** semanal = inicio + 6 días (lunes a domingo). Quincenal = día 15 o último día del mes. Mensual = último día del mes. Las demás frecuencias usan inicio + `days` − 1.
    - **Pago:** el último viernes ≤ fin.
    - **Corte:** pago − 2 días (miércoles).
    - En periodos de menos de 7 días: pago = fin y corte = fin.
- **Validaciones con zod** en el servidor:
  - fin ≥ inicio;
  - inicio ≤ corte ≤ fin;
  - pago ≥ corte;
  - no hay traslape con otro periodo de la misma frecuencia en la misma sucursal.

  Los errores se devuelven como `ActionResult` y se muestran en el modal.
- **Estatus:**
  - Columna `status tinyint` con `CHECK (1..4)`: 1 Programada, 2 En cálculo, 3 Aprobada, 4 Pagada.
  - En TS hay un mapa de constantes con etiqueta y estilo de badge.
  - Esta spec solo crea periodos en 1 (Programada).
- **Editar:** solo las 4 fechas, y solo si el estatus es Programada. La frecuencia y el código quedan bloqueados.
- **Eliminar:** borrado físico, solo si el estatus es Programada. Pide confirmación en la UI, sin diálogo nativo del navegador.
- **Pantalla `/dashboard/nomina/periodos`:**
  - Server Component que lee la sucursal de la cookie `sel_sucursal`, con respaldo en el JWT. Los filtros viven en los `searchParams` de la URL.
  - Encabezado con breadcrumb "Nómina › Periodos de Nómina" y botón "Nuevo periodo de nómina".
  - Tarjeta **"Periodo activo en curso"**: el periodo de la sucursal cuyo rango incluye hoy (si hay varios, el de fecha de inicio más reciente). Si no hay ninguno, muestra un estado vacío.
  - Barra de filtros:
    - pestañas por frecuencia, solo las que tienen periodos en el ejercicio, con su conteo;
    - select de estatus;
    - select de ejercicio (años con periodos, más el año actual);
    - búsqueda por código.
  - Tabla con las columnas Código, Tipo, Rango, Corte, Fecha de pago, Estatus y Acciones (editar y eliminar, solo en Programada). Se pagina de 20 en 20 en el servidor.
  - Modal cliente de alta y edición: selector de frecuencia, código de solo lectura (en el alta muestra "Se asignará al guardar") y las 4 fechas.
- **Navegación y permisos:**
  - En `navConfig.tsx`, un grupo nuevo "Nómina" con el hijo "Periodos", visible solo para los roles 1 y 4.
  - En `proxy.ts`, cualquier ruta bajo `/dashboard/nomina` redirige a `/dashboard` si el rol no es 1 ni 4.
  - Las server actions también validan el rol, como defensa en profundidad.
- **Auditoría:** `created_by`, `created_at` y `updated_at` como strings, siguiendo las reglas de fechas del proyecto.
- **Documentación:**
  - Nuevo `docs/nomina.md`, que describe el módulo y la tabla.
  - En `CLAUDE.md` se agrega `nomina` a la lista de features y la referencia al doc nuevo.

**No incluye (fuera de alcance, para specs futuras):**

- El cálculo de nómina y las columnas de montos: Percepciones, Deducciones, Transferencia y Efectivo.
- Las tarjetas "Colaboradores auditados" y "Cálculo estimado", y las tarjetas de canales de dispersión.
- Las transiciones de estatus: procesar o calcular, aprobar, marcar como pagada. Las acciones "Procesar", "Recibos" y "Póliza" del mockup no se implementan.
- Las reglas biométricas y de ajuste (faltas, retardos, horas extra, incentivos) y el botón "Reglas de Cálculo".
- La asignación de empleados al periodo ("Personal programado / Modificar lista").
- El timbrado CFDI de nómina, aunque la frecuencia ya guarda la clave SAT para ese uso.
- Periodos consolidados multi-sucursal: cada periodo pertenece a una sola sucursal.
- Las pantallas `nomina.html`, `nomina_detalle.html` y `nomina_incidencias.html` de las referencias.
- El borrado lógico y el historial de cambios de un periodo.

## Modelo de datos

**`payroll.periods`.** Es una tabla nueva y se documenta en `queries.txt`, al final del bloque `NOMINA PAYROLL`. El nombre de la tabla va en inglés, como `perceptions`, y las columnas de negocio en español, como `ejercicio` en `tablas_retencion` y en `RH.*`. Los tipos de las FK coinciden con los reales: `smallint` en `RH.payment_periods` e `int` en `dbo.sucursales`.

```sql
-- Spec 52: periodos de nómina por sucursal.
CREATE TABLE [payroll].[periods](
    [id_period]         [int] IDENTITY(1,1) NOT NULL,
    [id_sucursal]       [int]          NOT NULL,
    [id_payment_period] [smallint]     NOT NULL,   -- frecuencia (clave SAT c_PeriodicidadPago)
    [codigo]            [varchar](20)  NOT NULL,   -- NOM-2026-S38, generado en servidor
    [ejercicio]         [smallint]     NOT NULL,   -- año de fecha_inicio; base del consecutivo
    [consecutivo]       [smallint]     NOT NULL,   -- por sucursal + ejercicio + frecuencia
    [fecha_inicio]      [date]         NOT NULL,
    [fecha_fin]         [date]         NOT NULL,
    [fecha_corte]       [date]         NOT NULL,
    [fecha_pago]        [date]         NOT NULL,
    [status]            [tinyint]      NOT NULL CONSTRAINT [DF_periods_status] DEFAULT (1),
    [created_by]        [int]          NOT NULL,
    [created_at]        [datetime2](0) NOT NULL,
    [updated_at]        [datetime2](0) NULL,
 CONSTRAINT [PK_periods] PRIMARY KEY CLUSTERED ([id_period] ASC),
 CONSTRAINT [UQ_periods_sucursal_codigo] UNIQUE ([id_sucursal], [codigo]),
 CONSTRAINT [UQ_periods_consecutivo] UNIQUE ([id_sucursal], [ejercicio], [id_payment_period], [consecutivo]),
 CONSTRAINT [CK_periods_status] CHECK ([status] BETWEEN 1 AND 4),
 CONSTRAINT [CK_periods_fechas] CHECK (
     [fecha_fin] >= [fecha_inicio]
     AND [fecha_corte] BETWEEN [fecha_inicio] AND [fecha_fin]
     AND [fecha_pago] >= [fecha_corte]),
 CONSTRAINT [FK_periods_sucursal] FOREIGN KEY ([id_sucursal])
     REFERENCES [dbo].[sucursales] ([id_sucursal]),
 CONSTRAINT [FK_periods_payment_period] FOREIGN KEY ([id_payment_period])
     REFERENCES [RH].[payment_periods] ([id_payment_period])
) ON [PRIMARY]
GO
CREATE INDEX [IX_periods_sucursal_ejercicio]
    ON [payroll].[periods] ([id_sucursal], [ejercicio], [id_payment_period], [fecha_inicio])
GO
```

**`interfaces/payroll_period.ts`** (archivo nuevo). Todas las fechas son `string`, siguiendo la regla de mssql.

```ts
export type PayrollPeriodStatus = 1 | 2 | 3 | 4;

export interface IPayrollPeriod {
  id_period:          number;
  id_sucursal:        number;
  id_payment_period:  number;
  codigo:             string;
  ejercicio:          number;
  consecutivo:        number;
  fecha_inicio:       string;   // "YYYY-MM-DD"
  fecha_fin:          string;
  fecha_corte:        string;
  fecha_pago:         string;
  status:             PayrollPeriodStatus;
  created_by:         number;
  created_at:         string;   // "YYYY-MM-DD HH:mm:ss"
  updated_at:         string | null;
}

// Fila del listado: el periodo más la descripción de su frecuencia.
export interface IPayrollPeriodRow extends IPayrollPeriod {
  frecuencia_descripcion: string;
  frecuencia_clave_sat:   string;
}

export interface IPayrollPeriodDates {
  fecha_inicio: string;
  fecha_fin:    string;
  fecha_corte:  string;
  fecha_pago:   string;
}

export interface IPayrollPeriodFilters {
  idPaymentPeriod: number | null;              // pestaña de frecuencia
  status:          PayrollPeriodStatus | null;
  ejercicio:       number;
  search:          string;                     // coincidencia parcial por código
  page:            number;                     // base 1; 20 por página
}

export interface IPayrollPeriodsPage {
  rows:              IPayrollPeriodRow[];
  totalRows:         number;
  frequencyCounts:   { id_payment_period: number; description: string; total: number }[];
  availableYears:    number[];
  activePeriod:      IPayrollPeriodRow | null;  // tarjeta "Periodo activo en curso"
}
```

**`lib/payroll/constants.ts`** (archivo nuevo, sin dependencias de servidor, para poder importarlo desde el cliente):

```ts
export const PAYROLL_PERIOD_STATUS = {
  1: { label: "Programada",  badge: "neutral" },
  2: { label: "En cálculo",  badge: "info" },
  3: { label: "Aprobada",    badge: "warning" },
  4: { label: "Pagada",      badge: "success" },
} as const;

// clave_sat -> letra del código. Las frecuencias fuera de este mapa no se ofrecen.
export const PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY: Record<string, string> = {
  "01": "D", "02": "S", "03": "C", "04": "Q", "05": "M", "06": "B", "10": "X",
};

export const PAYROLL_PERIODS_PAGE_SIZE = 20;
export const PAYROLL_ALLOWED_ROLE_IDS = [1, 4];
```

**`lib/payroll/periodDates.ts`** (archivo nuevo, funciones puras sobre strings `"YYYY-MM-DD"`, sin `Date` que salga de la función):

- `suggestPeriodDates(satKey, previousEndDate | null, today)` devuelve `IPayrollPeriodDates` y aplica la regla descrita en Alcance.
- `buildPeriodCode(ejercicio, satKey, consecutivo)` devuelve, por ejemplo, `"NOM-2026-S38"`.

**`lib/payroll/schemas.ts`** (archivo nuevo, zod, siguiendo el patrón de `lib/billing/schemas.ts`):

- `createPayrollPeriodSchema`: `id_payment_period` más las 4 fechas en formato `YYYY-MM-DD`, con `refine` de orden entre fechas.
- `updatePayrollPeriodSchema`: `id_period` más las 4 fechas, con la misma validación de orden.

El traslape y el estatus se validan en la server action contra la BD, no en zod.

## Plan de implementación

1. **Base de datos.** Ejecutar contra la BD el `CREATE TABLE [payroll].[periods]` y su índice, y documentarlos en `queries.txt` al final del bloque existente `NOMINA PAYROLL`.
   *Verificación:* `SELECT * FROM [CentroPodologico].[payroll].[periods]` devuelve 0 filas sin error. Un `INSERT` manual con `fecha_corte` fuera del rango lo rechaza `CK_periods_fechas`.

2. **Tipos y constantes.** Crear `interfaces/payroll_period.ts` y `lib/payroll/constants.ts` como están en el Modelo de datos. Todavía nadie los consume.
   *Verificación:* `tsc --noEmit` sin errores.

3. **Lógica pura de fechas y código.** Crear `lib/payroll/periodDates.ts` con `suggestPeriodDates` y `buildPeriodCode`, operando sobre strings `"YYYY-MM-DD"` y sin usar `toISOString()`.
   *Verificación manual con un script temporal en el scratchpad:*
   - semanal sin periodo previo, con hoy = 2026-09-18 (viernes) → 2026-09-14 / 2026-09-20 / corte 2026-09-16 / pago 2026-09-18;
   - quincenal con fin previo 2026-09-15 → 2026-09-16 / 2026-09-30 / corte 2026-09-23 / pago 2026-09-25;
   - mensual para febrero → termina el 28 o el 29 según el año.

4. **Schemas zod.** Crear `lib/payroll/schemas.ts` con `createPayrollPeriodSchema` y `updatePayrollPeriodSchema`, con formato de fecha y `refine` de orden.
   *Verificación:* `tsc --noEmit` sin errores.

5. **Server actions de lectura** en `app/dashboard/nomina/periodos/actions.ts`:
   - `assertPayrollAccess()`: lee el JWT, rechaza los roles que no estén en `PAYROLL_ALLOWED_ROLE_IDS` y resuelve `id_sucursal` desde la cookie `sel_sucursal`, con respaldo en el JWT.
   - `getPayrollFrequencies()`: devuelve las filas activas de `RH.payment_periods` cuya `clave_sat` está en el mapa de letras. Antes de cerrar el mapa, se verifica el formato real de `clave_sat` en la BD.
   - `getPayrollPeriodsPage(filters)`: devuelve las filas paginadas (`OFFSET/FETCH`, 20), `totalRows`, `frequencyCounts`, `availableYears` y `activePeriod`. Las fechas salen con `CONVERT(varchar(10), …, 120)` y `created_at`/`updated_at` con `CONVERT(varchar(19), …, 120)`.
   - `getSuggestedPeriodDates(idPaymentPeriod)`: busca el `MAX(fecha_fin)` de esa frecuencia en la sucursal y llama a `suggestPeriodDates`, con hoy = `addZeroToday(new Date())`.

   *Verificación:* `tsc --noEmit` sin errores.

6. **Server action `createPayrollPeriod(input)`.**
   - Parsea con zod y valida que la frecuencia esté permitida.
   - En **un solo batch SQL**:
     - verifica que no haya traslape (`fecha_inicio <= @fin AND fecha_fin >= @inicio`) para la misma sucursal y frecuencia, y si lo hay aborta con `THROW`;
     - calcula el consecutivo con `MAX(consecutivo) + 1 … WITH (UPDLOCK, HOLDLOCK)` por sucursal, ejercicio y frecuencia;
     - arma el código;
     - inserta con `status = 1`, `created_by` y `created_at = buildDate(new Date())`.
   - Devuelve `ActionResult<IPayrollPeriod>`. El error de traslape se traduce a un mensaje en español.
   - Llama a `revalidatePath("/dashboard/nomina/periodos")`.

   *Verificación:* `tsc --noEmit` sin errores.

7. **Server actions `updatePayrollPeriod(input)` y `deletePayrollPeriod(idPeriod)`.**
   - Ambas verifican que el periodo pertenezca a la sucursal activa y que tenga `status = 1`, dentro del `WHERE` del propio statement. Si no afectan filas, devuelven `{ ok: false }` con un mensaje.
   - `update` cambia solo las 4 fechas y `updated_at`, con la validación de traslape excluyendo el propio `id_period`. `ejercicio`, `consecutivo` y `codigo` no cambian.
   - `delete` hace `DELETE` físico.
   - Ambas llaman a `revalidatePath`.

   *Verificación:* `tsc --noEmit` sin errores.

8. **Permisos y navegación.**
   - En `proxy.ts`: cualquier ruta bajo `/dashboard/nomina` con `id_role` distinto de 1 y 4 redirige a `/dashboard`.
   - En `navConfig.tsx`: grupo "Nómina" con el hijo `{ href: "/dashboard/nomina/periodos", label: "Periodos" }` y `excludeRoles: [2, 3, 5, 6]`, con un comentario que apunta a `PAYROLL_ALLOWED_ROLE_IDS`.
   - Crear `app/dashboard/nomina/page.tsx`, que solo hace `redirect("/dashboard/nomina/periodos")`.
   - Crear un `app/dashboard/nomina/periodos/page.tsx` mínimo, que muestre solo el título, para que la ruta exista.

   *Verificación:* los roles 1 y 4 ven el grupo y entran. Con el rol 2, escribir `/dashboard/nomina/periodos` redirige a `/dashboard`.

9. **Listado de solo lectura** (usando el skill `frontend-design`). Completar `page.tsx` como Server Component:
   - lee los `searchParams` (`frecuencia`, `estatus`, `ejercicio`, `q`, `pagina`) y llama a `getPayrollPeriodsPage`;
   - renderiza el encabezado, la tarjeta `ActivePayrollPeriodCard` (servidor) y `PayrollPeriodsTable` (servidor), con badges de frecuencia y estatus, fechas formateadas en español sin `new Date()` sobre el string crudo, y paginación con `<Link>`;
   - `PayrollPeriodsFilterBar` es el único componente cliente de este paso: actualiza la URL con `router.replace`, y la búsqueda se aplica con debounce.

   Los componentes van en `app/dashboard/nomina/periodos/componentes/`.
   *Verificación:* con un par de periodos insertados a mano, los filtros, la paginación y la tarjeta activa responden. Cambiar de sucursal en el selector refresca la lista.

10. **Modal de alta y edición, y borrado** (usando el skill `frontend-design`).
    - `PayrollPeriodModal` (cliente):
      - en alta, al elegir la frecuencia llama a `getSuggestedPeriodDates` y rellena las 4 fechas;
      - en edición, la frecuencia y el código quedan bloqueados;
      - al guardar llama a la action y muestra `message` si `ok` es `false`.
    - `DeletePayrollPeriodButton` (cliente): confirmación dentro de la UI (popover o modal propio, sin `confirm()`).
    - Los botones de editar y eliminar solo se renderizan cuando el estatus es Programada.

    *Verificación:* crear, editar y eliminar desde la UI, de punta a punta.

11. **Documentación.**
    - Crear `docs/nomina.md` con la tabla, las reglas de código y fechas (incluido que el consecutivo puede tener huecos y nunca se reusa), los estatus y los permisos.
    - En `CLAUDE.md`, agregar `nomina` a la lista de features y la referencia a `docs/nomina.md` en "Domain modules".

    *Verificación:* `npm run build` sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Base de datos**

- [ ] `payroll.periods` existe con las columnas, FKs, `UNIQUE`, `CHECK` e índice del Modelo de datos, y está documentada en `queries.txt`, al final del bloque `NOMINA PAYROLL`.
- [ ] Un `INSERT` directo con `status = 5` o con `fecha_corte` fuera de `[fecha_inicio, fecha_fin]` falla por constraint.

**Permisos y navegación**

- [x] Los usuarios con `id_role` 1 o 4 ven en el sidebar el grupo "Nómina" con el hijo "Periodos" y pueden abrir `/dashboard/nomina/periodos`.
- [x] Los usuarios con `id_role` 2, 3, 5 o 6 no ven el grupo "Nómina". Si escriben `/dashboard/nomina` o `/dashboard/nomina/periodos`, se les redirige server-side a `/dashboard`.
- [x] Si un rol distinto de 1 o 4 llama a cualquier action de `nomina/periodos/actions.ts`, recibe `{ ok: false }` y no se lee ni escribe nada.
- [x] `/dashboard/nomina` redirige a `/dashboard/nomina/periodos`.

**Alta**

- [x] El selector de frecuencia del modal muestra solo las frecuencias activas de `RH.payment_periods` con clave SAT 01, 02, 03, 04, 05, 06 o 10.
- [x] En una sucursal sin periodos semanales, con hoy = 2026-09-18, elegir "Semanal" rellena inicio 2026-09-14, fin 2026-09-20, corte 2026-09-16 y pago 2026-09-18.
- [x] Si el último periodo quincenal de la sucursal termina el 2026-09-15, elegir "Quincenal" rellena inicio 2026-09-16, fin 2026-09-30, corte 2026-09-23 y pago 2026-09-25.
- [x] Las 4 fechas sugeridas se pueden editar antes de guardar.
- [x] Al crear el primer periodo semanal de 2026 en una sucursal, su código es `NOM-2026-S01`. El siguiente semanal de la misma sucursal y el mismo año es `NOM-2026-S02`.
- [x] Dos sucursales distintas pueden tener cada una su propio `NOM-2026-S01`.
- [x] Un periodo nuevo se guarda con `status = 1` y la sucursal seleccionada en `SucursalContext`, y aparece en la tabla como "Programada" sin recargar manualmente.
- [x] Si se intenta guardar con fin < inicio, corte fuera del rango o pago < corte, se muestra un mensaje de error en el modal y no se inserta nada.
- [x] Si se intenta crear un periodo que se traslapa con otro de la misma frecuencia en la misma sucursal, se muestra un mensaje de traslape y no se inserta nada.
- [x] Un periodo quincenal que se traslapa en fechas con uno semanal de la misma sucursal **sí** se puede crear.

**Edición y borrado**

- [x] En las filas con estatus Programada aparecen los botones editar y eliminar. En los demás estatus no aparecen.
- [x] Al editar, la frecuencia y el código están bloqueados. Solo las 4 fechas se pueden modificar, y los cambios persisten con `updated_at` actualizado.
- [x] Editar las fechas para que se traslapen con otro periodo de la misma frecuencia muestra un error y no guarda.
- [x] Una fila con `status` distinto de 1 (ajustado a mano en la BD) no se puede editar ni eliminar, ni siquiera llamando a la action directamente: la action devuelve `{ ok: false }`.
- [x] Al eliminar se pide confirmación dentro de la UI, sin diálogo nativo del navegador. Si se confirma, la fila desaparece de la tabla y de la BD.

**Listado**

- [x] La tabla muestra solo los periodos de la sucursal seleccionada. Al cambiar de sucursal en el selector, la lista se actualiza.
- [x] La tabla muestra las columnas Código, Tipo, Rango, Corte, Fecha de pago, Estatus y Acciones. No hay columnas de montos.
- [x] Las pestañas de frecuencia muestran solo las frecuencias con periodos en el ejercicio seleccionado, con su conteo correcto, más "Todos".
- [x] El select de estatus, el de ejercicio y la búsqueda por código (coincidencia parcial) filtran los resultados y quedan reflejados en la URL. Recargar la página conserva los filtros.
- [x] Con más de 20 periodos en el filtro activo, la tabla muestra 20 y la paginación permite ir a la siguiente página.
- [x] La tarjeta "Periodo activo en curso" muestra el código, la frecuencia y el rango del periodo cuyo rango incluye hoy. Si no hay ninguno, muestra un estado vacío.
- [x] Las fechas mostradas coinciden exactamente con las guardadas en la BD, sin corrimiento de un día por UTC.

**Técnico**

- [x] `page.tsx`, `ActivePayrollPeriodCard` y `PayrollPeriodsTable` son Server Components. Solo `PayrollPeriodsFilterBar`, `PayrollPeriodModal` y `DeletePayrollPeriodButton` llevan `"use client"`.
- [x] Ninguna query de `nomina/periodos/actions.ts` devuelve un `Date` de JS: todas las fechas llegan como string.
- [x] Existen `docs/nomina.md` y la referencia correspondiente en `CLAUDE.md`.
- [x] `npm run build` compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Sí: esquema `payroll` y tabla `payroll.periods`.** El esquema ya existe en la BD, en minúsculas, con los catálogos de nómina (`cat_taxed_exempt`, `perceptions` y `tablas_retencion`). Separa el módulo de nómina de `RH` igual que facturación usa `BILLING`, y deja lugar para las tablas de cálculo, incidencias y recibos que vendrán.
- **No: consumir `perceptions`, `cat_taxed_exempt` ni `tablas_retencion` en esta spec.** Son insumos del cálculo de nómina (percepciones SAT, gravado/exento y tarifas de ISR), que está fuera de alcance. `tablas_retencion` ya se indexa por `id_payment_period` y `ejercicio`, así que la spec de cálculo podrá cruzarla directamente con `payroll.periods` por esas dos columnas.
- **No: `RH.payroll_periods`.** Mezclaría el catálogo del personal con la operación de nómina.
- **Sí: la frecuencia es una FK a `RH.payment_periods`, no un campo propio.** Reusa el catálogo de la spec 51 y guarda la clave SAT `c_PeriodicidadPago` que se usará al timbrar la nómina. También permite relacionar después a los empleados (`id_periodo_pago`) con los periodos de su frecuencia.
- **Sí: se ofrecen solo las claves SAT 01, 02, 03, 04, 05, 06 y 10.** Las claves 07 (Unidad obra), 08 (Comisión), 09 (Precio alzado) y 99 (Otra) no tienen un rango de fechas natural ni una regla de autocompletado.
- **No: solo Semanal y Quincenal, como el mockup.** Restringiría el catálogo sin necesidad. Las demás frecuencias ya tienen su regla de fechas.
- **Sí: el periodo pertenece a una sola sucursal, tomada de `SucursalContext` (cookie `sel_sucursal`).** Sigue el patrón del resto del dashboard y evita un selector de sucursal en el modal.
- **No: periodos consolidados multi-sucursal (`id_sucursal NULL`).** Complican el filtrado y la validación de traslape. Si llegan a necesitarse, irán en otra spec.
- **Sí: código `NOM-{año}-{letra}{consecutivo de 2 dígitos}`, generado en el servidor, de solo lectura y fijo tras la creación.** Así se evitan códigos duplicados o inconsistentes capturados a mano.
- **No: código editable o capturado a mano.** Abre la puerta a colisiones y a nomenclaturas distintas.
- **Sí: `ejercicio` y `consecutivo` como columnas propias, con `UNIQUE (id_sucursal, ejercicio, id_payment_period, consecutivo)`.** Calcular el siguiente consecutivo es un `MAX()` simple. Si dos personas crean un periodo a la vez, falla una de las dos en lugar de duplicarse.
- **No: extraer el consecutivo haciendo parsing del string `codigo`.** Es frágil y no se puede indexar.
- **Sí: la frecuencia no se puede cambiar al editar.** Cambiarla invalidaría el código ya asignado. Si la frecuencia está mal, se elimina el periodo y se crea de nuevo, porque sigue en Programada.
- **Sí: el consecutivo se calcula con el año de `fecha_inicio`.** Es la convención natural del ejercicio fiscal. Un periodo que cruza de año (por ejemplo, del 29 de diciembre al 4 de enero) cuenta en el año en que empieza.
- **Sí: fechas sugeridas con una sola regla** ("inicio = día siguiente al último fin; pago = último viernes ≤ fin; corte = pago − 2 días"). Aplica el reglamento: corte los miércoles y pago los viernes. Una sola regla para todas las frecuencias es fácil de explicar y de probar. Las 4 fechas quedan editables para los casos excepcionales.
- **No: implementar la excepción del reglamento "pago el jueves si cae en sábado".** Con la regla del último viernes ≤ fin, el pago nunca cae en sábado. Los días festivos se ajustan a mano.
- **Sí: la validación de orden de fechas vive en zod y además en un `CHECK` de la BD.** Zod da mensajes claros en la UI. El `CHECK` protege contra escrituras fuera de la aplicación.
- **Sí: no se permite traslape de fechas entre periodos de la misma frecuencia en la misma sucursal, pero sí entre frecuencias distintas.** Semanales y quincenales conviven porque aplican a personal distinto.
- **Sí: el traslape y el consecutivo se resuelven en un solo batch SQL con `UPDLOCK, HOLDLOCK`.** `db` no expone transacciones explícitas. Un batch con bloqueo evita condiciones de carrera sin cambiar `database/connection.ts`.
- **Sí: se define desde ahora el conjunto completo de estatus (1 a 4), como `tinyint` con `CHECK` y un mapa de constantes en TS.** Deja fijo el vocabulario que usarán las specs de cálculo y pago sin crear una tabla catálogo para 4 valores estables.
- **No: tabla `payroll.period_statuses`.** Es sobreingeniería para 4 valores que no cambian.
- **No: transiciones de estatus en esta spec.** Dependen del cálculo de nómina, que todavía no existe.
- **Sí: borrado físico, solo en Programada.** Un periodo programado aún no tiene cálculos, recibos ni dispersiones que dependan de él.
- **No: borrado lógico.** No hay nada que preservar de un periodo que nunca se procesó.
- **Sí: auditoría mínima (`created_by`, `created_at`, `updated_at`).** Sirve para saber quién abrió cada periodo sin necesidad de una bitácora completa.
- **Sí: acceso exclusivo de los roles 1 y 4, con gate en `proxy.ts`, en `navConfig.tsx` y en las actions.** El reglamento reserva el ajuste de parámetros a Administrador y RH. El gate server-side sigue la regla de `CLAUDE.md` de no gatear solo en el cliente.
- **Sí: grupo "Nómina" en el sidebar con un solo hijo "Periodos".** Así, las pantallas de nómina, detalle e incidencias se agregan después como hijos, sin reorganizar la navegación.
- **Sí: filtros en los `searchParams` de la URL y página como Server Component.** Evita el fetch en el cliente con `useEffect`, permite compartir y recargar los filtros, y deja el `"use client"` solo en la barra de filtros, el modal y el botón de borrar.
- **Sí: se agrega la columna "Corte" a la tabla, aunque el mockup no la tiene.** El corte de asistencias es una fecha operativa clave y ya se captura.
- **No: columnas de montos con "Por calcular" o "—".** Serían columnas vacías sin datos reales hasta que exista el cálculo.
- **No: reglas biométricas, asignación de personal y botón "Reglas de Cálculo" del mockup.** Cada uno es un dominio propio (asistencias, empleados, parámetros) y merece su propia spec.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| La fecha sugerida o mostrada se corre un día por conversión a UTC, que es el error clásico de mssql. | `periodDates.ts` opera solo sobre strings `"YYYY-MM-DD"`. El SELECT usa `CONVERT(varchar(10), …, 120)`. "Hoy" se obtiene con `addZeroToday(new Date())`. Hay un criterio de aceptación que lo verifica. |
| Dos usuarios crean a la vez un periodo de la misma frecuencia en la misma sucursal y chocan en consecutivo o fechas. | Un solo batch con `UPDLOCK, HOLDLOCK` sobre el cálculo del `MAX` y el chequeo de traslape. `UQ_periods_consecutivo` es la última barrera. Si aun así falla, la action devuelve `{ ok: false }` con "Intenta de nuevo", nunca un error 500. |
| El catálogo `RH.payment_periods` tiene claves SAT con otro formato (por ejemplo `"2"` en lugar de `"02"`) y el mapa de letras no coincide, así que el selector sale vacío. | En el paso 5 se verifican las `clave_sat` reales antes de cerrar el mapa. Si difieren, se normaliza con `padStart(2, "0")` y se anota en la spec como nota de implementación, igual que en la spec 51. |
| Alguien edita un periodo cuyo estatus cambió en otra pestaña (en el futuro, cuando existan las transiciones). | `update` y `delete` revalidan `status = 1` en el `WHERE` del propio statement, no solo en la UI. Si no afectan filas, devuelven `{ ok: false }`. |
| El consecutivo tiene huecos tras un borrado (se elimina el S05 y el siguiente es el S07). | Es aceptable y esperado: el código es un identificador, no un folio fiscal. Se documenta en `docs/nomina.md`. El consecutivo nunca se reusa, para no confundir con un periodo borrado. |
| La regla "último viernes ≤ fin" no aplica bien a periodos cortos, como el diario (clave 01): en un día que no es viernes, el pago quedaría antes del inicio. | En periodos de menos de 7 días, `suggestPeriodDates` usa pago = fin y corte = fin. Zod valida de todos modos el orden, y si la sugerencia no sirve el usuario la ajusta a mano. |
| El gate por rol diverge entre `proxy.ts`, `navConfig.tsx` y las actions. | Los roles permitidos viven en `PAYROLL_ALLOWED_ROLE_IDS`, que usan `proxy.ts` y las actions. `navConfig.tsx` usa su convención `excludeRoles` con el complemento `[2, 3, 5, 6]`, anotado con un comentario que apunta a la constante. |

## Qué **no** incluye esta spec

- Cálculo de nómina: percepciones, deducciones, montos por transferencia y en efectivo.
- Transiciones de estatus (procesar, aprobar, pagar), recibos y póliza de dispersión.
- Reglas biométricas y de ajuste (faltas, retardos, horas extra, incentivos) y la configuración de "Reglas de Cálculo".
- Asignación de empleados a un periodo.
- Timbrado CFDI de nómina.
- Periodos consolidados multi-sucursal.
- Las pantallas `nomina.html`, `nomina_detalle.html` y `nomina_incidencias.html`.
- Borrado lógico e historial de cambios.

Cada una de ellas, si llega, va en su propia spec.
