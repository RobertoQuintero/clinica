# 86 — Causas de baja laboral por empleado

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 25 (`empleados-alta-listado-detalle`): `RH.empleados`, `EmployeeModal`, `EmployeeHeader`, `setEmployeeActive`.
  - 76 (`empleado-asignacion-vacaciones`): bloques de vacaciones que impiden registrar la baja.
  - 79 (`empleado-dias-economicos`): días económicos activos que impiden registrar la baja.
- **Modifica base de datos:** Sí.
  - Tabla nueva `RH.cat_causas_baja`, sembrada con el catálogo IMSS.
  - Tabla nueva `RH.employee_terminations`.
  - Columna nueva `RH.empleados.id_empleado_anterior`, con un índice único filtrado.
- **Fecha:** 2026-10-16
- **Objetivo:** Registrar la baja de un empleado con causa IMSS y tipo renuncia/despido, con historial, anulación y reingreso.

### Contexto (2026-10-16)

- Hoy la baja es solo `setEmployeeActive` (`app/dashboard/empleados/actions.ts`), que cambia `activo`. No guarda fecha, causa ni historial.
- La nómina (spec 53) documenta que "no existe una `fecha_baja`": los inactivos simplemente no entran al cálculo.
- `references/docs/aguinaldo.md` pide que la baja pregunte si fue renuncia (finiquito) o despido (liquidación con indemnizaciones).
- `RH.vacation_entitlements` es `UNIQUE (id_empleado, anio_servicio)` y cuenta la antigüedad desde `fecha_ingreso`. Por eso el reingreso crea un empleado nuevo en lugar de reutilizar el registro.
- Este spec es la base para el cálculo del aguinaldo (anual y proporcional) y del finiquito, que irán en specs posteriores.

## Alcance

**Entra:**

- **Tabla `RH.cat_causas_baja`.** Lleva sembradas las 10 causas IMSS/IDSE: 1 Término de contrato, 2 Separación voluntaria, 3 Abandono de empleo, 4 Defunción, 5 Clausura, 6 Otras, 7 Ausentismo, 8 Rescisión de contrato, 9 Jubilación y A Pensión. Cada causa tiene un `tipo_terminacion_sugerido`. No hay pantalla para editar el catálogo.
- **Tabla `RH.employee_terminations`.** Guarda una fila por cada baja, con `fecha_baja`, la causa, `tipo_terminacion` (`'R'` renuncia, `'D'` despido), `observaciones` opcionales y quién la registró y cuándo. Para anular no se borra la fila: se llenan `anulado_by`, `anulado_at` y `motivo_anulacion`.
- **Solo una baja vigente por empleado**, garantizado por un índice único filtrado `WHERE anulado_at IS NULL`.
- **Registrar la baja (`registerEmployeeTermination`).** Pone `activo = 0` en la misma transacción. Reglas:
  - `fecha_ingreso ≤ fecha_baja ≤ hoy`.
  - El empleado no tiene una baja vigente.
  - El empleado no tiene un bloque de vacaciones ni un día económico activo con fecha posterior a `fecha_baja`. Si los tiene, se rechaza con un mensaje que dice cuál es.
- **Anular la baja (`cancelEmployeeTermination`).** El motivo es obligatorio. Regresa `activo = 1` y se rechaza si el registro ya tiene un reingreso.
- **Reingreso (`rehireEmployee`).** Crea un empleado nuevo con un `id_empleado_anterior` que apunta al registro dado de baja. Detalles:
  - Usa el `EmployeeModal` en modo alta, precargado con los datos personales, fiscales, bancarios y laborales.
  - `fecha_ingreso` es obligatoria y debe ser `> fecha_baja`.
  - Se genera un `codigo_empleado` nuevo.
  - Un índice único filtrado impide reingresar dos veces desde el mismo registro.
- **"Dar de baja" reemplaza a "Desactivar"** en `EmployeeActions`. El botón abre un modal con fecha, causa, tipo (precargado con el sugerido de la causa y editable) y observaciones.
- **Encabezado con baja vigente.** Muestra "Baja · {fecha} · {causa} · Renuncia/Despido" y los botones "Anular baja" y "Reingresar".
- **Encabezado de un inactivo sin baja.** Muestra "Inactivo sin baja registrada" y los botones "Registrar baja" (que acepta fecha pasada) y "Activar".
- **`setEmployeeActive` solo sirve para activar** y solo a un empleado sin baja vigente. Ya no puede desactivar.
- **Aviso en el modal de baja:** "Tiene N usuarios vinculados y M identificadores de checador activos". No los desactiva.
- **Bloque "Historial de bajas"** en la pestaña General (`EmployeeGeneralInfo`), con las bajas vigentes y las anuladas. También muestra los vínculos "Reingresó como {código}" y "Reingreso de {código}".
- **Listado de empleados:** la fecha de baja aparece bajo el badge rojo de los inactivos.
- **Permisos:** solo los roles 1 y 4, revisados también dentro de cada server action. Todas las entradas se validan con `zod`.
- **Documentación:** se actualizan `docs/rh-empleados.md` y el DDL en `queries.txt`.

**Fuera de alcance (para specs futuros):**

- Calcular el finiquito o la liquidación: sueldo pendiente, aguinaldo, vacaciones y prima vacacional proporcionales, indemnizaciones (90 días y 20 días por año) y prima de antigüedad.
- Prorratear la nómina del periodo en que cae la baja. El empleado dado de baja sigue sin entrar al cálculo, como hoy.
- El aguinaldo, tanto el anual como el proporcional.
- Bajas con fecha futura (programadas).
- Desactivar en automático los usuarios vinculados o los PINs de checador.
- Copiar al reingreso el horario, los documentos, los PINs o los usuarios.
- Antigüedad acumulada entre contrataciones. Cada registro cuenta desde su propia `fecha_ingreso`.
- Editar una baja. Para corregirla se anula y se registra otra.
- Crear bajas en automático para los inactivos que ya existen.
- Avisar de la baja al IMSS (IDSE/SUA) y timbrar el CFDI del finiquito.
- Una pantalla para editar el catálogo de causas.
- Filtros o reportes de bajas por causa o por periodo.

## Modelo de datos

### SQL (DDL en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`)

```sql
-- Spec 86: catálogo IMSS/IDSE de causas de baja. Sembrado, sin pantalla de edición.
CREATE TABLE [RH].[cat_causas_baja](
    [clave]                     [char](1)      NOT NULL,   -- '1'..'9', 'A'
    [nombre]                    [nvarchar](100) NOT NULL,
    [tipo_terminacion_sugerido] [char](1)      NOT NULL,   -- 'R' | 'D'; solo precarga el modal
    [status]                    [bit]          NOT NULL CONSTRAINT [DF_cat_causas_baja_status] DEFAULT (1),
 CONSTRAINT [PK_cat_causas_baja] PRIMARY KEY CLUSTERED ([clave] ASC),
 CONSTRAINT [CK_cat_causas_baja_tipo] CHECK ([tipo_terminacion_sugerido] IN ('R','D'))
) ON [PRIMARY]
GO

-- Siembra idempotente (INSERT ... WHERE NOT EXISTS):
-- '1' Término de contrato  R | '2' Separación voluntaria R | '3' Abandono de empleo R
-- '4' Defunción            R | '5' Clausura               D | '6' Otras              R
-- '7' Ausentismo           R | '8' Rescisión de contrato  D | '9' Jubilación         R
-- 'A' Pensión              R

CREATE TABLE [RH].[employee_terminations](
    [id_employee_termination] [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]             [int]            NOT NULL,
    [fecha_baja]              [date]           NOT NULL,   -- último día laborado
    [clave_causa]             [char](1)        NOT NULL,
    [tipo_terminacion]        [char](1)        NOT NULL,   -- 'R' renuncia/finiquito, 'D' despido/liquidación
    [observaciones]           [nvarchar](500)  NULL,
    [registrado_by]           [int]            NOT NULL,
    [registrado_at]           [datetime2](0)   NOT NULL,   -- buildDate(new Date())
    -- Anulación (todo NULL o todo lleno)
    [anulado_by]              [int]            NULL,
    [anulado_at]              [datetime2](0)   NULL,
    [motivo_anulacion]        [nvarchar](500)  NULL,
 CONSTRAINT [PK_employee_terminations] PRIMARY KEY CLUSTERED ([id_employee_termination] ASC),
 CONSTRAINT [FK_employee_terminations_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [FK_employee_terminations_causa] FOREIGN KEY ([clave_causa])
     REFERENCES [RH].[cat_causas_baja] ([clave]),
 CONSTRAINT [CK_employee_terminations_tipo] CHECK ([tipo_terminacion] IN ('R','D')),
 CONSTRAINT [CK_employee_terminations_anulacion] CHECK (
     ([anulado_by] IS NULL AND [anulado_at] IS NULL AND [motivo_anulacion] IS NULL)
  OR ([anulado_by] IS NOT NULL AND [anulado_at] IS NOT NULL AND [motivo_anulacion] IS NOT NULL
          AND LEN(LTRIM(RTRIM([motivo_anulacion]))) > 0))
) ON [PRIMARY]
GO

-- Una sola baja vigente por empleado.
CREATE UNIQUE NONCLUSTERED INDEX [UX_employee_terminations_empleado_vigente]
    ON [RH].[employee_terminations] ([id_empleado])
    WHERE [anulado_at] IS NULL
GO

-- Reingreso: el registro nuevo apunta al registro dado de baja.
ALTER TABLE [RH].[empleados] ADD [id_empleado_anterior] [int] NULL
    CONSTRAINT [FK_empleados_empleado_anterior] REFERENCES [RH].[empleados] ([id_empleado])
GO

-- Desde un registro solo se puede reingresar una vez.
CREATE UNIQUE NONCLUSTERED INDEX [UX_empleados_empleado_anterior]
    ON [RH].[empleados] ([id_empleado_anterior])
    WHERE [id_empleado_anterior] IS NOT NULL
GO
```

`fecha_baja ≥ fecha_ingreso` y `fecha_baja ≤ hoy` no van en un `CHECK` porque dependen de otra tabla y de la fecha actual. Esas dos reglas se validan en la server action, dentro del `INSERT … SELECT … WHERE`.

### TypeScript (`interfaces/employee_termination.ts`, nuevo)

```ts
export type TerminationType = "R" | "D";

export interface ITerminationCause {
  clave: string;                          // '1'..'9' | 'A'
  nombre: string;
  tipo_terminacion_sugerido: TerminationType;
}

export interface IEmployeeTermination {
  id_employee_termination: number;
  id_empleado: number;
  fecha_baja: string;                     // "YYYY-MM-DD", nunca Date
  clave_causa: string;
  nombre_causa: string;
  tipo_terminacion: TerminationType;
  observaciones: string | null;
  registrado_by: number;
  registrado_by_nombre: string;
  registrado_at: string;                  // "YYYY-MM-DD HH:mm:ss"
  anulado_by: number | null;
  anulado_by_nombre: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
}
```

### Cambios en `interfaces/employee.ts`

- **`IEmployee`** gana `id_empleado_anterior: number | null`.
- **`IEmployeeRecord`** (el detalle) gana tres campos:
  - `baja_vigente: IEmployeeTermination | null`
  - `codigo_empleado_anterior: string | null`
  - `reingreso: { id_empleado: number; codigo_empleado: string } | null`, que es el registro que apunta a este.
- **El listado (`getEmployees`)** gana `fecha_baja: string | null` por medio de un `OUTER APPLY` sobre la baja vigente.

### Constantes (`lib/terminations/terminationRules.ts`, nuevo, puro)

```ts
export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  R: "Renuncia (finiquito)",
  D: "Despido (liquidación)",
};
export const TERMINATION_NOTES_MAX_LENGTH = 500;
```

### Convenciones

- Todas las fechas viajan como strings. La lectura usa `CONVERT(varchar(10), [fecha_baja], 120)` y `CONVERT(varchar(19), [registrado_at], 120)`.
- **"Baja vigente"** es una fila con `anulado_at IS NULL`. No hay columna `estado`.
- **"Inactivo sin baja registrada"** es un empleado con `activo = 0` y sin baja vigente.

## Plan de implementación

1. **DDL y siembra.** Se agregan a `queries.txt` (bloque `RECURSOS HUMANOS(EMPLEADOS)`) `RH.cat_causas_baja` con su siembra idempotente de las 10 causas, `RH.employee_terminations`, su índice filtrado, y la columna `id_empleado_anterior` con su índice. Después se ejecuta todo contra la base de desarrollo.
   *Verificación:* `SELECT * FROM RH.cat_causas_baja` devuelve 10 filas. Insertar a mano dos bajas vigentes para el mismo empleado falla por `UX_employee_terminations_empleado_vigente`.

2. **Tipos, reglas y lecturas, sin UI.**
   - Se crean `interfaces/employee_termination.ts` y `lib/terminations/terminationRules.ts`.
   - Nuevo `app/dashboard/empleados/[id]/bajas/actions.ts` (carpeta sin `page.tsx`, así que no crea ruta) con `getTerminationCauses` y `getEmployeeTerminations(id_empleado)`, que trae las vigentes y las anuladas con los nombres de quien las registró o anuló.
   - `getEmployeeById` devuelve `baja_vigente`, `codigo_empleado_anterior` y `reingreso`.
   - `getEmployees` devuelve `fecha_baja` con un `OUTER APPLY`.
   - `IEmployee` gana `id_empleado_anterior`.

   *Verificación:* la app compila y el detalle y el listado se ven igual que antes.

3. **Registrar la baja (server).**
   - `registerEmployeeTermination` valida con `zod` en `[id]/bajas/schemas.ts` (`server-only`) y repite el permiso de roles 1/4 con `assertVacationAccess`.
   - Dentro de `db.transaction`:
     - Bloquea al empleado (`UPDLOCK`).
     - Revisa que esté activo, que `fecha_ingreso ≤ fecha_baja ≤ hoy` (hora de Ciudad de México) y que no haya un bloque de vacaciones con `fecha_fin > fecha_baja` ni un día económico activo con `fecha > fecha_baja`. Si falla una regla, regresa un mensaje que nombra la fecha o el bloque.
     - Hace `INSERT … OUTPUT INSERTED` de la baja y `UPDATE … SET activo = 0 WHERE activo = 1`. Si alguna de las dos afecta 0 filas, devuelve `{ ok: false }` y hace rollback.
   - Además se agrega `getTerminationWarnings(id_empleado)`, que cuenta los usuarios vinculados con `status = 1` y los identificadores de checador activos, para el aviso del modal.

   *Verificación:* llamar la acción con un bloque futuro la rechaza. Sin pendientes, crea la fila y deja `activo = 0`.

4. **Modal "Dar de baja" y estados del encabezado.**
   - Nuevo `[id]/componentes/RegisterTerminationModal.tsx` (Client Component) con fecha, causa, tipo (precargado desde `tipo_terminacion_sugerido` y editable), observaciones y el aviso de usuarios y PINs.
   - `EmployeeActions` cambia "Desactivar" por "Dar de baja". En un inactivo sin baja muestra "Registrar baja" y "Activar".
   - `EmployeeHeader` muestra "Baja · {fecha} · {causa} · {tipo}" o "Inactivo sin baja registrada".
   - `setEmployeeActive(id_empleado)` queda **solo para activar**: hace `UPDATE … SET activo = 1 WHERE activo = 0 AND NOT EXISTS (baja vigente)`.

   *Verificación:* desde el detalle se da de baja a un empleado, el encabezado cambia y ya no existe ningún botón que lo desactive sin una baja.

5. **Anular la baja.**
   - `cancelEmployeeTermination` pide un motivo obligatorio (máximo 500). Dentro de la transacción:
     - Hace `UPDATE … SET anulado_* WHERE anulado_at IS NULL AND NOT EXISTS (empleado con id_empleado_anterior = @id)`.
     - Luego hace `UPDATE RH.empleados SET activo = 1`.
   - Nuevo `CancelTerminationModal.tsx` con el botón "Anular baja".

   *Verificación:* después de anular, el empleado está activo y la fila tiene `anulado_at`. Se puede registrar otra baja.

6. **Historial y listado.**
   - Nuevo `[id]/componentes/EmployeeTerminationHistory.tsx` (Server Component) dentro de `EmployeeGeneralInfo`. Muestra cada baja con fecha, causa, tipo, observaciones, quién la registró y, si fue anulada, quién, cuándo y por qué.
   - Además muestra "Reingresó como {código}" y "Reingreso de {código}", con liga.
   - `EmployeeRow` muestra "Baja {dd/mm/aaaa}" bajo el badge rojo.

   *Verificación:* un empleado con una baja anulada y otra vigente muestra las dos en orden. El listado muestra la fecha.

7. **Reingreso.**
   - `rehireEmployee(id_empleado_anterior, input)` reutiliza `parseEmployeeInput` y valida:
     - que el registro anterior tenga una baja vigente;
     - que no tenga un reingreso previo;
     - que `fecha_ingreso > fecha_baja`.
   - Inserta el nuevo empleado con `id_empleado_anterior` y un `codigo_empleado` nuevo de `generateEmployeeCode`. Si el índice único falla, regresa "Este registro ya tiene un reingreso".
   - `EmployeeModal` acepta un modo de reingreso: datos precargados, `fecha_ingreso` vacía, título "Reingresar empleado".
   - El botón "Reingresar" está en `EmployeeActions` y, al guardar, navega al nuevo registro.

   *Verificación:* reingresar crea un registro nuevo y activo con su propia antigüedad, sin vacaciones heredadas. El registro anterior ya no ofrece "Anular baja" ni "Reingresar".

8. **Documentación.**
   - `docs/rh-empleados.md` gana una sección "Bajas (spec 86)" y la menciona en la línea 4, donde se listan las pestañas y bloques del detalle.
   - En `docs/nomina.md` se cambia la frase "No `fecha_baja` exists" por "`fecha_baja` existe (spec 86), pero la nómina todavía no la usa: el empleado dado de baja simplemente no entra".

## Criterios de aceptación

**Base de datos**
- [x] `RH.cat_causas_baja` tiene exactamente 10 filas, `'1'` a `'9'` y `'A'`, y correr la siembra otra vez no duplica nada.
- [x] Insertar una segunda baja vigente para el mismo empleado falla por `UX_employee_terminations_empleado_vigente`.
- [x] Insertar una baja anulada a medias (por ejemplo, `anulado_at` sin `motivo_anulacion`) falla por `CK_employee_terminations_anulacion`.
- [x] Insertar dos empleados con el mismo `id_empleado_anterior` falla por `UX_empleados_empleado_anterior`.

**Registrar la baja**
- [x] Un empleado activo ya no muestra el botón "Desactivar". En su lugar aparece "Dar de baja".
- [x] Al elegir una causa en el modal, el tipo se precarga con su `tipo_terminacion_sugerido` y se puede cambiar.
- [x] Guardar una baja válida crea una fila en `RH.employee_terminations` y deja `activo = 0` en la misma operación.
- [ ] Una `fecha_baja` mayor que hoy se rechaza.
- [ ] Una `fecha_baja` menor que `fecha_ingreso` se rechaza.
- [ ] Con un bloque de vacaciones cuyo `fecha_fin` es posterior a `fecha_baja`, se rechaza con un mensaje que incluye las fechas del bloque.
- [x] Con un día económico activo posterior a `fecha_baja`, se rechaza con un mensaje que incluye esa fecha.
- [ ] Si el empleado tiene usuarios vinculados o PINs activos, el modal muestra el aviso con N y M. Guardar no cambia `users.status` ni los identificadores.
- [ ] Unas observaciones de más de 500 caracteres se rechazan en el servidor.
- [ ] Un usuario con rol distinto de 1 o 4 que llama `registerEmployeeTermination` directamente recibe `{ ok: false }` y no se escribe nada.

**Encabezado y estados**
- [ ] Con una baja vigente, el encabezado muestra "Baja · {fecha} · {causa} · {Renuncia (finiquito) | Despido (liquidación)}" y los botones "Anular baja" y "Reingresar".
- [x] Un empleado con `activo = 0` y sin baja vigente muestra "Inactivo sin baja registrada" y los botones "Registrar baja" y "Activar".
- [x] "Registrar baja" en un inactivo sin baja acepta una fecha pasada y crea la fila sin cambiar `activo`, que ya es 0.
- [ ] `setEmployeeActive` sobre un empleado con baja vigente no cambia nada y regresa `{ ok: false }`.
- [ ] Ningún camino de la UI deja a un empleado con `activo = 0` sin crear antes una baja, salvo los inactivos que ya existían.

**Anular**
- [x] Anular sin motivo se rechaza.
- [x] Anular con motivo llena `anulado_by`, `anulado_at` y `motivo_anulacion`, deja `activo = 1` y conserva la fila.
- [x] Después de anular se puede registrar una baja nueva para el mismo empleado.
- [x] Un registro que ya tiene un reingreso no muestra "Anular baja", y la acción lo rechaza si se llama directamente.

**Historial y listado**
- [ ] La pestaña General muestra "Historial de bajas" con las vigentes y las anuladas, de la más reciente a la más antigua, incluyendo quién registró y quién anuló.
- [ ] En el listado, los inactivos con baja vigente muestran "Baja {dd/mm/aaaa}" bajo el badge rojo, y los inactivos sin baja no muestran fecha.

**Reingreso**
- [ ] "Reingresar" abre `EmployeeModal` precargado con los datos del registro anterior y con `fecha_ingreso` vacía.
- [ ] Una `fecha_ingreso ≤ fecha_baja` se rechaza.
- [ ] Guardar crea un empleado nuevo y activo con un `codigo_empleado` distinto y `id_empleado_anterior` igual al registro anterior, y navega a su detalle.
- [ ] El nuevo registro no tiene horario, documentos, identificadores, usuarios vinculados, vacaciones ni días económicos del anterior.
- [ ] El registro anterior sigue inactivo, ya no muestra "Reingresar" y su historial dice "Reingresó como {código}".
- [ ] El historial del nuevo registro dice "Reingreso de {código}".
- [ ] Un segundo reingreso desde el mismo registro, por ejemplo con dos pestañas abiertas, regresa "Este registro ya tiene un reingreso".

**Sin regresiones**
- [ ] Un empleado dado de baja no aparece en el cálculo de nómina, igual que un inactivo hoy.
- [ ] `syncVacationEntitlements` no le genera años nuevos a un empleado dado de baja.
- [ ] Ninguna fecha nueva viaja como `Date`: todos los SELECT usan `CONVERT(..., 120)`.
- [ ] `npm run lint` y `npm run build` terminan sin errores nuevos.

**Documentación**
- [ ] `docs/rh-empleados.md` tiene la sección "Bajas (spec 86)" y su línea 4 la menciona.
- [ ] `docs/nomina.md` ya no dice que "No `fecha_baja` exists".

## Decisiones

- **Sí: este spec solo registra la baja.** El finiquito necesita el aguinaldo proporcional, que todavía no existe. Además, los montos de un despido (indemnizaciones y prima de antigüedad) tienen sus propias reglas y van en otro spec.
- **No: calcular montos aquí.** Mezclaría captura de RH con cálculo de nómina en un mismo spec.
- **Sí: catálogo IMSS/IDSE en `RH.cat_causas_baja`, sembrado y sin pantalla.** Es la clave que pide el IMSS para el aviso de baja y sigue el mismo patrón que `RH.cat_bancos`.
- **No: solo "renuncia/despido" ni un catálogo libre.** Con dos opciones se pierde la causa IMSS. Con un catálogo libre, cada sucursal inventaría causas que no corresponden al IDSE.
- **Sí: `tipo_terminacion` se captura en cada baja, con un valor sugerido por la causa.** `aguinaldo.md` pide que el sistema pregunte. Además, causas como "8 Rescisión" pueden ser despidos justificados o injustificados, así que el catálogo no puede decidirlo solo.
- **No: fijar el tipo en el catálogo.** Obligaría a resolver de antemano casos que dependen de cada baja.
- **Sí: "Dar de baja" reemplaza a "Desactivar".** Con dos caminos aparecerían inactivos nuevos sin `fecha_baja`, y el aguinaldo proporcional no podría calcularles nada.
- **Sí: "Activar" se queda solo para los inactivos sin baja registrada.** Así se puede corregir a alguien que se desactivó por error antes de este spec, sin tener que inventarle una baja.
- **Sí: `fecha_baja` es el último día laborado, con `fecha_ingreso ≤ fecha_baja ≤ hoy`.** La baja pone `activo = 0` en ese momento. Si se permitiera una fecha futura, el empleado saldría de la nómina en curso antes de irse.
- **No: bajas programadas.** Necesitarían un proceso que desactive en la fecha, o separar `activo` de la vigencia. Eso va en otro spec si llega a hacer falta.
- **Sí: una baja se bloquea si hay vacaciones o días económicos después de `fecha_baja`.** Es el mismo criterio que la validación cruzada de vacaciones y días económicos del spec 79: RH decide qué cancelar y nada se borra sin que alguien lo pida.
- **No: cancelar esos pendientes automáticamente.** Escribiría registros en `vacation_entitlement_log` y `economic_days` sin que RH lo decida.
- **Sí: la anulación conserva la fila** (`anulado_by`, `anulado_at`, `motivo_anulacion`). La fila misma sirve de bitácora, igual que en `RH.economic_days`.
- **No: editar una baja.** Si la baja se pudiera editar, haría falta una bitácora de cambios. Anular y registrar otra deja el rastro sin tabla extra.
- **Sí: el reingreso crea un registro nuevo** con `id_empleado_anterior`. `UNIQUE (id_empleado, anio_servicio)` y el cálculo de antigüedad desde `fecha_ingreso` chocarían con la contratación anterior. Con un registro nuevo, los specs 76 a 80 siguen funcionando sin cambios.
- **No: el mismo `id_empleado` con otra `fecha_ingreso`.** Obligaría a rediseñar las vacaciones, los días económicos y la antigüedad por periodo de contratación.
- **Sí: un índice único filtrado sobre `id_empleado_anterior`.** Evita en la base de datos que dos pestañas abiertas reingresen dos veces desde el mismo registro.
- **No: copiar al reingreso el horario, los documentos, los PINs o los usuarios.** El horario puede ser otro, los documentos son de la contratación anterior, y los PINs y usuarios tienen sus propias pantallas para reasignarse.
- **Sí: la baja solo avisa de los usuarios y PINs activos; no los desactiva.** Mantiene la regla actual ("deactivating an employee does not unlink") y no se mete en el dominio de usuarios.
- **Sí: los inactivos que ya existen quedan como "Inactivo sin baja registrada".** Una fecha inventada, como `updated_at`, contaminaría el aguinaldo proporcional y la antigüedad del finiquito.
- **No: prorratear la nómina del periodo en que cae la baja.** Toca `eligibleEmployees.ts` y casi todas las percepciones. Va con el finiquito.
- **Sí: no hay pestaña nueva.** La baja se maneja desde el encabezado y el historial vive en General. Una pestaña nueva tendría casi siempre una sola fila.
- **Sí: las acciones van en `app/dashboard/empleados/[id]/bajas/`, sin `page.tsx`.** Siguen la convención de una carpeta con su `actions.ts` y `schemas.ts` por cada área del detalle, sin crear una ruta y sin engordar `empleados/actions.ts`.
- **Sí: los permisos de roles 1/4 se repiten dentro de cada acción con `assertVacationAccess`.** Una server action se puede llamar sin pasar por `proxy.ts`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **Registrar la baja de un inactivo que ya existía con una fecha pasada que choca con una nómina ya calculada.** Ese empleado no entró a la nómina por estar inactivo, así que nada se recalcula. | No se toca la nómina en este spec. El spec del finiquito decidirá cómo liquidar un periodo pasado. |
| **Anular una baja después de que una nómina ya se calculó sin ese empleado.** Vuelve a `activo = 1`, pero el periodo ya cerrado no lo incluye. | Hoy pasa lo mismo al reactivar. Si el periodo sigue en estado 2, el aviso "Recalcula" de nómina lo detecta. No se bloquea. |
| **El reingreso deja dos registros con el mismo RFC, CURP y NSS.** Una búsqueda o un reporte futuro podría contarlos como dos personas. | `id_empleado_anterior` liga los dos registros. Hoy no hay índice único sobre RFC o CURP, así que no se rompe nada. Un reporte que necesite a la persona y no al registro puede recorrer la cadena. |
| **Los usuarios y PINs del empleado dado de baja siguen activos.** El empleado podría seguir entrando al sistema o checando. | El modal avisa cuántos tiene, con ligas a las pestañas Usuarios y Asistencia. Desactivarlos en automático queda fuera de alcance a propósito. |
| **Un tipo sugerido mal puesto en el catálogo** (por ejemplo, "3 Abandono" como `R`) lleva a capturar el tipo equivocado sin que nadie lo note. | El tipo es visible y se puede cambiar en el modal, y el encabezado lo muestra después de guardar. Corregir el sugerido es un `UPDATE` al catálogo y no afecta las bajas ya registradas. |
| **Dos personas registran la baja del mismo empleado al mismo tiempo.** | `UPDLOCK` sobre el empleado dentro de la transacción, más el índice `UX_employee_terminations_empleado_vigente`. La segunda recibe `{ ok: false }`. |
| **`EmployeeModal` crece con un tercer modo** (alta, edición y reingreso) y se vuelve frágil. | El reingreso es un alta con valores iniciales y un `id_empleado_anterior`. No agrega campos nuevos al formulario. |

## Lo que **no** entra en este spec

- El cálculo del finiquito o la liquidación, y el aguinaldo, tanto el anual como el proporcional.
- El prorrateo de la nómina del periodo en que cae la baja.
- Las bajas con fecha futura.
- Desactivar en automático los usuarios o los PINs de checador.
- Copiar al reingreso el horario, los documentos, los PINs o los usuarios.
- La antigüedad acumulada entre contrataciones.
- Editar una baja.
- Crear bajas en automático para los inactivos que ya existen.
- El aviso de baja al IMSS (IDSE/SUA) y el CFDI del finiquito.
- Una pantalla para editar el catálogo de causas, y reportes o filtros de bajas.

Si alguno de estos llega a hacerse, va en su propio spec.
