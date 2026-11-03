# 96 — Reabrir un periodo de nómina pagado

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 94 (`nomina-aprobar-pagar-periodo`): `payroll.period_status_log`, `CK_period_status_log_transicion`, `CK_periods_sello_estatus`, `PERIOD_STATUS_TRANSITIONS`, `collectRecalculationFlags`, el candado duro de Aprobar y `unapprovePayrollPeriod` como patrón de transición con motivo.
  - 53 (`nomina-calculo-salario`): `calculatePayrollPeriod` (que vuelve a tomar los candados de pago único liberados por su propio `DELETE`), `ELIGIBLE_EMPLOYEE_BASE_CONDITIONS`, `ExcludedEmployeesNotice` y `PayrollRecalculationNotice`.
  - 52 (`nomina-periodos`): `payroll.periods`, `PAYROLL_PERIOD_STATUS` y el badge de estatus.
  - 87 (`nomina-aguinaldo-extraordinaria`): `ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS`, porque el aviso nuevo también cubre el aguinaldo.
  - 90 (`nomina-ptu-pago-extraordinaria`): la PTU queda **fuera** del aviso nuevo; su universo es el reparto cerrado, no `RH.empleados`.
- **Modifica base de datos:** Sí, un solo cambio.
  - `CK_period_status_log_transicion` se recrea para aceptar la cuarta transición, 4 → 2.
  - **No** cambia `CK_periods_sello_estatus`: su rama `[status] <= 2` ya exige los cuatro campos de sello en `NULL`, que es exactamente lo que escribe reabrir.
  - **No** hay tabla ni columna nueva. El aviso de empleados faltantes se calcula en vivo, como el de excluidos.
- **Fecha:** 2026-11-03
- **Objetivo:** Que un empleado elegible que quedó fuera de un periodo ya cerrado se pueda detectar y pagar, reabriendo el periodo Pagada (4) a En cálculo (2) con motivo obligatorio.

### Contexto (2026-11-03)

- **En estatus 3 (Aprobada) ya se podía.** `unapprovePayrollPeriod` (3 → 2) más Recalcular ya mete al empleado nuevo, porque la elegibilidad se evalúa en el momento del cálculo y no hay nada congelado en la ficha del empleado. El único estatus sin salida era el 4, que la spec 94 declaró definitivo.
- **El hueco real no era reabrir: era enterarse.** Un empleado contratado, reactivado, transferido de sucursal o con su `id_periodo_pago` capturado **después** del cálculo no aparece en ninguna pantalla: no tiene fila en `period_employees` y tampoco sale en `ExcludedEmployeesNotice`, que solo lista a quienes tienen el salario del tipo en `NULL` o `<= 0` (`procesar/actions.ts:490-497`). Ninguna de las once banderas de `collectRecalculationFlags` lo detecta. Un periodo se podía aprobar y pagar sin esa persona y sin un solo aviso.
- **Recalcular no duplica pagos.** El `DELETE FROM period_employees` de `calculatePayrollPeriod` libera por cascada los candados de pago único de *ese* periodo (tratamientos, ventas, horas extra, vacaciones, PTU) y el `INSERT` los vuelve a tomar con los mismos `NOT EXISTS`, que siguen excluyendo lo que ya tomó otro periodo. Reabrir y recalcular un periodo pagado **no le quita nada a un periodo posterior** ni paga dos veces; por eso esta spec no necesita ningún candado de integridad para reabrir.
- **Lo que sí se mueve es el dinero de los demás.** Recalcular recomputa a todo el periodo, así que un parámetro fiscal, una tarifa de ISR o un tratamiento liquidado desde el cálculo original cambian montos ya dispersados. Esa es la razón del motivo obligatorio y de las advertencias del modal; la corrección de la dispersión ocurre fuera del sistema.
- **La spec 94 declaró esto explícitamente fuera de alcance** ("Reabrir un periodo pagado por cualquier vía, incluida una corrección contable posterior") con la razón "deshacer un pago en el sistema no deshace la transferencia". Esta spec revierte esa decisión por un caso que esa spec no contempló: no se trata de deshacer un pago correcto, sino de uno al que le faltó una persona. La decisión queda registrada en la tabla de decisiones.
- **El manual de usuario no se toca.** Es la regla acordada para Nómina: las páginas de `content/manual/nomina/` que afirman que Pagada es definitiva se reescriben en una spec de manual aparte.

## Alcance

**Entra:**

- **Transición nueva: Reabrir (4 → 2).** La cuarta y última del ciclo de vida del periodo.
  - El `UPDATE` deja `status = 2` y los cuatro campos de sello (`approved_by`, `approved_at`, `paid_by`, `paid_at`) en `NULL`, que es lo que ya exige la rama `[status] <= 2` de `CK_periods_sello_estatus`.
  - **Motivo obligatorio** de 5 a 200 caracteres, con las constantes de `unapprovePayrollPeriod` renombradas a algo compartido por las dos transiciones.
  - Una fila en `payroll.period_status_log` con `4 → 2`, el motivo, el autor y la fecha. El sello del pago anterior se pierde en `periods` pero **queda en la bitácora**, que es la única memoria de que ese periodo se pagó.
  - **Permisos: roles 1 y 4**, iguales a las otras tres transiciones.
- **Descongelamiento automático, sin tocar esos archivos.** Al volver a 2, Recalcular, Revertir, Editar, Eliminar, Horas extra, Faltas y Retardos se reactivan solos, porque todos sus candados están escritos como lista blanca de 1 y 2 (verificado en la spec 94, paso 7). La spec lo verifica, no lo reescribe.
- **Aviso doce: empleados elegibles fuera del cálculo.**
  - Detecta al empleado que cumple las condiciones de elegibilidad **hoy**, tiene salario del tipo `> 0` y **no tiene fila** en `period_employees` para ese tipo. Es decir, el contratado, reactivado, transferido o con frecuencia capturada después del cálculo.
  - Se muestra con nombre, código y enlace a la ficha, siguiendo `ExcludedEmployeesNotice`, no el `PayrollRecalculationNotice` de una línea: sin los nombres el aviso no se puede atender.
  - **Periodos ordinarios y de aguinaldo**, cada uno con su condición de elegibilidad ya existente. Un periodo de **PTU** devuelve lista vacía: su universo es el reparto cerrado de la spec 89, no `RH.empleados`.
  - **Se evalúa en estatus 2 y 3**, a diferencia de los once avisos actuales, que filtran `status = 2` y se apagan al aprobar. Es el único aviso que denuncia la omisión de pago a una persona, y en estatus 3 todavía hay salida barata (Desaprobar).
  - **Solo detecta faltantes, nunca sobrantes.** A alguien dado de baja después del periodo le corresponden sus días trabajados; avisar en esa dirección invitaría a recalcular y **borrarle** un pago legítimo.
- **Dos candados duros, los dos por reutilización de lo que ya existe:**
  - **Aprobar** queda bloqueado automáticamente, sin código nuevo: el aviso doce entra en `IRecalculationFlags` y `approvePayrollPeriod` ya aborta si cualquier bandera está activa.
  - **Pagar** queda bloqueado con un candado nuevo: un periodo en estatus 3 con alguien faltante no se puede marcar como pagada; hay que desaprobar, recalcular y volver a aprobar. Cumple el criterio que la spec 94 fijó para su único candado duro — es un caso en el que el sistema **sabe** que lo aprobado no es correcto —, y es el último punto donde corregir todavía es barato.
- **UI, toda en Procesar** (`/dashboard/nomina/procesar`):
  - **Reabrir periodo** se suma a `PayrollCalculationActions` con `ACTIONS_BY_STATUS[4] = ["reopen"]`, de modo que el estatus 4 deja de no tener botones;
  - su modal es la variante destructiva con `<textarea>` obligatorio y contador, el mismo de Desaprobar, y advierte en ámbar que al recalcular los montos de los demás empleados pueden cambiar y que la dispersión ya hecha se corrige fuera del sistema;
  - el aviso nuevo se pinta junto a los otros doce;
  - el sello del encabezado desaparece al reabrir y el `<details>` "Historial de estatus" muestra la fila `Pagada → En cálculo` con su motivo.
- **Validación.** `zod` para la entrada (`id_period` y `comentario`), y el `CHECK` de la bitácora como segunda línea.
- **Documentación.** `docs/nomina.md`: la sección "Status" pasa de tres transiciones a cuatro y deja de decir que Pagada es definitiva, los once avisos pasan a doce, se añade la sección "Reapertura de un periodo pagado (spec 96)" y se corrige el "Not built" de la spec 94 que hoy afirma lo contrario. El DDL del `CHECK` recreado va a `queries.txt`.

**Fuera de alcance:**

- **Manual de usuario.** No se toca `content/manual/nomina/`. Las páginas que afirman que Pagada es definitiva se reescriben en una spec de manual aparte, con sus capturas.
- **Pagar días retroactivos en el periodo siguiente.** Es la práctica habitual de nómina y evitaría tocar un periodo pagado, pero hoy el cálculo solo mira días dentro del rango del periodo. Queda anotada como alternativa descartada y **candidata a su propia spec**.
- **Agregar un solo empleado sin recalcular el periodo.** Exigiría una segunda copia del `INSERT ... SELECT` completo del cálculo.
- **Avisar de empleados que están en el snapshot y hoy ya no son elegibles** (la dirección inversa del aviso doce).
- **La PTU en el aviso doce**, y cualquier aviso sobre repartos cerrados que ya no coinciden con la plantilla.
- **Reabrir desde el listado de Periodos**, o varios periodos a la vez.
- **Reservar Reabrir al rol 1.** Se evaluó y se descartó: dejaría la acción inalcanzable si el equipo de nómina trabaja con rol 4.
- **Registrar, corregir o calcular la dispersión bancaria**: el delta que falta pagarle al empleado nuevo, la referencia de la transferencia correctiva, recibos y timbrado del CFDI.
- **Un límite de tiempo o de antigüedad para reabrir.**
- **Notificaciones** de "periodo reabierto" a quien lo había aprobado o pagado.
- **El candado de `setShiftExtensionAssignment`** en periodos aprobados. Sigue siendo el riesgo abierto de la spec 94.
- **Registrar las transiciones 1 → 2 y 2 → 1** en la bitácora.

## Modelo de datos

### SQL (DDL en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 94)

```sql
-- Spec 96: la bitácora acepta la cuarta transición, reabrir un periodo pagado (4 -> 2).
-- Se recrea el CHECK completo porque SQL Server no permite modificarlo en su lugar.
ALTER TABLE [payroll].[period_status_log] DROP CONSTRAINT [CK_period_status_log_transicion];
GO
ALTER TABLE [payroll].[period_status_log] ADD
    CONSTRAINT [CK_period_status_log_transicion] CHECK (
     ([status_anterior] = 2 AND [status_nuevo] = 3)     -- aprobar
  OR ([status_anterior] = 3 AND [status_nuevo] = 4)     -- marcar como pagada
  OR ([status_anterior] = 3 AND [status_nuevo] = 2)     -- desaprobar
  OR ([status_anterior] = 4 AND [status_nuevo] = 2));   -- reabrir (spec 96)
GO
```

**Sin DDL:**

- `CK_period_status_log_comentario` **no cambia**: ya exige comentario de 5 caracteres cuando `status_nuevo = 2`, y reabrir es 4 → 2. El motivo obligatorio de Reabrir queda protegido en la base sin escribir nada.
- `CK_periods_sello_estatus` **no cambia**: su rama `[status] <= 2` ya exige los cuatro campos de sello en `NULL`, que es exactamente lo que escribe Reabrir.
- `CK_periods_status` **no cambia**: sigue siendo `BETWEEN 1 AND 4`.
- **Ninguna tabla ni columna nueva.** El aviso de empleados faltantes se calcula en vivo, como `excludedEmployees`.

### TypeScript

`interfaces/payroll_period.ts`:

```ts
// Spec 96: la cuarta transición del ciclo de vida del periodo.
export type PeriodStatusTransition = "approve" | "pay" | "unapprove" | "reopen";
```

`interfaces/payroll_calculation.ts`:

```ts
// Spec 96: empleado elegible hoy que no tiene fila en el cálculo guardado, por tipo de nómina.
export interface IPayrollMissingEmployee {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
  tipo_nomina:     PayrollType;   // 'O' u 'F': de cuál de las dos nóminas falta
}
```

El payload de `getPayrollProcessPage` gana `missingEmployees: IPayrollMissingEmployee[]`. A diferencia de `excludedEmployees`, que viene filtrado por el tipo seleccionado en la URL, **este trae los dos tipos siempre**: el candado que alimenta es del periodo completo, así que un faltante solo en la fiscal tiene que verse también desde la vista operativa. Si no, Aprobar aparecería deshabilitado sin un aviso visible que lo explique.

### Lógica de detección (`lib/payroll/missingEmployeesRecalculation.ts`, nuevo, `server-only`)

Sigue el nombre y la forma de los otros once módulos `lib/payroll/*Recalculation.ts`, pero devuelve filas en lugar de un `boolean`, porque el aviso necesita nombres para poder atenderse:

```ts
export async function loadMissingEligibleEmployees(
  period: Pick<
    IPayrollPeriodRow,
    "id_period" | "id_sucursal" | "id_payment_period" | "fecha_fin" | "tipo_periodo" | "concepto_extraordinario"
  >,
): Promise<IPayrollMissingEmployee[]>;
```

Reglas:

- Devuelve `[]` sin consultar nada cuando el periodo es de **PTU** (`tipo_periodo = 'E'` y `concepto_extraordinario = 'P'`).
- La consulta se ejecuta solo si el periodo está en **estatus 2 o 3** (`EXISTS` sobre `payroll.periods` dentro del mismo SQL, no con lo que mande el cliente).
- El `WHERE` es **la misma pareja de condiciones que usa el `INSERT` del cálculo**, no una reescritura:

| Tipo de periodo | Condición de elegibilidad | Dónde la usa el cálculo |
|---|---|---|
| Ordinario (`'O'`) | `ELIGIBLE_EMPLOYEE_BASE_CONDITIONS` + `salary.salario_diario > 0` | `procesar/actions.ts:1703-1704` |
| Aguinaldo (`'E'`/`'A'`) | `ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS` + `salary.salario_diario > 0` | `christmasBonusSql.ts:52-53` |

- El tipo de nómina sale del mismo `CROSS APPLY (VALUES ('O', e.salario_diario), ('F', e.salario_diario_fiscal))` de los dos cálculos, así que "falta en la operativa" y "falta en la fiscal" se evalúan por separado.
- La ausencia es un `NOT EXISTS` sobre `period_employees` por `(id_period, id_empleado, tipo_nomina)`.
- Orden: `apellido_paterno, apellido_materno, nombre, id_empleado, tipo_nomina`, igual que `excludedEmployees`.

Que las condiciones sean **las mismas constantes** que el `INSERT`, y no una copia, es lo que hace imposible un falso positivo que el recálculo no pueda limpiar.

### Banderas de recálculo (`lib/payroll/recalculationChecks.ts`)

```ts
export interface IRecalculationFlags {
  // …las once actuales…
  missingEligibleEmployees: IPayrollMissingEmployee[];   // spec 96; vacío = nada que recalcular
}
```

- El parámetro de `collectRecalculationFlags` se ensancha de `Pick<IPayrollPeriodRow, "id_period" | "tipo_periodo">` a incluir `id_sucursal`, `id_payment_period`, `fecha_fin` y `concepto_extraordinario`. Los dos llamadores (`getPayrollProcessPage` y `approvePayrollPeriod`) ya tienen la fila completa del periodo.
- La doceava entra al `Promise.all` existente; es la única que **no** se anula en un periodo extraordinario, porque el aguinaldo sí le aplica.
- `recalculationNeeded` pasa a ser el `or` de las once banderas **más** `missingEligibleEmployees.length > 0`. Con eso **Aprobar queda bloqueado sin una línea nueva** en `approvePayrollPeriod`.

### Constantes y lógica pura (`lib/payroll/periodStatus.ts`)

```ts
export const PERIOD_STATUS_TRANSITIONS: Record<
  PeriodStatusTransition,
  { from: PayrollPeriodStatus; to: PayrollPeriodStatus }
> = {
  approve:   { from: 2, to: 3 },
  pay:       { from: 3, to: 4 },
  unapprove: { from: 3, to: 2 },
  reopen:    { from: 4, to: 2 },   // spec 96
};

/** Mensaje del candado nuevo al pagar, compartido por la acción y por el botón deshabilitado. */
export const PERIOD_HAS_MISSING_EMPLOYEES_MESSAGE =
  "Hay empleados elegibles fuera del cálculo: desaprueba el periodo, recalcula y vuelve a aprobarlo antes de pagarlo";
```

- `getAvailableStatusTransitions` no cambia: al leer el mapa, el estatus 4 empieza a devolver `["reopen"]` solo.
- `UNAPPROVE_COMMENT_MIN_LENGTH` y `UNAPPROVE_COMMENT_MAX_LENGTH` se **renombran** a `STATUS_COMMENT_MIN_LENGTH` y `STATUS_COMMENT_MAX_LENGTH`: el motivo ya no es exclusivo de Desaprobar y dos constantes con el mismo 5 y el mismo 200 se separarían en la primera que alguien ajuste.
- `lib/payroll/constants.ts`: `PERIOD_STATUS_TRANSITION_LABELS` gana `reopen: "Reabrir periodo"`.

### Acciones (`app/dashboard/nomina/procesar/actions.ts`)

```ts
export async function reopenPayrollPeriod(input: unknown): Promise<ActionResult<null>>;
```

- `reopenPayrollPeriodSchema` en `lib/payroll/schemas.ts`, con el mismo `comentario` que `unapprovePayrollPeriodSchema` (los dos se definen a partir de un `periodStatusCommentSchema` compartido, en lugar de repetir los dos `min`/`max`).
- Un solo batch con el patrón de `unapprovePayrollPeriod`: `BEGIN TRAN`, lectura `WITH (UPDLOCK, HOLDLOCK)` validando `id_sucursal` y `status = 4`, el `UPDATE` que pone `status = 2` y los cuatro campos de sello en `NULL`, y el `INSERT` en la bitácora, todo en la misma transacción. Cierra con `revalidatePayrollPaths()`.
- Marcadores nuevos en `describePayrollCalculationError`:

| Marcador | Mensaje |
|---|---|
| `PERIOD_NOT_REOPENABLE` | "El periodo no existe en esta sucursal o ya no está en estatus Pagada" |

- `payPayrollPeriod` gana el candado nuevo: llama `loadMissingEligibleEmployees` **antes** de abrir la transacción y aborta con `PERIOD_HAS_MISSING_EMPLOYEES_MESSAGE` si devuelve filas. Es el mismo patrón con el que `approvePayrollPeriod` usa `collectRecalculationFlags`.

### Componentes

- **`procesar/componentes/MissingEmployeesNotice.tsx`** (Server Component, nuevo): copia la forma de `ExcludedEmployeesNotice` (sección ámbar, `TriangleAlert`, chips con `<Link>` a `/dashboard/empleados/{id}`), pero agrupa por `tipo_nomina` y su texto dice que el empleado **no entró al cálculo** y que hay que recalcular, no que le falte el salario. Devuelve `null` con la lista vacía.
- **`PayrollCalculationActions.tsx`**: `ACTIONS_BY_STATUS[4] = ["reopen"]`, el modal destructivo con `<textarea>` reutilizado de `unapprove`, y **Marcar como pagada** se renderiza deshabilitada con `aria-describedby` cuando hay faltantes, igual que Aprobar con `recalculationNeeded`.

### Convenciones

- El estatus de origen y la sucursal se validan **dentro** de la lectura bloqueada; `id_user` sale de `assertPayrollAccess()`.
- `changed_at` y `updated_at` con `buildDate(new Date())`, siempre como string.
- Los nombres en código en inglés (`reopenPayrollPeriod`, `loadMissingEligibleEmployees`, `MissingEmployeesNotice`), aunque las etiquetas y los mensajes estén en español.

## Plan de implementación

1. **DDL: la bitácora acepta la cuarta transición.**
   - Se agrega a `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 94: el `DROP` y el `ADD` de `CK_period_status_log_transicion` con los cuatro pares.
   - Se ejecuta contra la base de desarrollo.
   - *Verificación*, escribiendo SQL a mano:
     - un `INSERT` con `4 → 2` y motivo entra; el mismo sin motivo, o con un motivo de 4 caracteres, falla por `CK_period_status_log_comentario` (que ya existía);
     - `4 → 3`, `4 → 1` y `2 → 4` siguen fallando;
     - las tres transiciones de la spec 94 siguen entrando;
     - las filas ya existentes en la bitácora sobreviven al `DROP`/`ADD` (el `CHECK` se recrea sin `WITH NOCHECK`, así que si alguna fila no cumpliera, el `ADD` fallaría y eso es la señal que se quiere).

2. **Tipos, constantes y renombres. Sin UI, sin acciones, sin detección.**
   - `PeriodStatusTransition` gana `"reopen"`; `PERIOD_STATUS_TRANSITIONS` gana `reopen: { from: 4, to: 2 }`; `PERIOD_STATUS_TRANSITION_LABELS` gana `reopen: "Reabrir periodo"`.
   - `UNAPPROVE_COMMENT_MIN_LENGTH` / `UNAPPROVE_COMMENT_MAX_LENGTH` se renombran a `STATUS_COMMENT_MIN_LENGTH` / `STATUS_COMMENT_MAX_LENGTH` en su definición y en sus usos (`PayrollCalculationActions`, `schemas.ts`).
   - `periodStatusCommentSchema` compartido, del que se derivan `unapprovePayrollPeriodSchema` y el nuevo `reopenPayrollPeriodSchema`.
   - `IPayrollMissingEmployee` en `interfaces/payroll_calculation.ts` y `PERIOD_HAS_MISSING_EMPLOYEES_MESSAGE` en `lib/payroll/periodStatus.ts`.
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` limpios. `getAvailableStatusTransitions(4)` devuelve `["reopen"]` y `(3)` sigue devolviendo `["unapprove", "pay"]`. En pantalla **no cambia nada todavía**: el estatus 4 sigue sin botones porque `ACTIONS_BY_STATUS` no se toca en este paso.

3. **Detección: `loadMissingEligibleEmployees`, todavía sin consumidores.**
   - `lib/payroll/missingEmployeesRecalculation.ts` con la consulta descrita, reutilizando `ELIGIBLE_EMPLOYEE_BASE_CONDITIONS`, `ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS` y `EMPLOYEE_FULL_NAME_SQL`.
   - *Verificación*, con un script temporal en el scratchpad, sobre un periodo ordinario ya calculado:
     - se da de alta un empleado de esa sucursal y frecuencia con `fecha_ingreso` dentro del rango y los dos salarios `> 0` → devuelve **dos** filas, `'O'` y `'F'`;
     - con `salario_diario = 0` y `salario_diario_fiscal > 0` → solo la fila `'F'`;
     - con `fecha_ingreso` posterior a `fecha_fin`, inactivo, de otra sucursal, de otra frecuencia o sin `id_periodo_pago` → `[]`;
     - tras "Recalcular" → `[]`, y el empleado aparece en la tabla de Procesar;
     - el mismo periodo en estatus 1 o 4 → `[]`;
     - un periodo de **PTU** → `[]` sin tocar la base;
     - un periodo de **aguinaldo** con un empleado dado de alta después del cálculo → lo devuelve, incluso si ese empleado no tiene `id_periodo_pago` (el aguinaldo no lo pide).

4. **El aviso doce en Procesar, con el candado de Aprobar que trae gratis.**
   - `IRecalculationFlags` gana `missingEligibleEmployees`; `collectRecalculationFlags` ensancha su parámetro, añade la llamada a su `Promise.all` y la suma a `recalculationNeeded`.
   - `getPayrollProcessPage` expone `missingEmployees` en el payload.
   - `MissingEmployeesNotice` (Server Component) y su render en `procesar/page.tsx`, junto a los otros avisos. Se usa la skill `frontend-design`.
   - *Verificación:*
     - con un faltante, el aviso sale en estatus **2 y 3**, y no sale en 1 ni en 4;
     - un faltante solo en la fiscal se ve también desde la vista operativa, etiquetado con su tipo;
     - cada chip lleva a `/dashboard/empleados/{id}`;
     - **Aprobar** queda deshabilitada con el mensaje de recalcular, y la acción llamada a mano responde lo mismo y no escribe nada;
     - al recalcular, el aviso desaparece y Aprobar se habilita sin recargar a mano;
     - un periodo de PTU no muestra el aviso nunca.

5. **Candado nuevo al pagar.**
   - `payPayrollPeriod` llama `loadMissingEligibleEmployees` antes de abrir la transacción y aborta con `PERIOD_HAS_MISSING_EMPLOYEES_MESSAGE`.
   - **Marcar como pagada** se renderiza deshabilitada con `aria-describedby` cuando hay faltantes.
   - *Verificación:* un periodo en 3 con un faltante no se puede pagar ni desde el botón ni llamando la acción; el motivo es legible con lector de pantalla; al desaprobar, recalcular y aprobar, el botón se habilita y el pago entra. Un periodo en 3 sin faltantes se paga como antes.

6. **La acción `reopenPayrollPeriod`, todavía sin botón.**
   - La acción, su marcador `PERIOD_NOT_REOPENABLE` en `describePayrollCalculationError` y su entrada en `revalidatePayrollPaths()`.
   - *Verificación*, llamándola desde el scratchpad con sesión de rol 1 y luego de rol 4:
     - desde estatus 4 → el periodo queda en 2, los cuatro campos de sello en `NULL` y una fila `4 → 2` en la bitácora con el motivo;
     - dos veces seguidas → la segunda responde "ya no está en estatus Pagada";
     - desde 1, 2 o 3 → el mismo mensaje y nada escrito;
     - sin motivo, con 4 caracteres o con 201 → falla en `zod`;
     - un periodo de otra sucursal → no se distingue de uno inexistente;
     - con rol 2, 3, 5 o 6 → `{ ok: false, message: "No tienes permisos…" }`.

7. **Botón y modal de Reabrir.**
   - `ACTIONS_BY_STATUS[4] = ["reopen"]`; el modal destructivo con `<textarea>` obligatorio y contador, reutilizando el de `unapprove`.
   - Copy: **"¿Reabrir {código}?"** / "El periodo regresa a En cálculo y pierde el sello de aprobación y de pago. Al recalcular, los montos de **todos** los empleados pueden cambiar; la dispersión ya hecha se corrige fuera del sistema. Escribe el motivo."
   - Se usa `frontend-design`.
   - *Verificación:* en estatus 4 se ve un solo botón, Reabrir; el confirmar está deshabilitado hasta los 5 caracteres; un error del servidor se muestra dentro del modal y el periodo no cambia; tras reabrir, la pantalla vuelve sola al estado de estatus 2 con sus botones.

8. **Verificación del descongelamiento y del sello (sin cambios de código esperados).**
   - Se reabre un periodo pagado y se recorre todo lo que la spec 94 había congelado.
   - *Verificación:*
     - Procesar vuelve a ofrecer Recalcular, Revertir y Aprobar; Horas extra, Faltas y Retardos recuperan su columna "Acciones" y aceptan escrituras; Periodos vuelve a ofrecer Editar y Eliminar solo después de revertir a 1;
     - el **sello del encabezado desaparece** y el `<details>` "Historial de estatus" conserva las filas `2 → 3`, `3 → 4` y `4 → 2` en orden descendente, con el motivo de la reapertura;
     - **recalcular después de reabrir no duplica ningún pago**: un tratamiento, una línea de venta y un día de horas extra que ese periodo había pagado vuelven a quedar en ese mismo periodo, y los que había tomado un periodo posterior siguen en el posterior;
     - el reparto de PTU usado por un periodo PTU reabierto **sigue bloqueado** en estatus 2, y se libera solo al revertir a 1;
     - si algo **no** se descongela o el recálculo mueve un pago de periodo, se corrige aquí y se anota en la spec.

9. **Documentación.**
   - `docs/nomina.md`: la sección "Status" pasa a cuatro transiciones y deja de afirmar que Pagada es definitiva; "las once comprobaciones" pasan a doce en todas sus menciones; se añade la sección "Reapertura de un periodo pagado (spec 96)"; se corrige el "Not built" de la spec 94 ("reopening a paid period by any means") y su riesgo asociado; se documenta que el aviso doce es el único que vive también en estatus 3, y que sus condiciones tienen que seguir saliendo de las constantes de elegibilidad del cálculo.
   - `queries.txt`: además del DDL, la **consulta de diagnóstico** del primer riesgo, para correr a mano — los empleados elegibles sin fila en `period_employees` de todos los periodos en estatus 3 y 4 del ejercicio, con la misma forma que la consulta de diagnóstico de la spec 85.
   - *Verificación:* el DDL documentado coincide con el ejecutado; la consulta de diagnóstico corre y encuentra el caso de prueba que se dejó montado en el paso 3; `npx tsc --noEmit` y `npm run lint` limpios; `content/manual/nomina/` sin tocar.

## Criterios de aceptación

**Transición Reabrir**

- [ ] Un periodo en estatus 4 se reabre con motivo y queda en 2, con `approved_by`, `approved_at`, `paid_by` y `paid_at` en `NULL`.
- [ ] Desde 1, 2 y 3 no se puede reabrir: cada intento responde "ya no está en estatus Pagada" y no escribe nada.
- [ ] Reabrir sin motivo, con menos de 5 caracteres útiles o con más de 200 se rechaza en `zod` y en `CK_period_status_log_comentario`.
- [ ] Un periodo de otra sucursal no se distingue de uno inexistente.
- [ ] Dos pestañas que reabren el mismo periodo a la vez terminan con un éxito y un error de estatus, nunca con dos filas en la bitácora.
- [ ] El estatus 4 muestra exactamente un botón, Reabrir, y ya no un encabezado sin acciones.
- [ ] Un rol distinto de 1 y 4 recibe `{ ok: false }` al llamar la acción directamente.

**Detección de empleados faltantes**

- [ ] Un empleado dado de alta, reactivado, transferido a la sucursal o con su `id_periodo_pago` capturado después del cálculo aparece en el aviso, con nombre, código y enlace a su ficha.
- [ ] El aviso distingue la nómina operativa de la fiscal, y un faltante solo en una de las dos se ve desde cualquiera de las dos vistas.
- [ ] El aviso sale en estatus 2 y 3, y no sale en 1 ni en 4.
- [ ] Recalcular vacía el aviso y el empleado aparece en la tabla con sus días, su salario y su ISR.
- [ ] Un periodo de aguinaldo detecta faltantes aunque no tengan `id_periodo_pago`; un periodo de PTU nunca muestra el aviso.
- [ ] Un empleado que **sí** está en el cálculo y hoy ya no es elegible (dado de baja, salario puesto en 0, transferido de sucursal) **no** aparece en el aviso.
- [ ] Un empleado sin salario capturado para el tipo sigue saliendo en el aviso de excluidos y **no** en el nuevo; los dos avisos no se contradicen ni se duplican.

**Candados**

- [ ] Con un faltante, Aprobar se rechaza en el servidor y el botón aparece deshabilitado con el motivo visible y accesible.
- [ ] Con un faltante, Pagar se rechaza en el servidor con `PERIOD_HAS_MISSING_EMPLOYEES_MESSAGE` y el botón aparece deshabilitado con el motivo.
- [ ] Desaprobar, recalcular y volver a aprobar habilita el pago sin recargar a mano.
- [ ] Las once comprobaciones anteriores siguen bloqueando Aprobar igual que antes, y ninguna de ellas bloquea Pagar.

**Sello y bitácora**

- [ ] La bitácora acepta `4 → 2` y sigue rechazando `4 → 3`, `4 → 1` y cualquier otro par.
- [ ] Tras aprobar, pagar y reabrir, el historial muestra las tres filas en orden descendente, con el motivo de la reapertura, y el encabezado ya no muestra ningún sello.
- [ ] `CK_periods_sello_estatus` sigue impidiendo cualquier combinación incoherente de estatus y sello, también escribiendo SQL a mano, sin haber sido modificado.
- [ ] Calcular, recalcular y revertir (1 ↔ 2) siguen sin escribir en la bitácora.

**Descongelamiento y recálculo**

- [ ] Tras reabrir, Recalcular, Revertir y Aprobar vuelven a estar disponibles; Editar y Eliminar solo después de revertir a 1.
- [ ] Tras reabrir, Horas extra, Faltas y Retardos del periodo vuelven a aceptar escrituras y recuperan su columna "Acciones".
- [ ] Recalcular un periodo reabierto no duplica ningún pago único: los tratamientos, las líneas de venta, los días de horas extra, los conceptos de vacaciones y la PTU que ese periodo había pagado vuelven a quedar en ese periodo, y los que tomó un periodo posterior siguen en el posterior.
- [ ] El reparto de PTU de un periodo PTU reabierto sigue bloqueado mientras el periodo esté en 2, y se libera al revertirlo a 1.

**Calidad**

- [ ] La acción pasa por `assertPayrollAccess()` y valida con `zod`; la sucursal y el `id_user` salen de la sesión, nunca del cliente, y el estatus de origen se valida dentro de la lectura con `UPDLOCK, HOLDLOCK`.
- [ ] Ninguna fecha viaja como `Date`; todas usan `buildDate` y `CONVERT(varchar(19), …, 120)`.
- [ ] La detección tiene **una sola copia** y reutiliza las mismas constantes de elegibilidad que el `INSERT` del cálculo, sin reescribir sus condiciones.
- [ ] El único componente cliente modificado es `PayrollCalculationActions`; `MissingEmployeesNotice` es Server Component.
- [ ] El motivo de Desaprobar y el de Reabrir comparten un solo schema y un solo par de constantes de longitud.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan sin errores.
- [ ] `docs/nomina.md` y `queries.txt` quedan actualizados; `content/manual/nomina/` **no** se toca.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| Permitir reabrir un periodo pagado, revirtiendo la spec 94 | La spec 94 razonó sobre deshacer un pago **correcto** ("deshacer un pago en el sistema no deshace la transferencia") y ahí sigue teniendo razón. El caso que no contempló es distinto: un pago al que le faltó una persona. Negarse a corregirlo no protege nada, solo deja a alguien sin cobrar. |
| Reabrir va de 4 a 2 en un solo paso | Es el estado desde el que se recalcula, que es el objetivo de reabrir. Pasar por 3 obligaría a desaprobar después y duplicaría el motivo obligatorio para una sola corrección. |
| Reabrir borra los cuatro campos de sello | Es lo que ya exige la rama `[status] <= 2` de `CK_periods_sello_estatus`, así que el `CHECK` de la spec 94 no se toca. La memoria del pago no se pierde: vive en la bitácora, que es justamente para lo que se creó. |
| Roles 1 y 4, igual que las otras tres transiciones | Reservarla al rol 1 la volvería inalcanzable si el equipo de nómina trabaja con rol 4, y la clínica tiene una o dos personas en nómina. El motivo obligatorio y la bitácora son el control real, no el rol. |
| Ningún candado duro para reabrir: ni antigüedad, ni periodos posteriores | Recalcular un periodo reabierto no le quita pagos a ningún periodo posterior, porque el `DELETE` libera solo los candados de ese periodo y el `INSERT` sigue excluyendo lo que ya tomó otro. Sin un riesgo de datos que justificarlo, un límite de tiempo solo volvería incorregible un error viejo. |
| Motivo obligatorio de 5 a 200, con el `CHECK` que ya existía | `CK_period_status_log_comentario` ya exige comentario cuando `status_nuevo = 2`, y reabrir es 4 → 2. La protección en base sale gratis. |
| Solo el motivo; no se escribe el código del periodo para confirmar | El motivo obligatorio, el modal destructivo y la bitácora ya son tres fricciones. Una cuarta, distinta de la que usan Desaprobar y Eliminar, se habría sentido arbitraria. |
| El aviso doce lista nombres, como `ExcludedEmployeesNotice` | Un aviso de una línea ("recalcula") no se puede atender: hay que saber **quién** falta para decidir si el recálculo es lo correcto. Por eso no reutiliza `PayrollRecalculationNotice`. |
| La detección reutiliza las constantes de elegibilidad del `INSERT`, no una copia | Los dos cálculos (ordinario y aguinaldo) terminan en `<ELIGIBLE_*_CONDITIONS> AND salary.salario_diario > 0`. Usar las mismas constantes hace **imposible por construcción** un falso positivo que el recálculo no pueda limpiar, que sería un candado que nada satisface. |
| El aviso doce vive en estatus 2 **y 3**, a diferencia de los once | Es el único que denuncia que a una persona no se le va a pagar. En 3 todavía hay salida barata (Desaprobar); apagarlo al aprobar habría dejado el pago como el último momento posible de enterarse, sin aviso. |
| El aviso doce solo detecta faltantes, nunca sobrantes | A alguien dado de baja después del periodo le corresponden sus días trabajados. Avisar en esa dirección invitaría a recalcular y **borrarle** un pago legítimo: sería un aviso-trampa. |
| El aviso doce muestra los dos tipos de nómina siempre | El candado que alimenta es del periodo completo. Filtrarlo por el tipo de la URL, como hace el de excluidos, dejaría Aprobar deshabilitado sin un aviso visible que lo explicara. |
| Candado duro al pagar, no advertencia ámbar | Cumple el criterio con el que la spec 94 aceptó su único candado duro: es un caso en el que el sistema **sabe** que lo aprobado no es correcto. Un empleado elegible fuera del cálculo es una omisión objetiva, no una decisión del contador, y pagar es el último punto donde corregir es barato. |
| Aprobar queda bloqueado sin una línea nueva | La bandera doce entra en `IRecalculationFlags` y `approvePayrollPeriod` ya aborta con cualquier bandera activa. Reutilizar ese candado en lugar de escribir otro es lo que mantiene una sola regla. |
| Ordinarios y aguinaldo sí, PTU no | Los dos primeros toman su plantilla de `RH.empleados` en el momento del cálculo y tienen el mismo hueco. El universo de un periodo PTU es el reparto cerrado de la spec 89, donde un empleado nuevo no existe y la spec 90 ya bloquea las incoherencias. |
| Reabrir y recalcular, en lugar de insertar solo al empleado nuevo | Una acción "agregar empleado" necesitaría una segunda copia del `INSERT ... SELECT` completo —snapshot, percepciones, ISR, IMSS y los cinco candados de pago único— para una fila. Es exactamente la duplicación que la spec 94 evitó al extraer `collectRecalculationFlags`. |
| Un solo cambio de DDL | Recrear el `CHECK` de la bitácora es todo lo que hace falta. El aviso se calcula en vivo, como el de excluidos, y así no puede quedar desactualizado respecto a la ficha del empleado. |
| `UNAPPROVE_COMMENT_*` se renombra a `STATUS_COMMENT_*` | El motivo ya no es exclusivo de Desaprobar. Dos pares de constantes con el mismo 5 y el mismo 200 se habrían separado en el primer ajuste. |
| "Reabrir periodo" en la etiqueta, `reopenPayrollPeriod` en código | Es la palabra que usa el negocio y la que ya usa PTU (`reopenPtuDistribution`), así que el módulo queda consistente. El modal explica que el periodo vuelve a En cálculo. |
| El manual de usuario se actualiza en una spec aparte | Es la regla acordada para Nómina. Varias páginas afirman hoy que Pagada es definitiva y conviene reescribirlas juntas, con sus capturas. |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Reabrir de 4 a 3 en lugar de a 2 | Dejaría el periodo en un estatus desde el que no se puede recalcular, obligando a desaprobar enseguida: dos motivos obligatorios y dos filas de bitácora para una sola corrección. |
| Pagar los días del empleado nuevo en el periodo siguiente, como retroactivo | Es la práctica habitual de nómina y evitaría tocar un periodo pagado, pero hoy el cálculo solo mira días dentro del rango del periodo. Es una spec propia y más grande, y queda anotada como **candidata**. |
| Reservar Reabrir al rol 1 | Dejaría la acción inalcanzable para un equipo de nómina que trabaje con rol 4, que es el caso real de la clínica. |
| Permitir reabrir solo dentro de N días desde `paid_at` | Convertiría un error de captura detectado tarde en algo imposible de corregir en el sistema, sin proteger ningún dato. |
| Bloquear si existe un periodo posterior ya pagado | No protege nada: los candados de pago único ya impiden que el recálculo toque lo que ese periodo posterior tomó. |
| Escribir el código del periodo para confirmar | Fricción distinta a la del resto del módulo para un riesgo que el motivo y la bitácora ya cubren. |
| Una acción "Agregar empleado al periodo" sin recalcular | Segunda copia de toda la regla de cálculo para una fila. |
| Avisar también de empleados que están en el cálculo y hoy ya no son elegibles | Recalcular por ese aviso le borraría el pago a alguien dado de baja que sí trabajó esos días. |
| Mostrar el aviso doce también en estatus 4 | Un periodo pagado de hace meses lo mostraría para siempre, y a esa altura reabrir rara vez es la decisión correcta. Se eligió que el aviso viva donde corregir todavía es barato. Deja un hueco en los periodos ya pagados, anotado en los riesgos. |
| Guardar los faltantes en una tabla o una columna | Quedaría desactualizada en cuanto cambie la ficha del empleado. La detección en vivo es la misma decisión que tomó el aviso de excluidos. |
| Reutilizar `PayrollRecalculationNotice` para el aviso doce | Es un mensaje de una línea, sin nombres ni enlaces: no se puede atender. |
| Reabrir desde el listado de Periodos, o varios a la vez | Reabrir sin ver los montos que se van a mover es lo contrario de lo que buscan los candados. |
| Registrar en esta spec el delta a pagarle al empleado nuevo | Sin dispersión ni recibos, ese dato no alimenta nada. Cuando exista la dispersión, será su dueña. |

## Riesgos identificados

- **Los periodos que ya se pagaron sin alguien quedan invisibles.** El aviso doce no se evalúa en estatus 4, así que una omisión cometida antes de esta spec —o después de pagar— no se denuncia en ninguna pantalla. Es el hueco que deja la decisión de que el aviso viva donde corregir es barato.
  - Mitigación: una **consulta de diagnóstico** en `queries.txt`, para correr a mano, que liste los empleados elegibles sin fila en `period_employees` de **todos** los periodos en estatus 3 y 4 del ejercicio. Es la misma forma que ya tiene la consulta de diagnóstico de la spec 85 en ese archivo. Encontrado el caso, la corrección es Reabrir, que ahora existe.
- **Recalcular un periodo reabierto mueve montos ya dispersados.** No duplica pagos, pero una tarifa de ISR, un parámetro fiscal, la UMA o un tratamiento liquidado desde el cálculo original cambian los importes de empleados a los que ya se les transfirió su dinero. El sistema queda correcto y la transferencia queda desalineada.
  - Mitigación: el modal lo advierte en ámbar antes de confirmar, el motivo es obligatorio y la bitácora deja el rastro. La corrección de la dispersión ocurre fuera del sistema, y esta spec no pretende lo contrario.
- **Un falso positivo del aviso sería un candado que nada puede satisfacer.** Si el aviso detectara como faltante a alguien que el cálculo nunca va a insertar, el periodo quedaría imposible de aprobar y de pagar para siempre.
  - Mitigación: el aviso usa **las mismas constantes** de elegibilidad que el `INSERT` de los dos cálculos, no una reescritura, así que la divergencia no es posible hoy. El riesgo real es futuro: una spec que agregue una exclusión al `WHERE` del cálculo sin meterla en la constante reintroduciría el problema. Queda anotado en `docs/nomina.md` junto a la descripción del aviso.
- **El candado al pagar puede detener una nómina que el contador quería pagar sin esa persona.** Si existe un caso legítimo —alguien contratado el último día del periodo cuyo pago se decidió mover al siguiente—, el candado obliga a incluirlo y no ofrece salida.
  - Mitigación: la elegibilidad es objetiva, y hoy mover un pago al periodo siguiente no está soportado de ninguna forma. Si el caso resulta real en operación, su solución es la spec de pago retroactivo que quedó anotada como candidata, no debilitar el candado.
- **Ventana entre la detección y el `COMMIT` al pagar.** `loadMissingEligibleEmployees` corre antes de abrir la transacción, igual que las once comprobaciones de la spec 94. Si alguien da de alta un empleado en ese instante, el periodo se paga sin él.
  - Mitigación: la ventana es de milisegundos y, a diferencia de la spec 94, ahora **sí hay salida**: reabrir.
- **Reabrir un periodo extraordinario puede dejarlo atorado en estatus 2.** Un periodo de PTU reabierto vuelve a depender del reparto al recalcularse; si el reparto cambió de estado o algún trabajador quedó con tope en cero, el recálculo falla y el periodo se queda en 2 hasta corregir el reparto.
  - Mitigación: son los mismos mensajes de error de la spec 90, que ya explican qué corregir. El reparto sigue bloqueado mientras el periodo esté en 2, así que no se puede modificar por accidente a medias.
- **Reabrir se puede volver la salida fácil.** Con Pagada dejando de ser definitiva, la disciplina de revisar antes de aprobar se puede relajar: "si está mal, lo reabrimos".
  - Mitigación: cada reapertura queda en la bitácora con su autor, su fecha y su motivo, visible en el `<details>` del encabezado. Es auditable y es lo único que esta spec puede hacer al respecto.

## Lo que **no** entra en esta spec

- Las páginas del manual de usuario que hoy afirman que Pagada es definitiva.
- Pagar días retroactivos en el periodo siguiente, la alternativa que queda anotada como candidata a su propia spec.
- Agregar un solo empleado a un periodo sin recalcularlo.
- Avisar de empleados que están en el cálculo y hoy ya no son elegibles.
- El aviso de faltantes en periodos de PTU y en estatus 4.
- Reabrir desde el listado de Periodos, o varios periodos a la vez.
- Reservar Reabrir al rol 1, un límite de antigüedad o cualquier otro candado para reabrir.
- Registrar, calcular o corregir la dispersión bancaria, el delta pendiente, recibos y timbrado del CFDI.
- Notificaciones a quien había aprobado o pagado el periodo.
- El candado de `setShiftExtensionAssignment` en periodos aprobados, que sigue siendo el riesgo abierto de la spec 94.
- Registrar las transiciones 1 → 2 y 2 → 1 en la bitácora.

Cada uno de esos, si llega, va en su propia spec.
