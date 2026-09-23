# 56 — Nómina: comisión por pacientes atendidos

## Header

- **Estado:** Implementado
- **Depende de:**
  - [52 — Nómina: periodos](52-nomina-periodos.md): `payroll.periods`, el acceso por rol y el patrón de batch con `UPDLOCK, HOLDLOCK`.
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): `payroll.period_employees`, `calculatePayrollPeriod` y la pantalla Procesar.
  - [54 — Nómina: detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y la tarjeta "Percepciones totales".
  - [55 — Empleados: vincular usuarios del sistema](55-empleado-vincular-usuarios.md): `users.id_empleado`, el puente que permite atribuir consultas a un empleado.
- **Modifica base de datos:** Sí. Tabla nueva `payroll.commission_tiers` y dos columnas nuevas en `payroll.period_employees` (`consultas_atendidas`, `importe_comision`).
- **Fecha:** 2026-09-23
- **Objetivo:** Pagar a cada empleado una comisión de monto fijo según el número de consultas que atendieron sus usuarios vinculados dentro del periodo, con los rangos consultas → importe editables desde una pantalla nueva del módulo de Nómina.

La 55 es dependencia dura: sin `users.id_empleado` no hay a quién atribuirle la consulta. La comisión es solo de la nómina **operativa** (`tipo_nomina = 'O'`), así que las filas `'F'` conservan `importe_comision = 0`.

## Alcance

**Incluye:**

- **Base de datos — tabla nueva `payroll.commission_tiers`.** Tramos por empresa (`id_empresa`): `min_consultas`, `max_consultas` (nulo = tramo abierto), `importe`, auditoría. DDL en `queries.txt`, con los cuatro tramos iniciales sembrados (1–10 → $100, 11–25 → $200, 26–35 → $300, 36+ → $500).
- **Base de datos — dos columnas en `payroll.period_employees`:** `consultas_atendidas INT NOT NULL DEFAULT 0` e `importe_comision DECIMAL(12,2) NOT NULL DEFAULT 0`. Parte del mismo snapshot que ya congela el salario usado.
- **Pantalla nueva `/dashboard/nomina/comisiones`** (Server Component), tercera entrada del menú de Nómina, después de Periodos y Procesar. Roles 1 y 4: `proxy.ts` ya cubre todo `/dashboard/nomina`, `navConfig.tsx` ya excluye los roles 2, 3, 5 y 6, y las actions llaman a `assertPayrollAccess()`.
- **CRUD de tramos:** tabla con los tramos ordenados por `min_consultas`, botón "Nuevo tramo", modal de alta/edición y borrado físico por fila. Estado vacío: "No hay tramos de comisión configurados".
- **Validación en servidor con `zod` + revalidación contra la BD** antes de escribir: `min_consultas >= 1`, `max_consultas >= min_consultas` o nulo, `importe >= 0`, **sin solapamiento** con los demás tramos de la empresa y **a lo mucho un tramo abierto**. Los huecos sí se permiten.
- **Conteo de consultas atribuidas.** Una consulta cuenta para un empleado cuando `consultas.id_podologo` es uno de los `users.id_user` vinculados a ese empleado (`users.id_empleado`), con `deleted_at IS NULL`, no cancelada (`cancelada` es nullable y `NULL` cuenta como no cancelada: `ISNULL(cancelada, 0) = 0`), `fecha_fin IS NOT NULL` y `fecha` dentro de `[fecha_inicio, fecha_fin]` del periodo. **Sin filtro de sucursal**: cuentan todas las consultas del usuario, se hayan hecho donde se hayan hecho.
- **Suma por empleado:** si un empleado tiene varios usuarios vinculados, las consultas de todos se suman y se aplica **un solo** tramo al total.
- **Importe fijo por tramo:** el tramo paga su `importe` completo, no por consulta. 0 consultas, ningún tramo aplicable o ningún tramo configurado → `importe_comision = 0`.
- **Solo nómina operativa.** Las filas `tipo_nomina = 'F'` se insertan siempre con `consultas_atendidas = 0` e `importe_comision = 0`.
- **El cálculo vive en SQL**, dentro del mismo batch de `calculatePayrollPeriod` que ya inserta el sueldo base. `lib/payroll/` restata la regla del tramo en TS puro para la UI; si divergen, **el SQL es la fuente de verdad** (misma convención que la spec 53).
- **Pantalla Procesar:** columnas nuevas "Comisión" y "Total percepciones" en `PayrollEmployeesTable`, y las tarjetas de resumen pasan a sumar sueldo + comisión.
- **Detalle del empleado:** `buildPerceptionLines` gana la línea `comision_consultas` — "Comisión por consultas atendidas", con el número de consultas y el tramo aplicado en la descripción. La línea **no aparece** cuando el importe es 0.
- **Documentación:** `docs/nomina.md` gana la sección de comisiones.

**No incluye (fuera de alcance, para specs futuras):**

- **Tramos por sucursal, por puesto o por rol.** Son de la empresa entera.
- **Vigencias o versionado de tramos** (`vigencia_desde`/`vigencia_hasta`). El catálogo es vivo; lo ya calculado queda congelado en el snapshot.
- **Desglose de qué consultas se contaron** (lista de consultas con fecha y paciente).
- **Comisiones por ventas, productos o tratamientos.** Esta spec solo cuenta consultas.
- **Comisión en la nómina fiscal**, y con ello su clave SAT, su tratamiento gravado/exento y el consumo de `payroll.perceptions`.
- **Empleados pagados a pura comisión:** el `CHECK` `salario_diario > 0` se queda, así que sin salario diario operativo el empleado no entra a la nómina y no comisiona (sigue apareciendo en "excluidos").
- **Ajuste manual de la comisión** de un empleado en un periodo.
- **Prorrateo de la comisión** para quien ingresó a media nómina: el tramo se aplica al conteo real, sin proporción.
- **Historial de quién cambió un tramo y cuándo** más allá de las columnas de auditoría de la fila.
- **Recalcular solo la comisión:** si una consulta se cancela después de calcular, se recalcula el periodo completo con "Recalcular", que ya existe.
- **Tope o mínimo de comisión**, acumulados anuales, o comisión por metas distintas al conteo.

## Modelo de datos

**La base de datos cambia:** una tabla nueva y dos columnas en el snapshot.

### Tabla nueva `payroll.commission_tiers`

```sql
-- Spec 56: tramos de comisión por número de consultas atendidas, por empresa.
CREATE TABLE [payroll].[commission_tiers](
    [id_commission_tier] [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]         [int]           NOT NULL,
    [min_consultas]      [int]           NOT NULL,   -- inclusivo
    [max_consultas]      [int]           NULL,       -- inclusivo; NULL = tramo abierto ("36 en adelante")
    [importe]            [decimal](12,2) NOT NULL,   -- monto fijo del tramo, no por consulta
    [created_by]         [int]           NOT NULL,
    [created_at]         [datetime2](0)  NOT NULL,
    [updated_at]         [datetime2](0)  NULL,
 CONSTRAINT [PK_commission_tiers] PRIMARY KEY CLUSTERED ([id_commission_tier] ASC),
 CONSTRAINT [UQ_commission_tiers_min] UNIQUE ([id_empresa], [min_consultas]),
 CONSTRAINT [CK_commission_tiers_rango] CHECK (
     [min_consultas] >= 1
     AND ([max_consultas] IS NULL OR [max_consultas] >= [min_consultas])),
 CONSTRAINT [CK_commission_tiers_importe] CHECK ([importe] >= 0)
) ON [PRIMARY]
GO

-- Semilla: los tramos del requerimiento para la empresa 1.
INSERT INTO [payroll].[commission_tiers]
    ([id_empresa],[min_consultas],[max_consultas],[importe],[created_by],[created_at])
VALUES
    (1,  1, 10,   100.00, 1, '2026-09-23 00:00:00'),
    (1, 11, 25,   200.00, 1, '2026-09-23 00:00:00'),
    (1, 26, 35,   300.00, 1, '2026-09-23 00:00:00'),
    (1, 36, NULL, 500.00, 1, '2026-09-23 00:00:00')
GO
```

`UQ_commission_tiers_min` sirve de red contra dos tramos que empiecen igual, pero **el solapamiento completo se valida en el server action**: un `CHECK` no puede mirar otras filas. Sin FK a `dbo.empresas`: esa tabla no se referencia en ninguna query del repo (solo existe `interfaces/empresas.ts`), así que no la doy por buena; si existe, la FK se agrega después sin tocar código.

### Columnas nuevas en `payroll.period_employees`

```sql
-- Spec 56: comisión por consultas en el snapshot del periodo.
ALTER TABLE [payroll].[period_employees]
    ADD [consultas_atendidas] [int]           NOT NULL CONSTRAINT [DF_period_employees_consultas] DEFAULT (0),
        [importe_comision]    [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_comision]  DEFAULT (0)
GO

ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_comision] CHECK (
        [consultas_atendidas] >= 0 AND [importe_comision] >= 0)
GO
```

Los snapshots ya calculados quedan en `0 / 0` por el `DEFAULT`; se llenan al recalcular el periodo.

### Interfaces

**`interfaces/payroll_commission.ts`** (archivo nuevo):

```ts
export interface ICommissionTier {
  id_commission_tier: number;
  min_consultas:      number;
  max_consultas:      number | null;   // null = tramo abierto
  importe:            number;
}

/** Payload de alta y edición. En edición viaja también el id. */
export interface ICommissionTierInput {
  min_consultas: number;
  max_consultas: number | null;
  importe:       number;
}
```

**`interfaces/payroll_calculation.ts`** (se amplía):

```ts
export interface IPayrollEmployeeRow {
  // … campos actuales …
  consultas_atendidas: number;
  importe_comision:    number;
  total_percepciones:  number;   // importe_salario + importe_comision, calculado en el SELECT
}

export interface IPayrollEmployeeSnapshot {
  // … campos actuales …
  consultas_atendidas: number;
  importe_comision:    number;
}

// totals gana la comisión y el total:
// totals: { employees: number; importeSalario: number; importeComision: number; totalPercepciones: number }
```

### Lógica pura: `lib/payroll/commissionTiers.ts` (archivo nuevo)

```ts
/** Tramo aplicable a un conteo, o null si ninguno lo cubre (hueco, 0 consultas, catálogo vacío). */
export function findCommissionTier(tiers: ICommissionTier[], consultationCount: number): ICommissionTier | null;

/** Importe del tramo aplicable, o 0. Restata en TS la regla que vive en el SQL del cálculo. */
export function calculateCommissionAmount(tiers: ICommissionTier[], consultationCount: number): number;

/** true si el rango [min, max] se traslapa con algún tramo, ignorando `excludeTierId` al editar. */
export function tierRangeOverlaps(
  tiers: ICommissionTier[], min: number, max: number | null, excludeTierId: number | null): boolean;

/** "1 a 10 consultas" | "36 consultas en adelante" — etiqueta compartida por la tabla y el detalle. */
export function formatTierRange(tier: ICommissionTier): string;
```

`tierRangeOverlaps` la usan la UI (para avisar antes de guardar) y el server action (que revalida contra la BD, no contra lo que mandó el cliente).

### Server actions: `app/dashboard/nomina/comisiones/actions.ts` (archivo nuevo)

| Action | Devuelve | Qué hace |
|---|---|---|
| `getCommissionTiers()` | `ICommissionTier[]` | Tramos de la empresa de la sesión, `ORDER BY min_consultas`. |
| `createCommissionTier(input)` | `ActionResult<null>` | Valida con `zod`, revalida solapamiento y tramo abierto único contra la BD, inserta con `created_by` y `created_at = buildDate(new Date())`. |
| `updateCommissionTier(input)` | `ActionResult<null>` | Ídem, excluyéndose a sí mismo del chequeo de solapamiento; escribe `updated_at`. |
| `deleteCommissionTier(id)` | `ActionResult<null>` | `DELETE` físico, acotado por `id_empresa`. |

Las tres escrituras corren en **un solo batch con `BEGIN TRAN` y los tramos de la empresa leídos `WITH (UPDLOCK, HOLDLOCK)`**, igual que `createPayrollPeriod`: validar y escribir en la misma transacción es lo único que impide que dos admins metan tramos traslapados a la vez. Todas llaman a `assertPayrollAccess()` y hacen `revalidatePath("/dashboard/nomina/comisiones")`.

Los schemas `zod` se agregan a `lib/payroll/schemas.ts`, donde ya viven los de periodos:

```ts
export const commissionTierSchema = z.object({
  min_consultas: z.number().int().min(1),
  max_consultas: z.number().int().min(1).nullable(),
  importe:       z.number().min(0),
}).refine(t => t.max_consultas === null || t.max_consultas >= t.min_consultas,
  { message: "El máximo debe ser mayor o igual al mínimo" });
```

### El cálculo, en el batch de `calculatePayrollPeriod`

El `INSERT ... SELECT` de la rama `'O'` gana dos `OUTER APPLY`; la rama `'F'` inserta `0, 0` fijos.

```sql
OUTER APPLY (
    SELECT COUNT(*) AS consultas
      FROM [CentroPodologico].[dbo].[consultas] c
      INNER JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = c.[id_podologo]
     WHERE u.[id_empleado] = e.[id_empleado]
       AND c.[deleted_at] IS NULL
       AND ISNULL(c.[cancelada], 0) = 0   -- nullable: NULL = no cancelada
       AND c.[fecha_fin]  IS NOT NULL
       AND c.[fecha] >= @fecha_inicio
       AND c.[fecha] <  DATEADD(day, 1, @fecha_fin)
) conteo
OUTER APPLY (
    SELECT TOP 1 t.[importe]
      FROM [payroll].[commission_tiers] t
     WHERE t.[id_empresa]    = e.[id_empresa]
       AND t.[min_consultas] <= conteo.consultas
       AND (t.[max_consultas] IS NULL OR t.[max_consultas] >= conteo.consultas)
     ORDER BY t.[min_consultas] DESC
) tramo
```

**Convenciones que esto respeta:**

- `consultas.fecha` es `datetime`, así que el rango es medio abierto (`>= inicio`, `< fecha_fin + 1 día`) para no perder las consultas de la tarde del último día. `@fecha_inicio` y `@fecha_fin` viajan como strings `"YYYY-MM-DD"`, nunca como `Date`.
- Sin condición de sucursal: cuentan todas las consultas del usuario.
- `INNER JOIN users` sin filtrar `status`: si el usuario se desactivó después, las consultas que ya hizo siguen contando.
- `ORDER BY min_consultas DESC` con `TOP 1` resuelve el tramo aun si alguien metiera un solapamiento directo en SQL: gana el de mayor `min`.
- `ISNULL(tramo.importe, 0)` e `ISNULL(conteo.consultas, 0)` cubren el hueco y el catálogo vacío.
- Ninguna query nueva devuelve un `Date`: `created_at` y `updated_at` de los tramos salen con `CONVERT(varchar(19), …, 120)`.

## Plan de implementación

1. **Base de datos.**
   - Ejecutar contra `CentroPodologico` el `CREATE TABLE [payroll].[commission_tiers]`, la semilla de los cuatro tramos, el `ALTER TABLE [payroll].[period_employees]` con las dos columnas y su `CHECK`.
   - Agregar esa misma DDL al final de `queries.txt`, bajo el comentario `-- Spec 56: …`, después del bloque de la spec 55.

   *Verificación:* `SELECT * FROM [payroll].[commission_tiers]` devuelve las cuatro filas ordenadas por `min_consultas`. `SELECT TOP 1 [consultas_atendidas], [importe_comision] FROM [payroll].[period_employees]` devuelve `0, 0` en los snapshots que ya existían. La app sigue funcionando sin cambios de código.

2. **Interfaces, lógica pura y schemas.**
   - `interfaces/payroll_commission.ts` con `ICommissionTier` e `ICommissionTierInput`.
   - `lib/payroll/commissionTiers.ts` con `findCommissionTier`, `calculateCommissionAmount`, `tierRangeOverlaps` y `formatTierRange`.
   - `lib/payroll/schemas.ts`: `commissionTierSchema`.
   - **Sin cambios visibles todavía.**

   *Verificación:* `npx tsc --noEmit` sin errores. Con los cuatro tramos sembrados, `calculateCommissionAmount` devuelve 0 con 0 consultas, 100 con 1 y con 10, 200 con 11, 300 con 35, 500 con 36 y con 400.

3. **Server actions del catálogo de tramos.**
   - `app/dashboard/nomina/comisiones/actions.ts` con `getCommissionTiers`, `createCommissionTier`, `updateCommissionTier` y `deleteCommissionTier`, cada una detrás de `assertPayrollAccess()`, con el batch `BEGIN TRAN` + `UPDLOCK, HOLDLOCK` para las tres escrituras.

   *Verificación:* `npx tsc --noEmit` sin errores. Llamadas manuales: crear un tramo 5–15 cuando ya existe 1–10 devuelve `{ ok: false }`; crear un segundo tramo abierto devuelve `{ ok: false }`; crear 50–60 (hueco respecto de 36+, que ya es abierto) también se rechaza por solapamiento.

4. **Pantalla de tramos, solo lectura.**
   - `app/dashboard/nomina/comisiones/page.tsx` (Server Component): tabla con rango (`formatTierRange`), importe y el estado vacío "No hay tramos de comisión configurados".
   - `navConfig.tsx`: entrada "Comisiones" en el menú de Nómina, después de Procesar, con el mismo `excludeRoles: [2, 3, 5, 6]` que las otras dos.

   *Verificación:* con rol 1 o 4 la pantalla lista los cuatro tramos sembrados. Con rol 2 la entrada no aparece en el menú y `/dashboard/nomina/comisiones` redirige a `/dashboard` por `proxy.ts`.

5. **Alta, edición y borrado de tramos** (usando el skill `frontend-design`).
   - `comisiones/componentes/CommissionTierModal.tsx` (`"use client"`): botón "Nuevo tramo", modal con `min_consultas`, `max_consultas` (con casilla "Sin máximo" que lo deja en `null`) e `importe`; avisa el solapamiento con `tierRangeOverlaps` antes de enviar y muestra el `message` de un `{ ok: false }` en un `role="alert"`.
   - `comisiones/componentes/DeleteCommissionTierButton.tsx` (`"use client"`): borra detrás de un modal de confirmación propio, sin `confirm()` nativo, como `DeletePayrollPeriodButton`.
   - Ambos hacen `router.refresh()`. La página y la tabla se quedan Server Components.

   *Verificación:* crear, editar y borrar un tramo se refleja en la tabla sin recargar a mano. Un rango traslapado se avisa en el modal y el servidor lo rechaza aunque se fuerce la llamada.

6. **Cálculo de la comisión.**
   - `nomina/procesar/actions.ts`: los dos `OUTER APPLY` en la rama `'O'` del `INSERT ... SELECT` de `calculatePayrollPeriod`, y `0, 0` fijos en la rama `'F'`.
   - `getPayrollProcessPage`: `consultas_atendidas`, `importe_comision` y `total_percepciones` en el `SELECT` de las filas, y `importeComision` y `totalPercepciones` en los totales sin filtrar.
   - **Todavía sin cambios en la UI.**

   *Verificación:* calcular un periodo y comparar contra SQL a mano: para un empleado con dos usuarios vinculados, `consultas_atendidas` es la suma de las consultas válidas de ambos en el rango, y `importe_comision` es el importe del tramo que le toca. Un empleado sin usuarios vinculados queda en `0 / 0`. Las filas `'F'` quedan todas en `0 / 0`. Revertir y recalcular reproduce los mismos números.

7. **Pantalla Procesar** (usando el skill `frontend-design`).
   - `PayrollEmployeesTable`: columnas "Comisión" (con el conteo de consultas como texto secundario) y "Total percepciones".
   - `PayrollProcessSummaryCards`: la tarjeta de total pasa a sueldo + comisión, con el desglose visible.
   - Ambos siguen siendo Server Components.

   *Verificación:* el total de las tarjetas es igual a la suma de la columna "Total percepciones" de todos los empleados del tipo. En la vista fiscal la columna "Comisión" muestra $0 en todas las filas.

8. **Detalle por empleado.**
   - `IPayrollEmployeeSnapshot` y la query de `getPayrollEmployeeDetail` traen las dos columnas nuevas.
   - `buildPerceptionLines` gana la línea `comision_consultas`: etiqueta "Comisión por consultas atendidas", descripción `"{N} consultas · tramo {formatTierRange}"`, importe `importe_comision`. **La línea se omite cuando `importe_comision` es 0.**
   - La tarjeta ya itera la lista y suma `amount`, así que `totalPerceptions` sale solo.

   *Verificación:* un empleado con comisión muestra dos líneas y el total es la suma de ambas. Uno sin comisión muestra solo "Sueldo base" y el total no cambia respecto de hoy. Un snapshot viejo (calculado antes de esta spec) sigue mostrando solo el sueldo base.

9. **Documentación.**
   - `docs/nomina.md`: sección "Comisión por consultas (spec 56)" con el criterio de consulta contable, el rango de fechas, la no-condición de sucursal, la suma por empleado, el tramo de importe fijo, que solo aplica a `'O'` y que el catálogo es vivo mientras el snapshot congela.
   - Actualizar la frase del encabezado que hoy dice "Only the base salary is calculated".

   *Verificación:* `npm run build` compila sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Base de datos**

- [x] Existe `payroll.commission_tiers` con `UQ_commission_tiers_min`, `CK_commission_tiers_rango` y `CK_commission_tiers_importe`.
- [x] La tabla nace con los cuatro tramos: 1–10 → $100, 11–25 → $200, 26–35 → $300, 36–∞ → $500.
- [x] `payroll.period_employees` tiene `consultas_atendidas INT NOT NULL DEFAULT 0` e `importe_comision DECIMAL(12,2) NOT NULL DEFAULT 0`.
- [x] Los snapshots calculados antes de esta spec quedaron en `0 / 0` y las pantallas de nómina siguen abriendo sin error.
- [x] Un `INSERT` con `min_consultas = 0` o con `max_consultas < min_consultas` es rechazado por el `CHECK`.
- [x] La DDL y la semilla de la spec están en `queries.txt`.

**Permisos y rutas**

- [ ] Los roles 1 y 4 abren `/dashboard/nomina/comisiones` y ven la entrada en el menú. Con los roles 2, 3, 5 y 6 la entrada no aparece y la URL redirige a `/dashboard`.
- [ ] Las cuatro actions del catálogo devuelven `{ ok: false }` con cualquier otro rol, aunque se llamen directamente.
- [ ] Un tramo solo se lee, edita o borra dentro de la `id_empresa` de la sesión; un `id_commission_tier` de otra empresa devuelve `{ ok: false }`.

**Catálogo de tramos**

- [x] La tabla lista los tramos ordenados por `min_consultas`, con el rango legible ("1 a 10 consultas", "36 consultas en adelante").
- [ ] Sin tramos, la pantalla muestra "No hay tramos de comisión configurados".
- [x] Crear un tramo que se traslapa con otro devuelve `{ ok: false }`, muestra el mensaje en el modal y no escribe en la BD.
- [x] Editar un tramo sin cambiarle el rango **no** se rechaza a sí mismo por solapamiento.
- [x] Crear un segundo tramo con `max_consultas` nulo devuelve `{ ok: false }`.
- [ ] Dejar un hueco (1–10 y 26–35, sin nada entre 11 y 25) **sí** se permite, y un empleado con 15 consultas comisiona $0.
- [x] Un tramo con `importe = 0` se puede guardar.
- [ ] Borrar un tramo lo quita físicamente de la tabla y **no** cambia el `importe_comision` de ningún periodo ya calculado.
- [ ] Editar el importe de un tramo no cambia ningún snapshot existente hasta que se recalcula el periodo.

**Conteo de consultas**

- [x] Una consulta cuenta solo si `deleted_at IS NULL`, no está cancelada (`cancelada` `NULL` o `0`) y `fecha_fin IS NOT NULL`.
- [x] Una consulta con `fecha` a las 23:30 del `fecha_fin` del periodo **sí** cuenta; una del día siguiente a las 00:10 no.
- [ ] Una consulta hecha en una sucursal distinta a la del periodo **sí** cuenta.
- [x] Un empleado con dos usuarios vinculados suma las consultas de ambos y recibe **un solo** tramo (12 + 15 = 27 consultas → $300, no $200 + $200).
- [x] Las consultas de un usuario que después quedó en `status = 0` siguen contando.
- [x] Un empleado sin usuarios vinculados queda en `consultas_atendidas = 0` e `importe_comision = 0`.
- [ ] Una consulta cuyo `id_podologo` apunta a un usuario sin `id_empleado` no se le atribuye a nadie.

**Cálculo y snapshot**

- [x] Con los tramos sembrados: 0 consultas → $0; 1 → $100; 10 → $100; 11 → $200; 25 → $200; 26 → $300; 35 → $300; 36 → $500; 400 → $500.
- [x] Todas las filas con `tipo_nomina = 'F'` se insertan con `consultas_atendidas = 0` e `importe_comision = 0`, aunque el empleado tenga consultas.
- [ ] Con el catálogo de tramos vacío, calcular un periodo funciona y deja todas las comisiones en $0.
- [x] "Recalcular" vuelve a contar las consultas y a resolver el tramo con los datos del momento; "Revertir" borra el snapshot completo, comisión incluida.
- [ ] Cancelar una consulta después de calcular no cambia el snapshot hasta que se recalcula el periodo.
- [ ] Un empleado con `salario_diario = 0` y consultas atendidas sigue sin entrar a la nómina operativa y aparece en "excluidos" (no se agrega una fila solo por su comisión).
- [ ] El importe de la comisión **no** se prorratea para quien ingresó a media nómina.
- [x] `calculateCommissionAmount` en TS y el `OUTER APPLY` del SQL dan el mismo importe para los nueve conteos de arriba.

**Pantalla Procesar**

- [x] La tabla muestra "Comisión" (con el número de consultas) y "Total percepciones" por empleado.
- [x] "Total percepciones" de cada fila es exactamente `importe_salario + importe_comision`.
- [x] El total de las tarjetas de resumen es la suma de "Total percepciones" de **todos** los empleados del tipo, sin importar los filtros de puesto y búsqueda.
- [x] En la vista fiscal la columna "Comisión" muestra $0 en todas las filas.

**Detalle del empleado**

- [x] Un empleado con comisión muestra la línea "Comisión por consultas atendidas" con el conteo y el tramo aplicado, y el total de la tarjeta suma sueldo + comisión.
- [x] Un empleado con `importe_comision = 0` **no** muestra la línea, y su total es igual al sueldo base.
- [x] Un snapshot calculado antes de esta spec muestra solo "Sueldo base".
- [x] En la vista fiscal nunca aparece la línea de comisión.
- [ ] Anterior / Siguiente siguen funcionando igual, sin cambios de orden.

**Técnico**

- [x] `comisiones/page.tsx` y su tabla son Server Components. Solo `CommissionTierModal.tsx` y `DeleteCommissionTierButton.tsx` llevan `"use client"`.
- [x] Todas las queries nuevas usan `db.queryParams`, nunca concatenación de SQL.
- [x] Las tres actions de escritura parsean con `zod` y revalidan contra la BD dentro de la misma transacción que escribe.
- [x] Ninguna query nueva devuelve un `Date` de JS; las fechas del periodo viajan como strings `"YYYY-MM-DD"`.
- [x] `docs/nomina.md` tiene la sección de comisión por consultas y ya no dice que solo se calcula el salario base.
- [x] `npm run build` compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

**Modelo**

- **Sí: dos columnas en `payroll.period_employees`.** Hoy hay un solo concepto nuevo. `buildPerceptionLines` ya está hecho para agregar líneas, así que la spec 53 y la 54 no cambian estructuralmente.
- **No: tabla genérica `payroll.period_employee_perceptions`.** Es el diseño correcto cuando existan cuatro o cinco conceptos, pero hoy obligaría a migrar también el sueldo base y a reescribir el cálculo y el detalle. Es una spec propia, y las dos columnas no la estorban: cuando llegue, se migran.
- **No: reutilizar `RH.empleados.comision` y `tipo_salario`.** Esas columnas modelan un **porcentaje** sobre algo, no un monto fijo por tramo. Meter aquí una semántica distinta en una columna que ya significa otra cosa se paga caro después. Siguen sin consumirse.
- **No: consumir todavía `payroll.perceptions`** (clave SAT, gravado/exento). Eso solo importa cuando se timbre el CFDI de nómina, que no existe.
- **Sí: el snapshot guarda también `consultas_atendidas`,** no solo el importe. Sin el conteo no se puede explicar de dónde salió el monto meses después, y recontar sobre `consultas` daría otro número si algo se canceló.

**Atribución**

- **Sí: la consulta se atribuye vía `users.id_empleado`** (`consultas.id_podologo` → `users` → empleado). Es exactamente el cimiento que la spec 55 dejó puesto para esto.
- **Sí: se suman las consultas de todos los usuarios del empleado y se aplica un solo tramo.** El tramo premia el volumen de trabajo de la persona. Calcular un tramo por cuenta pagaría más a quien tiene dos usuarios por razones administrativas.
- **Sí: no se filtra por sucursal.** El trabajo lo hizo la persona, se haya cubierto donde se haya cubierto. No hay doble pago porque el empleado solo entra a la nómina de su `RH.empleados.id_sucursal`.
- **Sí: `INNER JOIN users` sin filtrar `status`.** Desactivar la cuenta después no borra el trabajo ya hecho. (Vincular sí exige `status = 1`, pero eso es la regla de la spec 55, en otro momento.)

**Reglas del conteo**

- **Sí: solo consultas con `fecha_fin IS NOT NULL`.** La comisión es por paciente **atendido**; una consulta abierta todavía no lo está.
- **Sí: se excluyen las canceladas (`cancelada = 1`; `NULL` cuenta como no cancelada) y `deleted_at IS NOT NULL`.** Una consulta cancelada no se atendió, y una borrada no existe.
- **Sí: el rango es `[fecha_inicio, fecha_fin]` del periodo,** no hasta `fecha_corte`. Es el mismo rango que ya definen los días pagados de la spec 53; usar el corte partiría el periodo en dos criterios distintos.
- **Sí: el rango se escribe medio abierto en SQL** (`>= @fecha_inicio` y `< @fecha_fin + 1 día`). `consultas.fecha` es `datetime`; un `BETWEEN` con fechas sueltas perdería todo lo atendido después de medianoche del último día.
- **Sí: el importe del tramo es fijo, no por consulta.** 10 consultas pagan $100, no $1,000. Es lo que dice el requerimiento.
- **Sí: la comisión no se prorratea por ingreso a media nómina.** Se gana por consultas hechas, no por días trabajados; si alguien entró el día 20 y atendió 12 pacientes, ganó el tramo de 12.

**Catálogo de tramos**

- **Sí: por empresa.** Los criterios de comisión son política de la empresa. Por sucursal multiplicaría las filas a mantener sin que nadie haya pedido que una sucursal pague distinto que otra.
- **No: por puesto o por rol.** Es un eje nuevo entero (qué pasa con quien no tiene puesto configurado, qué gana quien cambia de puesto a media nómina). Si se necesita, va en su propia spec y solo agrega una columna.
- **Sí: catálogo vivo, sin vigencias.** El snapshot ya congela lo pagado, así que editar un tramo solo afecta cálculos futuros. Versionar por fecha agregaría dos columnas, un criterio de selección y una pantalla de historial para resolver un problema que el snapshot ya resuelve.
- **Sí: se permiten huecos.** Prohibirlos obligaría a reordenar toda la tabla para editar un solo tramo, y un hueco tiene una respuesta clara: comisión $0.
- **Sí: se rechazan los solapamientos.** Con dos tramos aplicables el importe dependería del `ORDER BY`, no de una regla. El `TOP 1 ... ORDER BY min_consultas DESC` del SQL es solo la red de seguridad; la regla se impone al guardar.
- **Sí: a lo mucho un tramo abierto.** Dos tramos sin máximo son dos reglas para el infinito, y una de las dos nunca aplicaría.
- **Sí: borrado físico.** El snapshot ya guarda el importe pagado, así que no hay nada que un `status = 0` conserve. Un catálogo de cuatro filas no necesita papelera.
- **Sí: validar dentro de la misma transacción que escribe,** con `UPDLOCK, HOLDLOCK`. Validar antes y escribir después deja abierta la ventana para dos tramos traslapados; es el mismo patrón que la spec 52 ya usa para el consecutivo.

**Dónde vive el cálculo**

- **Sí: en SQL, dentro del batch de `calculatePayrollPeriod`.** El sueldo base ya se calcula ahí; partir la nómina en "esto en SQL y esto en TS" haría que un cálculo pudiera quedar a medias.
- **Sí: `lib/payroll/commissionTiers.ts` restata la regla en TS puro,** para la UI y para poder razonarla sin abrir el SQL, **con el SQL como fuente de verdad** si divergen. Es la convención que fijó la spec 53 con `salaryCalculation.ts`.

**Alcance y UI**

- **Sí: solo nómina operativa.** La fiscal es lo que se declara; meterle una percepción cambia la base gravable, y no existe todavía cálculo de ISR ni IMSS ni clave SAT para el concepto. Cuando exista, entra con su spec.
- **Sí: la línea de comisión se omite cuando el importe es 0.** Una línea de $0 en el recibo invita a preguntar por qué está ahí. El conteo sí queda guardado en el snapshot.
- **Sí: columnas "Comisión" y "Total percepciones" en Procesar.** Sin ellas el total de la pantalla dejaría de ser lo que se paga, que es justo para lo que se usa esa pantalla.
- **No: desglose de qué consultas se contaron.** Es una pantalla propia con su paginación y sus filtros, y no hace falta para pagar. El conteo guardado permite reconstruirlo después si se pide.
- **No: relajar el `CHECK` `salario_diario > 0` para empleados a pura comisión.** Cambia quién entra a la nómina, que es la regla central de la spec 53. Si aparece gente pagada solo a comisión, se atiende con el requisito real enfrente.
- **No: ajuste manual de la comisión de un empleado.** Abre la puerta a editar el snapshot a mano, que hoy es inmutable entre cálculos. Es un cambio de modelo, no un campo más.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **Doble pago si un empleado cambia de sucursal a media nómina.** Como el conteo no filtra por sucursal, si el periodo de su sucursal anterior ya se calculó y el de la nueva también cubre esas fechas, las mismas consultas se pagan dos veces. | El caso exige que las dos sucursales tengan periodos traslapados de la misma frecuencia **y** que el empleado se mueva entre el cálculo de uno y otro. Queda documentado en `docs/nomina.md` con la instrucción de revertir y recalcular el periodo de la sucursal anterior. Un filtro por sucursal cerraría esto, pero rompería la regla que sí se pidió: que cuenten las consultas se hayan hecho donde se hayan hecho. |
| **Un usuario vinculado al empleado equivocado le paga comisión a quien no la trabajó.** | El vínculo se administra en la ficha del empleado (spec 55), donde se ve completo, y el conteo se rehace en cada "Recalcular". La columna "Empleado" del listado de usuarios permite auditar de quién es cada cuenta antes de calcular. |
| **El `COUNT` sobre `dbo.consultas` por empleado hace lento el cálculo** conforme crece la tabla. | Los `OUTER APPLY` corren una vez por empleado del periodo (decenas, no miles). Si tarda, se agrega `CREATE NONCLUSTERED INDEX [IX_consultas_podologo_fecha] ON [dbo].[consultas] ([id_podologo], [fecha]) INCLUDE ([cancelada], [fecha_fin], [deleted_at])`, que no cambia una sola línea de código. |
| **Se edita un tramo esperando corregir una nómina ya calculada** y no pasa nada. | El snapshot es lo que se paga: la pantalla de tramos y `docs/nomina.md` dicen que el cambio aplica al siguiente cálculo y que para aplicarlo hay que "Recalcular". Hay un criterio de aceptación dedicado. |
| **Dos admins guardan tramos traslapados al mismo tiempo** desde pestañas distintas. | La validación y el `INSERT`/`UPDATE` van en el mismo batch con `BEGIN TRAN` y los tramos leídos `WITH (UPDLOCK, HOLDLOCK)`. El segundo espera y se rechaza. `UQ_commission_tiers_min` es la última barrera. |
| **Se pierden las consultas del último día del periodo** por comparar un `datetime` contra una fecha sin hora. | El rango es medio abierto (`>= @fecha_inicio`, `< DATEADD(day, 1, @fecha_fin)`), y hay un criterio de aceptación con una consulta a las 23:30 del último día. |
| **Los snapshots calculados antes de esta spec se leen como "no comisionó"** en lugar de "no se había calculado". | Quedan en `0 / 0` por el `DEFAULT` y el detalle simplemente no muestra la línea, igual que hoy. Recalcular el periodo los llena. Queda dicho en `docs/nomina.md`. |
| **Alguien mete tramos traslapados directo en SQL**, saltándose el server action. | El `TOP 1 ... ORDER BY [min_consultas] DESC` hace el resultado determinista: gana el tramo de mayor mínimo. No se cae ni devuelve importes al azar. |
| **Un podólogo pagado solo a comisión no cobra nada**, porque sin `salario_diario` no entra a la nómina. | Aparece en el aviso de "excluidos" de Procesar, que ya existe, así que es visible y no silencioso. Queda explícito en el alcance y en las decisiones que resolverlo es otra spec. |

## Qué **no** incluye esta spec

- Tramos por sucursal, por puesto o por rol.
- Vigencias o versionado de los tramos.
- Comisión en la nómina fiscal, su clave SAT y el consumo de `payroll.perceptions`.
- Comisiones por ventas, productos o tratamientos.
- Desglose de qué consultas se contaron.
- Empleados pagados a pura comisión (el `CHECK` `salario_diario > 0` se queda).
- Ajuste manual de la comisión de un empleado en un periodo.
- Prorrateo de la comisión por ingreso a media nómina.
- Topes, mínimos, acumulados anuales o metas distintas al conteo.
- Recalcular solo la comisión sin recalcular el periodo completo.

Cada uno de esos, si se hace, va en su propia spec.
