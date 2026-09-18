# 51 — Empleados: campo periodo de pago (catálogo RH.payment_periods)

## Header

- **Estado:** Aprobado
- **Depende de:** [25 — Módulo de Empleados (RH): alta, listado y expediente](25-empleados-alta-listado-detalle.md). No modifica la estructura base de `RH.empleados` salvo por agregar una columna FK nueva.
- **Fecha:** 2026-09-18
- **Objetivo:** Agregar el campo "Periodo de pago" (catálogo `RH.payment_periods`) al modal de alta/edición de empleado y al expediente, como un nuevo `select` opcional junto a los demás datos laborales.

## Alcance

**Incluye:**

- **Base de datos:**
  - Se agrega la columna `[id_periodo_pago] [tinyint] NULL` a `RH.empleados`, con FK hacia `RH.payment_periods.[id_payment_period]`.
  - DDL documentado en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, junto al `ALTER TABLE` de la spec 38.
  - Se documenta también, por completitud, el `CREATE TABLE [RH].[payment_periods]` existente en `queries.txt` (hoy no está documentado ahí), ya que su estructura real (`id_payment_period`, `clave_sat`, `description`, `days`, `status`) se conoce hasta esta spec.
- **`interfaces/rh_catalogs.ts`:** se agrega la interfaz `IPaymentPeriod` (`id_payment_period`, `clave_sat`, `description`, `days`, `status`), siguiendo el patrón de `IShift`.
- **`interfaces/employee.ts`:**
  - `IEmployee` gana `id_periodo_pago: number | null`, junto a `id_turno`.
  - `EmployeeFormInput` (derivado por `Omit`) refleja el cambio automáticamente.
- **`app/dashboard/empleados/actions.ts`:**
  - El SELECT de listado/detalle (`EMPLOYEE_SELECT_COLUMNS`) agrega `e.[id_periodo_pago]`.
  - `getEmployeeById` agrega un `LEFT JOIN` a `RH.payment_periods` y expone `nombre_periodo_pago` (la `description` del periodo), siguiendo el mismo patrón que `nombre_turno`.
  - `getEmployeeCatalogs` agrega `paymentPeriods: IPaymentPeriod[]` a `IEmployeeCatalogs`, consultando `RH.payment_periods` con `WHERE [status] = 1 ORDER BY [id_payment_period]`.
  - `createEmployee`/`updateEmployee` (INSERT y UPDATE) agregan `id_periodo_pago` a los parámetros y statements, como campo opcional (`NULL` si no se selecciona).
- **`EmployeeModal.tsx`:**
  - `buildEmptyForm()` y `employeeToFormInput()` agregan `id_periodo_pago`.
  - En la sección "Información laboral", se agrega un `<select>` "Periodo de pago" (no obligatorio) junto a "Turno", mostrando `description` de cada periodo, con opción "Sin periodo" cuando es `null`.
- **`interfaces/employee.ts` → `IEmployeeRecord`:** gana `nombre_periodo_pago: string | null` (igual patrón que `nombre_turno`).
- **`EmployeeGeneralInfo.tsx`:** se agrega la fila "Periodo de pago" (mostrando `nombre_periodo_pago` o "—"), junto a la fila de "Tipo de salario".

**No incluye (explícitamente fuera de alcance):**

- No se modifica el listado (`/dashboard/empleados/page.tsx`) ni `EmployeeHeader.tsx` — ninguno de los dos muestra hoy campos laborales de este tipo.
- No se usa `clave_sat` ni `days` en la UI del empleado — son atributos del catálogo, no del formulario de empleado; solo se muestra `description`.
- No se modifica `RH.payment_periods` (no se agregan/quitan registros del catálogo); esta spec solo consume el catálogo existente.
- No se hace obligatorio el campo, ni se migran datos existentes de empleados ya creados (quedan con `id_periodo_pago = NULL` hasta que se edite el registro).

## Modelo de datos

**Documentar `RH.payment_periods` en `queries.txt`** (tabla ya existe en BD, no se crea; se documenta por completitud junto a las demás tablas de RH):

> **Nota de implementación:** al ejecutar contra la BD real se detectó que los tipos reales de
> `RH.payment_periods` difieren de lo asumido abajo: `id_payment_period` es `smallint` (no
> `tinyint`) y `clave_sat` es `varchar(50)` (no `varchar(10)`). El DDL siguiente y el de
> `id_periodo_pago` en `RH.empleados` ya reflejan los tipos reales (`smallint`).

```sql
CREATE TABLE [RH].[payment_periods](
    [id_payment_period] [smallint]     NOT NULL,
    [clave_sat]         [varchar](50)  NULL,   -- clave del catálogo SAT c_PeriodicidadPago
    [description]       [varchar](50)  NOT NULL,
    [days]              [smallint]     NULL,   -- duración del periodo en días, ej. 7, 15, 30
    [status]            [bit]          NOT NULL CONSTRAINT [DF_payment_periods_status] DEFAULT (1),

 CONSTRAINT [PK_payment_periods] PRIMARY KEY CLUSTERED ([id_payment_period] ASC)
) ON [PRIMARY]
GO
```

**ALTER TABLE sobre `RH.empleados`** (DDL a agregar en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, debajo del `ALTER TABLE` de la spec 38):

```sql
-- Spec 51: periodo de pago del empleado (catálogo RH.payment_periods).
-- id_periodo_pago es smallint (no tinyint) para coincidir con el tipo real de
-- RH.payment_periods.id_payment_period (ver nota de implementación arriba).
ALTER TABLE [RH].[empleados] ADD
    [id_periodo_pago] [smallint] NULL
    CONSTRAINT [FK_empleados_periodo_pago]
        FOREIGN KEY REFERENCES [RH].[payment_periods] ([id_payment_period]);
GO
```

**`interfaces/rh_catalogs.ts`** (nueva interfaz, junto a `IShift`):

```ts
export interface IPaymentPeriod {
  id_payment_period: number;
  clave_sat:          string | null;
  description:        string;
  days:               number | null;
  status:             boolean;
}
```

**`interfaces/employee.ts` — diff sobre `IEmployee`:**

```ts
// Se agrega, junto a id_turno:
id_periodo_pago: number | null;
```

**`interfaces/employee.ts` — diff sobre `IEmployeeRecord`:**

```ts
// Se agrega, junto a nombre_turno:
nombre_periodo_pago: string | null;
```

**`app/dashboard/empleados/actions.ts` — diff sobre `IEmployeeCatalogs`:**

```ts
export interface IEmployeeCatalogs {
  departments:    IDepartment[];
  positions:      IPosition[];
  shifts:         IShift[];
  paymentPeriods: IPaymentPeriod[];   // nuevo
  sucursales:     ISucursal[];
  supervisors:    IEmployeeSupervisorOption[];
}
```

## Plan de implementación

1. **Base de datos:** ejecutar el `ALTER TABLE` de `RH.empleados` (columna `id_periodo_pago` + FK) contra la BD, y documentar en `queries.txt` tanto ese `ALTER TABLE` como el `CREATE TABLE [RH].[payment_periods]` (bloque `RECURSOS HUMANOS(EMPLEADOS)`), ya que hoy no está documentado.
2. **`interfaces/rh_catalogs.ts`:** agregar la interfaz `IPaymentPeriod`.
3. **`interfaces/employee.ts`:** agregar `id_periodo_pago` a `IEmployee` y `nombre_periodo_pago` a `IEmployeeRecord`. El sistema sigue compilando en este paso (los consumidores se ajustan en los siguientes).
4. **`app/dashboard/empleados/actions.ts`:**
   - Agregar `e.[id_periodo_pago]` a `EMPLOYEE_SELECT_COLUMNS`.
   - En `getEmployeeById`, agregar `LEFT JOIN [RH].[payment_periods] pp ON pp.[id_payment_period] = e.[id_periodo_pago]` y seleccionar `pp.[description] AS nombre_periodo_pago`, integrándolo al `return` igual que `nombre_turno`.
   - En `getEmployeeCatalogs`, agregar la consulta de `paymentPeriods` (`SELECT [id_payment_period], [clave_sat], [description], [days], [status] FROM [RH].[payment_periods] WHERE [status] = 1 ORDER BY [id_payment_period]`) y añadirla al objeto de retorno.
   - En `buildEmployeeWriteParams`, agregar `id_periodo_pago: input.id_periodo_pago ?? null`.
   - Agregar `[id_periodo_pago]`/`@id_periodo_pago` a las columnas/valores del `INSERT` de `createEmployee` y al `SET` del `UPDATE` de `updateEmployee`.
5. **`EmployeeModal.tsx`:**
   - Agregar `id_periodo_pago: null` a `buildEmptyForm()` y `id_periodo_pago: employee.id_periodo_pago` a `employeeToFormInput()`.
   - En la sección "Información laboral", agregar un `<select name="id_periodo_pago">` junto a "Turno", usando `handleSelectIdChange("id_periodo_pago")` (extendiendo el tipo de campos que acepta esa función), con opción "Sin periodo" y las opciones de `catalogs.paymentPeriods` mostrando `description`.
6. **`EmployeeGeneralInfo.tsx`:** agregar la fila `<InfoRow label="Periodo de pago" value={employee.nombre_periodo_pago || "—"} />` junto a la fila de "Tipo de salario".
7. **Verificación manual:** `npm run build` (o `tsc --noEmit`) para confirmar tipos; luego alta de un empleado nuevo seleccionando un periodo de pago y edición de uno existente, confirmando que el valor se guarda, se recupera y se muestra correctamente en el expediente.

Cada paso deja el sistema en un estado funcional (compilable) al terminar.

## Criterios de aceptación

- [ ] `RH.empleados` tiene la columna `id_periodo_pago` (`tinyint`, `NULL`) con FK a `RH.payment_periods`, documentada con `ALTER TABLE` en `queries.txt`.
- [ ] `RH.payment_periods` queda documentada con `CREATE TABLE` en `queries.txt`.
- [ ] `IPaymentPeriod` existe en `interfaces/rh_catalogs.ts` con los campos `id_payment_period`, `clave_sat`, `description`, `days`, `status`.
- [ ] `IEmployee` declara `id_periodo_pago: number | null`; `IEmployeeRecord` declara `nombre_periodo_pago: string | null`.
- [ ] `getEmployeeCatalogs()` devuelve `paymentPeriods` con los periodos activos (`status = 1`), ordenados por `id_payment_period`.
- [ ] El modal de alta/edición de empleado muestra un `<select>` "Periodo de pago" en la sección "Información laboral", junto a "Turno", con las opciones del catálogo y una opción "Sin periodo".
- [ ] El campo "Periodo de pago" no es obligatorio: se puede guardar/editar un empleado sin seleccionarlo.
- [ ] Al dar de alta un empleado nuevo seleccionando un periodo de pago, y luego abrir su expediente, se muestra la fila "Periodo de pago" con la descripción correspondiente.
- [ ] Al editar un empleado existente, cambiar el periodo de pago persiste correctamente (se refleja tras `router.refresh()`).
- [ ] `EmployeeGeneralInfo.tsx` muestra la fila "Periodo de pago" con `nombre_periodo_pago` o "—" si es `null`.
- [ ] `npm run build` (o `tsc --noEmit`) no reporta errores de tipos relacionados con los campos agregados en ningún archivo del proyecto.

## Decisiones tomadas y descartadas

- **Nueva columna FK en `RH.empleados` en vez de tabla intermedia.** Un empleado tiene un único periodo de pago vigente, no un historial ni múltiples periodos simultáneos, así que una columna simple (`id_periodo_pago`) es suficiente — igual patrón que `id_turno` → `RH.turnos`. Una tabla de relación N:M o con vigencias queda fuera de alcance por no haber sido solicitada.
- **Tipo `smallint` para `id_periodo_pago`** (corregido durante la implementación: la spec asumía `tinyint`, pero el tipo real de `id_payment_period` en la BD es `smallint`), para que la FK sea consistente con el catálogo referenciado.
- **Campo opcional (`NULL`), no obligatorio.** No hay requisito de que todo empleado tenga periodo de pago capturado desde el alta; los empleados existentes quedan con el campo vacío hasta que se edite su registro. Consistente con cómo se maneja `id_turno` (también opcional).
- **Solo se muestra `description` en el `<select>` y en el expediente.** `clave_sat` y `days` son metadatos del catálogo pensados para uso futuro (p.ej. facturación/nómina), pero no se solicitó exponerlos en la UI de empleados en esta spec.
- **Se documenta `RH.payment_periods` en `queries.txt` aunque ya exista en BD.** La tabla fue creada directamente en la BD sin pasar por el flujo de documentación de `queries.txt` (no hay migraciones en este proyecto); se aprovecha esta spec para dejarla documentada, ya que es la primera vez que el catálogo se consume desde código.
- **No se toca `EmployeeHeader.tsx` ni el listado.** Ninguno de los dos muestra hoy datos laborales de este tipo (turno, tipo de salario, etc.), así que agregar periodo de pago ahí sería inconsistente con el resto de esos componentes.
