# 58 — Nómina: comisión por venta de productos

## Header

- **Estado:** Implementado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): `payroll.period_employees`, `calculatePayrollPeriod` y la pantalla Procesar.
  - [54 — Nómina: detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y la tarjeta "Percepciones totales".
  - [55 — Empleados: vincular usuarios del sistema](55-empleado-vincular-usuarios.md): `users.id_empleado`, el puente para atribuirle la venta a un empleado.
  - [56 — Nómina: comisión por pacientes atendidos](56-nomina-comision-consultas.md): fecha y filtros de consulta (`consultas.fecha`, `deleted_at`, `cancelada`), sin filtro de sucursal ni de `status` del usuario.
  - [57 — Nómina: comisión por tratamientos de onicomicosis](57-nomina-comision-tratamientos-onicomicosis.md): el patrón de desglose con candado anti doble pago (`period_employee_treatments`) y las columnas de comisión en Procesar.
- **Modifica base de datos:** Sí. Una tabla nueva (`payroll.period_employee_product_sales`) y dos columnas nuevas en `payroll.period_employees`.
- **Fecha:** 2026-09-24
- **Objetivo:** Pagar a cada empleado, en la nómina operativa, el `bono_venta` de cada pieza que sus usuarios vinculados vendieron dentro del periodo, en consultas o en ventas directas, guardando el desglose por línea y pagando cada línea una sola vez.

Las dos fuentes son `consulta_productos` (atribuida al `id_podologo` de la consulta) y `VentasDetalle` (atribuida al `id_usuario` que capturó la venta). La comisión de cada línea es `cantidad × bono_venta`. El bono se toma vigente al calcular y se congela en el desglose.

Reglas de origen: `references/docs/comision_ventas.md`. Esta spec se aparta de ese documento en un punto: para las consultas, el periodo se decide con `consultas.fecha`, no con `consultas.created_at`, para coincidir con la spec 56.

## Alcance

**Incluye:**

- **Base de datos: desglose y candado anti doble pago.** Tabla nueva `payroll.period_employee_product_sales` con una fila por línea vendida que se pagó. Cada fila guarda:
  - el renglón de `period_employees` al que pertenece;
  - el origen (`'C'` consulta o `'V'` venta directa);
  - el id de la línea de origen (`id_consulta_producto` o `id_venta_detalle`) y el folio (`id_consulta` o `id_venta`);
  - el producto, la fecha de venta, la cantidad, el `bono_venta` congelado y la comisión de la línea.

  Lleva un índice único por línea de origen, así que **una línea se paga una sola vez en toda la historia**, sin importar periodo, frecuencia ni sucursal.
- **Base de datos: dos columnas en `payroll.period_employees`.**
  - `piezas_vendidas DECIMAL(18,4) NOT NULL DEFAULT 0`
  - `importe_comision_productos DECIMAL(12,2) NOT NULL DEFAULT 0`
- **Atribución.**
  - Consultas: `consultas.id_podologo` es uno de los `users.id_user` vinculados al empleado (`users.id_empleado`).
  - Ventas directas: lo mismo con `Ventas.id_usuario`.
  - Se suman las líneas de todos los usuarios vinculados. No hay filtro de sucursal ni de `status` del usuario, igual que en las specs 56 y 57.
- **Qué línea de consulta cuenta:**
  - `consulta_productos.status = 1`;
  - la consulta tiene `deleted_at IS NULL` y `ISNULL(cancelada, 0) = 0`;
  - `consultas.fecha` está en `[fecha_inicio, fecha_fin + 1 día)`.
  - **No** se exige `fecha_fin IS NOT NULL`.
- **Qué línea de venta directa cuenta:** `Ventas.status = 1` y `Ventas.created_at` en `[fecha_inicio, fecha_fin + 1 día)`.
- **Para las dos fuentes:**
  - el producto tiene `bono_venta > 0`, y las líneas con bono `NULL` o 0 no entran al desglose ni se bloquean;
  - la línea no aparece ya en `payroll.period_employee_product_sales`;
  - `Products.status` se ignora, así que un producto desactivado después de venderse sigue pagando.
- **Importe:**
  - Cada línea paga `ROUND(cantidad × bono_venta, 2)`.
  - El bono es el vigente en `inventory.Products` al calcular.
  - En productos con `split = 1`, `cantidad` está en piezas, así que el bono se paga por pieza.
  - El total del empleado es la suma de sus líneas.
  - `piezas_vendidas` es la suma de `cantidad` de esas mismas líneas.
- **Solo nómina operativa.** Las filas `'F'` quedan en `0 / 0` y no generan desglose.
- **El cálculo vive en SQL,** dentro del batch de `calculatePayrollPeriod`. Un archivo nuevo en `lib/payroll/` restata la regla en TS puro; si divergen, **el SQL es la fuente de verdad**.
- **Sin descuento retroactivo.** Cancelar una venta, cancelar la consulta, inactivar la línea o cambiar la cantidad después de que un periodo la pagó no cambia ese periodo. Solo lo corrige un "Recalcular" de ese mismo periodo.
- **Pantalla Procesar:**
  - columna nueva "Com. Ventas", con las piezas vendidas como texto secundario;
  - "Total percepciones", las tarjetas de resumen y el pie de tabla suman sueldo + las tres comisiones.
- **Detalle del empleado:**
  - `buildPerceptionLines` gana la línea `comision_productos`, "Comisión por venta de productos", con la descripción "N piezas vendidas". Se omite cuando el importe es 0.
  - Debajo va una lista de solo lectura **agrupada por producto**: producto, piezas, bono y comisión. No tiene enlaces. Es un Server Component, igual que `PayrollPaidTreatmentsList`.
- **Documentación:** `docs/nomina.md` gana la sección "Comisión por venta de productos (spec 58)".

**No incluye (fuera de alcance, para specs futuras):**

- Descuento o reverso de una comisión ya pagada cuando la venta o la consulta se cancela, o la línea cambia, después.
- Comisión en la nómina fiscal, su clave SAT y el consumo de `payroll.perceptions`.
- Bono histórico (el que tenía el producto el día de la venta) o vigencias del bono.
- Bono distinto por sucursal, puesto o rol, y comisión como porcentaje del precio.
- Atribuir la venta de una consulta al usuario que agregó el producto en lugar del `id_podologo`.
- Vista línea por línea del desglose, enlaces a la consulta o a la venta, y un reporte global de líneas pagadas o pendientes.
- Editar el bono desde nómina: se sigue editando en el catálogo de productos (spec 37).
- Ajuste manual de la comisión, liberar a mano una línea ya pagada y recalcular solo esta comisión sin el periodo completo.

Tres consecuencias de estas reglas, incluidas a propósito:

- **Quien vendió y no está en la nómina operativa de ese periodo** (por ejemplo, por no tener salario operativo) no cobra la línea. La línea tampoco queda marcada como pagada. Como su fecha ya no cae en ningún periodo futuro, en la práctica nunca comisiona.
- **Si cambia `bono_venta`**, las líneas ya pagadas conservan el bono congelado. Recalcular un periodo usa el bono vigente en ese momento.
- **Una misma consulta** puede generar comisión por consultas (spec 56) y por productos en el mismo periodo, porque las dos usan `consultas.fecha`.

## Modelo de datos

**La base de datos cambia:** una tabla nueva y dos columnas en el snapshot.

### Tabla nueva `payroll.period_employee_product_sales`

```sql
-- Spec 58: líneas de venta pagadas por renglón de nómina; UNIQUE(origen, id_linea_origen) impide el doble pago.
CREATE TABLE [payroll].[period_employee_product_sales](
    [id_period_employee_product_sale] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]  [int]           NOT NULL,
    [origen]              [char](1)       NOT NULL,   -- 'C' consulta_productos, 'V' VentasDetalle
    [id_linea_origen]     [int]           NOT NULL,   -- id_consulta_producto o id_venta_detalle
    [id_documento_origen] [int]           NOT NULL,   -- id_consulta o id_venta
    [id_producto]         [int]           NOT NULL,   -- inventory.Products.id_product
    [fecha_venta]         [datetime2](0)  NOT NULL,   -- consultas.fecha o Ventas.created_at
    [cantidad]            [decimal](18,4) NOT NULL,
    [bono_venta]          [decimal](10,2) NOT NULL,   -- congelado al calcular
    [importe_comision]    [decimal](12,2) NOT NULL,   -- ROUND(cantidad × bono_venta, 2)
 CONSTRAINT [PK_period_employee_product_sales] PRIMARY KEY CLUSTERED ([id_period_employee_product_sale] ASC),
 CONSTRAINT [UQ_period_employee_product_sales_linea] UNIQUE ([origen], [id_linea_origen]),
 CONSTRAINT [FK_period_employee_product_sales_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_product_sales_valores] CHECK (
     [origen] IN ('C', 'V') AND [cantidad] > 0 AND [bono_venta] > 0 AND [importe_comision] >= 0)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_product_sales_period_employee]
    ON [payroll].[period_employee_product_sales] ([id_period_employee])
GO
```

- Se usa una sola columna `id_linea_origen` más `origen`, en lugar de dos columnas nullable. Así el candado es un `UNIQUE` normal y no hace falta un índice filtrado, que exige opciones `SET` específicas en cada conexión que inserta.
- Por el `ON DELETE CASCADE`, "Recalcular" y "Revertir" liberan las líneas del periodo con el mismo `DELETE` de `period_employees` que ya ejecutan.
- No hay FK a `consulta_productos`, `VentasDetalle` ni `Products`. El desglose debe sobrevivir aunque la línea de consulta se borre físicamente (`deleteConsultaProducto` hace un `DELETE`). Además, el esquema `payroll` no queda atado a tablas de `dbo`.

### Columnas nuevas en `payroll.period_employees`

```sql
-- Spec 58: comisión por venta de productos en el snapshot.
ALTER TABLE [payroll].[period_employees]
    ADD [piezas_vendidas]            [decimal](18,4) NOT NULL CONSTRAINT [DF_period_employees_piezas_vendidas]  DEFAULT (0),
        [importe_comision_productos] [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_comision_prod]    DEFAULT (0)
GO

ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_comision_prod] CHECK (
        [piezas_vendidas] >= 0 AND [importe_comision_productos] >= 0)
GO
```

Los snapshots calculados antes de esta spec quedan en `0 / 0` por los defaults hasta que se recalculen.

### Interfaces

**`interfaces/payroll_product_sales_commission.ts`** (archivo nuevo):

```ts
/** Una fila de la lista del detalle: las líneas pagadas de un producto, agrupadas. */
export interface IPayrollSoldProduct {
  id_producto:      number;
  nombre_producto:  string;
  piezas:           number;   // SUM(cantidad)
  bono_venta:       number;   // congelado
  importe_comision: number;   // SUM(importe_comision) de las líneas, ya redondeadas
}
```

**`interfaces/payroll_calculation.ts`** (se amplía):

```ts
export interface IPayrollEmployeeRow {
  // … campos actuales …
  piezas_vendidas:            number;
  importe_comision_productos: number;
  total_percepciones:         number;   // + importe_comision_productos
}

export interface IPayrollEmployeeSnapshot {
  // … campos actuales …
  piezas_vendidas:            number;
  importe_comision_productos: number;
}

// totals gana: importeComisionProductos
// IPayrollEmployeeDetail gana: soldProducts: IPayrollSoldProduct[]   ([] en fiscal o sin ventas pagadas)
```

### Lógica pura: `lib/payroll/productSalesCommission.ts` (archivo nuevo)

```ts
/** round(quantity × saleBonus, 2): comisión de una línea vendida. */
export function calculateProductSaleLineCommission(quantity: number, saleBonus: number): number;

/** "12 piezas vendidas" / "1 pieza vendida"; cantidades con decimales se muestran sin ceros de más. */
export function describeProductSalesCommission(piecesSold: number): string;
```

Restata la regla del SQL. **Si divergen, manda el SQL.**

### El cálculo, en el batch de `calculatePayrollPeriod`

Orden dentro del batch, después de armar `#liquidated` (spec 57):

1. `DELETE period_employees` del periodo. Ya existe, y el cascade libera también sus líneas de venta.
2. **Líneas vendidas en el rango**, a una tabla temporal `#product_sales`:

```sql
SELECT u.[id_empleado], CAST('C' AS char(1)) AS origen,
       cp.[id_consulta_producto] AS id_linea_origen, c.[id_consulta] AS id_documento_origen,
       cp.[id_producto], c.[fecha] AS fecha_venta,
       CAST(cp.[cantidad] AS decimal(18,4)) AS cantidad, p.[bono_venta]
  INTO #product_sales
  FROM [CentroPodologico].[dbo].[consulta_productos] cp
  JOIN [CentroPodologico].[dbo].[consultas] c       ON c.[id_consulta] = cp.[id_consulta]
  JOIN [CentroPodologico].[dbo].[users] u           ON u.[id_user]     = c.[id_podologo]
  JOIN [CentroPodologico].[inventory].[Products] p  ON p.[id_product]  = cp.[id_producto]
 WHERE u.[id_empleado] IS NOT NULL
   AND cp.[status] = 1
   AND c.[deleted_at] IS NULL
   AND ISNULL(c.[cancelada], 0) = 0
   AND c.[fecha] >= @fecha_inicio AND c.[fecha] < DATEADD(day, 1, @fecha_fin)
   AND p.[bono_venta] > 0
   AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_product_sales] ps
                    WHERE ps.[origen] = 'C' AND ps.[id_linea_origen] = cp.[id_consulta_producto])
UNION ALL
SELECT u.[id_empleado], 'V', vd.[id_venta_detalle], v.[id_venta],
       vd.[id_producto], v.[created_at], vd.[cantidad], p.[bono_venta]
  FROM [CentroPodologico].[dbo].[VentasDetalle] vd
  JOIN [CentroPodologico].[dbo].[Ventas] v          ON v.[id_venta]   = vd.[id_venta]
  JOIN [CentroPodologico].[dbo].[users] u           ON u.[id_user]    = v.[id_usuario]
  JOIN [CentroPodologico].[inventory].[Products] p  ON p.[id_product] = vd.[id_producto]
 WHERE u.[id_empleado] IS NOT NULL
   AND v.[status] = 1
   AND v.[created_at] >= @fecha_inicio AND v.[created_at] < DATEADD(day, 1, @fecha_fin)
   AND p.[bono_venta] > 0
   AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_product_sales] ps
                    WHERE ps.[origen] = 'V' AND ps.[id_linea_origen] = vd.[id_venta_detalle]);
```

3. El `INSERT ... SELECT` de `period_employees` gana un `OUTER APPLY` sobre `#product_sales` por `id_empleado`, que solo aplica cuando `tipo_nomina = 'O'`. Llena `piezas_vendidas = SUM(cantidad)` e `importe_comision_productos = SUM(ROUND(cantidad × bono_venta, 2))`. Las filas `'F'` quedan en `0, 0`.
4. `INSERT INTO period_employee_product_sales` desde `#product_sales`, con `JOIN period_employees` por `id_period`, `id_empleado` y `tipo_nomina = 'O'`. La línea de un empleado que no entró a la nómina operativa no se inserta, así que queda libre.

**Convenciones que esto respeta:**

- El conteo del snapshot y el desglose salen del mismo `#product_sales`, así que no pueden diferir.
- El `NOT EXISTS` sobre toda la tabla basta, porque el paso 1 ya liberó las líneas de este mismo periodo. `UQ_period_employee_product_sales_linea` es la última barrera: `describePayrollCalculationError` lo traduce a "Otro cálculo tomó algunas de estas ventas al mismo tiempo. Intenta de nuevo."
- El rango es medio abierto sobre columnas `datetime`, y las fechas del periodo viajan como strings `"YYYY-MM-DD"`.

### Lectura

- `getPayrollProcessPage` agrega `piezas_vendidas` e `importe_comision_productos` al SELECT, suma la comisión a `total_percepciones` y agrega `importeComisionProductos` a `totals`.
- `getPayrollEmployeeDetail` agrega `piezas_vendidas` e `importe_comision_productos` al snapshot. También arma `soldProducts` con un `GROUP BY ps.id_producto, p.name, ps.bono_venta` sobre el desglose del renglón `'O'`, con `LEFT JOIN inventory.Products` para el nombre. El orden es `SUM(importe_comision) DESC` y luego `nombre_producto`.

## Plan de implementación

1. **Base de datos.**
   - Ejecutar contra `CentroPodologico`:
     - el `CREATE TABLE [payroll].[period_employee_product_sales]` con su índice;
     - el `ALTER TABLE [payroll].[period_employees]` con las dos columnas y su `CHECK`.
   - Agregar la misma DDL al final de `queries.txt`, bajo `-- Spec 58: …` y después del bloque de la spec 57.

   *Verificación:*
   - Los snapshots existentes quedan en `0 / 0` en las columnas nuevas.
   - Un `INSERT` de prueba con el mismo `('V', id_linea_origen)` dos veces falla por `UQ_period_employee_product_sales_linea`.
   - Un `INSERT` con `origen = 'X'` o `bono_venta = 0` falla por el `CHECK`.
   - La app sigue funcionando sin cambios de código.

2. **Interfaces y lógica pura.**
   - Archivo nuevo `interfaces/payroll_product_sales_commission.ts` con `IPayrollSoldProduct`.
   - `interfaces/payroll_calculation.ts` ampliado. Los campos nuevos quedan opcionales solo si hace falta que compile, y se vuelven obligatorios en los pasos 3 y 5.
   - `lib/payroll/productSalesCommission.ts` con `calculateProductSaleLineCommission` y `describeProductSalesCommission`.
   - **Sin cambios visibles.**

   *Verificación:*
   - `npx tsc --noEmit` sin errores.
   - `calculateProductSaleLineCommission(3, 25.5)` da 76.5.
   - `calculateProductSaleLineCommission(0.3333, 10)` da 3.33.
   - `describeProductSalesCommission(1)` da "1 pieza vendida".
   - `describeProductSalesCommission(12)` da "12 piezas vendidas".
   - `describeProductSalesCommission(2.5)` da "2.5 piezas vendidas".

3. **Cálculo de la comisión.**
   - En `calculatePayrollPeriod` (`nomina/procesar/actions.ts`):
     - el paso `#product_sales`, después de `#liquidated`;
     - las dos columnas nuevas en el `INSERT ... SELECT`, con `0, 0` en `'F'`;
     - el `INSERT INTO period_employee_product_sales`.
   - `describePayrollCalculationError` traduce la violación de `UQ_period_employee_product_sales_linea` a "Otro cálculo tomó algunas de estas ventas al mismo tiempo. Intenta de nuevo."
   - En `getPayrollProcessPage`:
     - las filas traen `piezas_vendidas` e `importe_comision_productos`, y `total_percepciones` suma cuatro conceptos;
     - los totales traen `importeComisionProductos`.
   - `revertPayrollCalculation` **no cambia**: el cascade libera las líneas.
   - **Todavía sin cambios en la UI.**

   *Verificación:* calcular un periodo y comparar contra SQL hecho a mano.
   - Un empleado con una venta directa de 2 piezas (bono $30) y una consulta con 1 pieza (bono $50) queda con `3 / 110.00` y dos filas de desglose, una `'V'` y una `'C'`.
   - No aparecen:
     - una línea de un producto con `bono_venta` `NULL` o 0;
     - una venta con `status = 0`;
     - una consulta con `cancelada = 1` o `deleted_at` no nulo;
     - una línea de consulta con `status = 0`.
   - Sí aparece una consulta con `fecha_fin` nula.
   - Una línea ya pagada en otro periodo no aparece.
   - Un empleado con dos usuarios vinculados suma las líneas de los dos.
   - "Revertir" deja `period_employee_product_sales` sin filas de ese periodo.
   - "Recalcular" reproduce los mismos números.

4. **Pantalla Procesar** (usando el skill `frontend-design`).
   - `PayrollEmployeesTable`:
     - columna nueva "Com. Ventas", con las piezas vendidas como texto secundario, después de "Com. onicomicosis";
     - "Total percepciones" con los cuatro conceptos.
   - `PayrollProcessSummaryCards`: el total suma sueldo + las tres comisiones y muestra el desglose de los cuatro conceptos.
   - Ambos siguen siendo Server Components.

   *Verificación:*
   - El total de las tarjetas es igual a la suma de "Total percepciones" de todas las filas del tipo.
   - En fiscal, las tres columnas de comisión muestran $0.

5. **Detalle del empleado** (usando el skill `frontend-design` para la lista).
   - En `getPayrollEmployeeDetail`:
     - trae las dos columnas nuevas del snapshot;
     - trae `soldProducts` agrupado por producto y bono, según la sección "Lectura". En fiscal es `[]`.
   - `buildPerceptionLines` gana la línea `comision_productos`, "Comisión por venta de productos", con la descripción de `describeProductSalesCommission`. Se omite cuando el importe es 0.
   - Componente nuevo `procesar/[id_empleado]/componentes/PayrollSoldProductsList.tsx` (Server Component):
     - columnas: producto, piezas, bono y comisión, más una fila de total;
     - va debajo de la tarjeta de percepciones y de `PayrollPaidTreatmentsList`;
     - no tiene enlaces y no se muestra si la lista está vacía.

   *Verificación:*
   - Un empleado con ventas muestra la línea "N piezas vendidas".
   - La suma de la columna "Comisión" de la lista es igual al importe de esa línea.
   - El total de la tarjeta suma los cuatro conceptos.
   - Un snapshot viejo se ve igual que hoy.

6. **Documentación.**
   - En `docs/nomina.md`:
     - sección nueva "Comisión por venta de productos (spec 58)" con las fuentes, la atribución, los filtros, la regla de `bono_venta`, el candado de pago único, el cascade y la ausencia de descuento retroactivo;
     - agregar `period_employee_product_sales` a la lista de tablas del esquema;
     - actualizar la frase del encabezado que enumera los conceptos calculados.

   *Verificación:* `npm run build` compila sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Base de datos**

- [ ] Existe `payroll.period_employee_product_sales` con su PK, `UNIQUE (origen, id_linea_origen)`, FK con `ON DELETE CASCADE` a `period_employees`, `CHECK` e índice por `id_period_employee`.
- [ ] `payroll.period_employees` tiene `piezas_vendidas` e `importe_comision_productos`, las dos `NOT NULL DEFAULT 0`.
- [ ] Insertar dos veces la misma `(origen, id_linea_origen)` falla por el `UNIQUE`.
- [ ] Un `INSERT` con `origen` distinto de `'C'` o `'V'`, `cantidad <= 0` o `bono_venta <= 0` es rechazado por el `CHECK`.
- [ ] La DDL está al final de `queries.txt`, bajo `-- Spec 58`.

**Qué cuenta**

- [ ] Una línea de `VentasDetalle` cuenta cuando `Ventas.id_usuario` está vinculado al empleado, `Ventas.status = 1` y `Ventas.created_at` cae en el periodo.
- [ ] Una línea de `consulta_productos` cuenta cuando `consultas.id_podologo` está vinculado al empleado, `cp.status = 1`, `deleted_at IS NULL`, `ISNULL(cancelada, 0) = 0` y `consultas.fecha` cae en el periodo.
- [ ] Una consulta con `fecha_fin` nula que cumple lo anterior sí cuenta.
- [ ] No cuentan:
  - una venta con `status = 0`;
  - una consulta cancelada;
  - una consulta borrada;
  - una línea de consulta con `status = 0`.
- [ ] Una línea cuyo producto tiene `bono_venta` `NULL` o 0 no cuenta y no queda en el desglose.
- [ ] Una línea cuyo producto tiene `Products.status = 0` y bono `> 0` sí cuenta.
- [ ] Una venta del último día del periodo a las 23:59 cuenta. Una del día siguiente a las 00:00 no.
- [ ] Un empleado con dos usuarios vinculados suma las líneas de ambos.
- [ ] Las ventas de un usuario cuentan sin importar la sucursal donde se hicieron ni el `status` actual del usuario.

**Importe y snapshot**

- [ ] Cada fila del desglose tiene `importe_comision = ROUND(cantidad × bono_venta, 2)`, con el `bono_venta` vigente al calcular.
- [ ] En la fila `'O'`, `importe_comision_productos` es la suma de `importe_comision` de su desglose y `piezas_vendidas` es la suma de su `cantidad`.
- [ ] Las filas `'F'` tienen `piezas_vendidas = 0`, `importe_comision_productos = 0` y ninguna fila de desglose.
- [ ] Un empleado que vendió pero no entró a la nómina operativa no tiene filas de desglose, y sus líneas siguen libres.
- [ ] Cambiar el `bono_venta` de un producto después de calcular no cambia el snapshot ni el desglose hasta que se recalcule.

**Pago único y transiciones**

- [ ] Una línea pagada en un periodo no aparece en otro periodo cuyo rango también la incluya.
- [ ] "Revertir" borra el desglose del periodo, y esas líneas pueden volver a pagarse.
- [ ] "Recalcular" sin cambios en los datos reproduce los mismos importes y el mismo número de filas de desglose.
- [ ] Cancelar una venta ya pagada no cambia el periodo que la pagó. Un "Recalcular" de ese periodo la excluye.
- [ ] Una violación de `UQ_period_employee_product_sales_linea` muestra "Otro cálculo tomó algunas de estas ventas al mismo tiempo. Intenta de nuevo." y no un error 500.

**Pantalla Procesar**

- [ ] La tabla muestra la columna "Com. Ventas", con el importe y las piezas vendidas como texto secundario.
- [ ] "Total percepciones" de cada fila es igual a sueldo + com. consultas + com. onicomicosis + com. ventas.
- [ ] El total de las tarjetas de resumen y el pie de tabla es igual a la suma de "Total percepciones" de todas las filas del tipo, sin aplicar los filtros de puesto ni de búsqueda.
- [ ] En fiscal, "Com. Ventas" muestra $0 en todas las filas.
- [ ] `PayrollEmployeesTable` y `PayrollProcessSummaryCards` siguen sin `"use client"`.

**Detalle del empleado**

- [ ] Con comisión `> 0`, la tarjeta "Percepciones totales" muestra "Comisión por venta de productos" con "N piezas vendidas" y su importe.
- [ ] Con comisión 0, esa línea no aparece.
- [ ] La lista agrupada muestra una fila por producto con piezas, bono y comisión, y no tiene enlaces.
- [ ] La suma de la columna "Comisión" de la lista es igual al importe de la línea `comision_productos`.
- [ ] Sin ventas pagadas, o en fiscal, la lista no se muestra.
- [ ] `PayrollSoldProductsList` no tiene `"use client"`.
- [ ] Un snapshot calculado antes de esta spec se muestra igual que antes.

**Código y documentación**

- [ ] `lib/payroll/productSalesCommission.ts` existe con `calculateProductSaleLineCommission` y `describeProductSalesCommission`.
- [ ] `docs/nomina.md` tiene la sección "Comisión por venta de productos (spec 58)" y menciona `period_employee_product_sales` en la lista de tablas.
- [ ] `npx tsc --noEmit` y `npm run build` terminan sin errores.

## Decisiones tomadas y descartadas

- **Sí: `consultas.fecha` para decidir el periodo de las ventas en consulta.** Es la misma fecha que usa la spec 56, así que una consulta cae en el mismo periodo para las dos comisiones.
- **No: `consultas.created_at`, como pide `references/docs/comision_ventas.md`.** Difiere de `fecha` cuando la consulta se captura después, desde el expediente. Una misma consulta quedaría en un periodo para una comisión y en otro periodo para la otra.
- **Sí: desglose por línea en `payroll.period_employee_product_sales`.** Permite auditar de dónde sale cada peso, congela el bono usado y sostiene el candado de pago único. Sigue el patrón de `period_employee_treatments` (spec 57).
- **No: solo totales en `period_employees`.** Sin la línea no hay manera de auditar ni de bloquear el doble pago.
- **No: armar el desglose en vivo desde las tablas de origen.** Dejaría de cuadrar con lo pagado en cuanto se edite o cancele una venta.
- **Sí: `UNIQUE (origen, id_linea_origen)` como candado.** Una línea se paga una sola vez aunque el empleado cambie de frecuencia o de sucursal y dos periodos se encimen.
- **No: dos columnas nullable (`id_consulta_producto`, `id_venta_detalle`) con índices únicos filtrados.** Un índice filtrado exige opciones `SET` específicas en cada conexión que inserta. La pareja `origen` + `id_linea_origen` logra lo mismo con un `UNIQUE` normal.
- **Sí: sin FK a `consulta_productos`, `VentasDetalle` ni `Products`.** `deleteConsultaProducto` borra físicamente, y el desglose pagado tiene que sobrevivir.
- **Sí: el `bono_venta` vigente al calcular, congelado en el desglose.** No existe un bono histórico, y congelarlo protege lo ya pagado.
- **No: bono histórico a la fecha de venta.** Requiere versionar el catálogo de productos. Si se necesita, va en otra spec.
- **Sí: las líneas con bono `NULL` o 0 no entran al desglose ni se bloquean.** El desglose queda limpio, y si el bono se captura después, recalcular ese periodo las paga.
- **No: guardarlas con comisión $0 y bloquearlas.** Ensucia el desglose y hace imposible corregirlas recalculando.
- **Sí: se ignora `Products.status`.** La venta ocurrió y el bono existía, aunque el producto se haya desactivado después.
- **Sí: el bono se paga por unidad de `cantidad`, es decir, por pieza en productos `split = 1`.** Es la unidad en que se vende y en que se registra la línea.
- **Sí: no se exige `consultas.fecha_fin IS NOT NULL`.** El producto se vendió y el stock ya se descontó aunque la consulta no se haya cerrado. La spec 56 sí lo exige porque cuenta consultas *atendidas*.
- **Sí: en consultas, la venta es del `id_podologo`.** Así lo define el documento de reglas.
- **No: atribuirla al usuario que agregó el producto.** `consulta_productos` no guarda quién lo agregó.
- **Sí: `ROUND` por línea y después la suma.** Cada fila del desglose muestra su propio importe, y la suma de la lista cuadra al centavo con el snapshot.
- **No: redondear solo el total del empleado.** La lista agrupada no cuadraría con la línea de percepciones.
- **Sí: solo nómina operativa, sin filtro de sucursal ni de `status` del usuario.** Es consistente con las specs 56 y 57.
- **Sí: sin descuento retroactivo.** Es la misma regla que la spec 57: un periodo pagado solo cambia si se recalcula.
- **Sí: lista del detalle agrupada por producto y sin enlaces.** Se lee mejor, y el detalle por línea queda guardado para una auditoría o un reporte futuro.
- **No: lista línea por línea con enlace a la consulta.** Se descartó por volumen y legibilidad. Además, las ventas directas no tienen página de detalle a la cual enlazar.
- **Sí: la columna de Procesar se llama "Com. Ventas".** Decisión del usuario, aunque el concepto en el detalle se llame "Comisión por venta de productos".
- **Sí: sin pantalla de configuración.** El bono ya se edita por producto en el catálogo (spec 37), y no hay parámetros globales que configurar.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Filas viejas de `consulta_productos`, de antes de la spec 17, guardan en `id_producto` un id de la tabla legacy `dbo.productos`. Si coincide con un `id_product` de `inventory.Products` con bono, se pagaría el producto equivocado. | Solo afecta a periodos cuyo rango sea anterior a la migración de la spec 17, y la nómina se calcula sobre periodos recientes. No crear periodos con fechas previas a esa migración. Si alguna vez hiciera falta, se agrega un corte por `cp.created_at` en otra spec. |
| Un usuario compartido (por ejemplo, una cuenta genérica de caja) está vinculado a un empleado. Ese empleado cobraría todas las ventas capturadas con esa cuenta. | Es un problema de operación, no de cálculo. El vínculo usuario-empleado (spec 55) se revisa antes de calcular. En `docs/nomina.md` se deja claro que en ventas directas se atribuye a quien capturó la venta. |
| Se edita la cantidad de una venta o de una línea de consulta después de que un periodo la pagó. El desglose conserva la cantidad vieja. | Es la regla "sin descuento retroactivo", y es intencional. Recalcular ese mismo periodo toma la cantidad actual. |
| `#product_sales` recorre `consultas` y `Ventas` por fecha para todos los usuarios vinculados. Sin índices por `fecha` o `created_at`, el cálculo puede volverse lento cuando crezcan las tablas. | El rango está acotado al periodo. Si el cálculo se nota lento, se agregan índices sobre `consultas([fecha])` y `Ventas([created_at])`, sin cambiar la lógica. |
| El redondeo en TS (flotantes) puede diferir por un centavo del `ROUND` de SQL en cantidades con decimales. | La TS solo restata la regla para describirla y verificarla. El importe que se paga y se muestra es siempre el que guardó el SQL. |

## Qué **no** incluye esta spec

- Descuento o reverso de una comisión ya pagada.
- Comisión en la nómina fiscal.
- Bono histórico, vigencias del bono, y bono por sucursal, puesto o rol.
- Comisión como porcentaje del precio.
- Atribuir la venta de una consulta a quien agregó el producto.
- Vista línea por línea, enlaces a consultas o ventas, y un reporte global de líneas pagadas.
- Ajuste manual de la comisión, liberar líneas a mano y recalcular solo esta comisión.

Cada una de ellas, si llega, va en su propia spec.
