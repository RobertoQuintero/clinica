# Coincidir totales de "Ventas totales" y "Métodos de pago"

**Estado:** Implementado
**Dependencias:** ninguna
**Fecha:** 2026-08-02

## Objetivo

Hacer que los totales de "Ventas totales" (servicios y productos) en `EstadisticasCharts.tsx` coincidan exactamente con el total de "Métodos de pago", cambiando la fuente y el filtro de fecha de servicios/productos: en vez de sumar el valor nominal de `consulta_servicios`/`consulta_productos` filtrado por fecha de consulta, se prorratea el monto realmente cobrado (tabla `pagos`, filtrado por `fecha_pago`) entre servicios y productos de cada consulta según su peso nominal.

## Alcance

**Dentro de alcance:**
- En `getEstadisticas` y `getEstadisticasMultiple` (`app/dashboard/actions.ts`), agregar una nueva consulta que calcule, para el rango `fecha_inicio`/`fecha_fin` filtrado por **`pagos.fecha_pago`** (no por `c.fecha`), el total de servicios y productos **realmente cobrados**:
  - Se toman los pagos de la tabla `pagos` (`status = 1`) dentro del rango, agrupados por `id_consulta`.
  - Para cada consulta con pagos en el rango, se calcula su peso nominal: `SUM(precio_aplicado)` de `consulta_servicios` y `SUM(precio*cantidad)` de `consulta_productos` (sin filtrar por fecha, usando todos los ítems de esa consulta).
  - El monto de cada pago se prorratea entre servicios/productos proporcionalmente a ese peso nominal (`monto * nom_servicios/nom_total` y `monto * nom_productos/nom_total`).
  - Si una consulta con pago en el rango no tiene ningún ítem nominal (`nom_total = 0`), el monto completo del pago se atribuye a "productos" (decisión arbitraria documentada, para que el total siga cuadrando con "métodos de pago").
- Esta nueva cifra (llamémosla "servicios cobrados" / "productos cobrados") reemplaza a `totalServicios`/`totalProductos` **únicamente en la sección "Ventas totales"** (chart 0: la card superior, el bar chart de una sola barra, y las 3 tarjetas de resumen Servicios/Productos/Tratamientos).
- La vista mensual de "Ventas totales" (`ventas_mensuales`, usada cuando el rango cubre más de un mes) se recalcula con la misma lógica: agrupar por mes de `fecha_pago` en vez de mes de `c.fecha`, aplicando el mismo prorrateo por consulta.
- El campo `tratamientos` (`total_ingresos`) no cambia: ya se calcula a partir de `Tratamiento_onicomicosis_pagos` filtrado por `created_at`, igual que en "Métodos de pago", por lo que ya coincide.
- La sección "Métodos de pago" (`metodos_pago`) no cambia su SQL.

**Fuera de alcance:**
- Las gráficas "Servicios utilizados" (chart 1) y "Productos" (chart 2), incluido su toggle Cantidad/Ingresos: siguen mostrando el valor **nominal** por servicio/producto individual (`consulta_servicios`/`consulta_productos` filtrado por `c.fecha`), sin cambios. Esto significa que la suma de las barras de esas dos gráficas puede **no** coincidir exactamente con el total de "Ventas totales" — es una discrepancia conocida y aceptada, fuera de este spec.
- Cambiar el filtro de fecha de las gráficas de servicios/productos individuales (chart 1 y 2) para usar `fecha_pago`.
- Cambiar cómo se registran o editan pagos (`TabPagar.tsx`, `actions.ts` de consultas).
- Prorratear pagos de tratamientos de onicomicosis (ya coinciden, no se tocan).
- Manejar/backfill de pagos históricos huérfanos (pagos de consultas eliminadas, etc.) más allá del filtro `c.deleted_at IS NULL` ya existente.

## Modelo de datos

**Modificación a `interfaces` (definida directamente en `app/dashboard/actions.ts`, junto a `IEstadisticasData`):**

```ts
export interface IVentasCobradasStat {
  total_servicios: number;
  total_productos: number;
}

export interface IEstadisticasData {
  ok: boolean;
  servicios: IServicioStat[];       // sin cambios (nominal, chart 1)
  productos: IProductoStat[];       // sin cambios (nominal, chart 2)
  metodos_pago: IMetodoPagoStat[];  // sin cambios
  ventas_mensuales: IVentaMensualStat[]; // misma forma, nueva lógica de cálculo
  tratamientos: ITratamientoStat;   // sin cambios
  ventas_cobradas: IVentasCobradasStat; // NUEVO — usado solo por "Ventas totales" (vista de un solo mes)
}
```

**Nueva consulta SQL** (agregada al `Promise.all` de `getEstadisticas`/`getEstadisticasMultiple`), reemplazando el uso de `servicios`/`productos` para el total de "Ventas totales":

```sql
WITH pago_periodo AS (
  SELECT pg.[id_consulta], pg.[monto]
  FROM [CentroPodologico].[dbo].[pagos] pg
  INNER JOIN [CentroPodologico].[dbo].[consultas] c
    ON pg.[id_consulta] = c.[id_consulta]
  WHERE c.[deleted_at] IS NULL
    AND c.[id_empresa]  = @id_empresa
    AND c.[id_sucursal]  = @id_sucursal   -- o IN (...) en la variante múltiple
    AND pg.[fecha_pago] >= @fecha_inicio
    AND pg.[fecha_pago] < DATEADD(day, 1, CAST(@fecha_fin AS date))
    AND pg.[status] = 1
),
nominal_servicios AS (
  SELECT cs.[id_consulta], SUM(cs.[precio_aplicado]) AS total
  FROM [CentroPodologico].[dbo].[consulta_servicios] cs
  GROUP BY cs.[id_consulta]
),
nominal_productos AS (
  SELECT cp.[id_consulta], SUM(cp.[precio] * cp.[cantidad]) AS total
  FROM [CentroPodologico].[dbo].[consulta_productos] cp
  GROUP BY cp.[id_consulta]
),
prorrateo AS (
  SELECT
    pp.[monto],
    ISNULL(ns.total, 0) AS nom_serv,
    ISNULL(np.total, 0) AS nom_prod
  FROM pago_periodo pp
  LEFT JOIN nominal_servicios ns ON ns.[id_consulta] = pp.[id_consulta]
  LEFT JOIN nominal_productos np ON np.[id_consulta] = pp.[id_consulta]
)
SELECT
  SUM(
    CASE
      WHEN (nom_serv + nom_prod) > 0 THEN monto * nom_serv / (nom_serv + nom_prod)
      ELSE 0
    END
  ) AS total_servicios,
  SUM(
    CASE
      WHEN (nom_serv + nom_prod) > 0 THEN monto * nom_prod / (nom_serv + nom_prod)
      ELSE monto
    END
  ) AS total_productos
FROM prorrateo
```

**Reescritura de `ventas_mensuales`:** mismo patrón, pero agrupando `pago_periodo` por `CONVERT(varchar(7), pg.[fecha_pago], 120)` en vez de agrupar `consulta_servicios`/`consulta_productos` por `c.[fecha]`, con el `FULL OUTER JOIN` contra el mes de tratamientos (`top2.created_at`) igual que hoy.

**Cambio en `EstadisticasCharts.tsx`:**
- `totalServicios`/`totalProductos` (líneas 333-334) pasan de `data?.servicios.reduce(...)` / `data?.productos.reduce(...)` a `data?.ventas_cobradas.total_servicios` / `data?.ventas_cobradas.total_productos`.
- El resto del componente (chart 1, chart 2, tooltips) no cambia: siguen usando `data.servicios` / `data.productos` tal cual.

## Plan de implementación

1. En `app/dashboard/actions.ts`, agregar la interfaz `IVentasCobradasStat` y el campo `ventas_cobradas: IVentasCobradasStat` a `IEstadisticasData`.
2. En `getEstadisticas`: agregar la nueva consulta SQL de prorrateo (CTE `pago_periodo` / `nominal_servicios` / `nominal_productos` / `prorrateo`) al arreglo del `Promise.all`, parametrizada igual que las demás (`id_empresa`, `id_sucursal`, `fecha_inicio`, `fecha_fin`), y mapear su resultado a `ventas_cobradas` en el `return`. Actualizar también los `return` de error (`catch`) para incluir `ventas_cobradas: { total_servicios: 0, total_productos: 0 }`.
3. Reescribir la consulta de `ventas_mensuales` dentro de `getEstadisticas` para que agrupe por mes de `pg.[fecha_pago]` (usando el mismo prorrateo por consulta) en vez de por mes de `c.[fecha]`, manteniendo la forma de salida (`mes`, `total_servicios`, `total_productos`, `total_tratamientos`) y el `FULL OUTER JOIN` con el mes de tratamientos sin cambios.
4. Repetir los pasos 2 y 3 en `getEstadisticasMultiple`, adaptando el filtro de sucursal a `IN (${placeholders})` con `commonParams`, igual que el resto de las consultas de esa función.
5. En `EstadisticasCharts.tsx`, cambiar `totalServicios`/`totalProductos` (líneas 333-334) para leer de `data?.ventas_cobradas.total_servicios` / `data?.ventas_cobradas.total_productos` en vez de reducir `data.servicios`/`data.productos`. No tocar el resto del archivo (chart 1, chart 2, tooltips, `productosOrdenados`, etc.).
6. Prueba manual: elegir un rango de fechas con consultas y pagos conocidos, verificar que "Total" en la card de "Ventas totales" sea igual a la suma del "Total" en la tabla de "Métodos de pago"; probar con un rango multi-mes y verificar que cada mes de la gráfica apilada de "Ventas totales" siga sumando lo mismo que "Métodos de pago" para ese rango completo; probar con una consulta que tenga pago pero cero servicios/productos nominales (si existe) y confirmar que no rompe el cálculo; verificar que las gráficas "Servicios utilizados" y "Productos" no cambiaron.

## Criterios de aceptación

- [ ] El total mostrado en la card "Ventas totales" (`fmtCurrency(totalServicios + totalProductos + totalTratamientos)`) es exactamente igual al total mostrado en el `tfoot` de la tabla "Métodos de pago", para cualquier rango de fechas y selección de sucursal(es).
- [ ] En vista de un solo mes, las 3 tarjetas de resumen (Servicios, Productos, Tratamientos) bajo "Ventas totales" reflejan `ventas_cobradas.total_servicios`, `ventas_cobradas.total_productos` y `tratamientos.total_ingresos` respectivamente.
- [ ] En vista multi-mes, la suma de `total_servicios + total_productos + total_tratamientos` de todos los meses en `ventas_mensuales` es igual al total de "Métodos de pago" para el mismo rango completo.
- [ ] Las gráficas "Servicios utilizados" (chart 1) y "Productos" (chart 2), incluido el toggle Cantidad/Ingresos, no cambian su comportamiento ni sus cifras (siguen siendo nominales, filtradas por `c.fecha`).
- [ ] `getEstadisticasMultiple` (selector de sucursales, role 4) produce el mismo resultado agregado que llamar `getEstadisticas` por cada sucursal y sumar, para servicios/productos cobrados y para métodos de pago.
- [ ] Una consulta con pago registrado en el rango pero sin ítems nominales (si existiera) no genera error ni `NaN`; su monto se refleja completo en "Productos" dentro de `ventas_cobradas`.
- [ ] El estado de carga (`loading`) y vacío (`EmptyState`) de la sección "Ventas totales" siguen funcionando igual que antes.

## Decisiones tomadas y descartadas

- **"Ventas totales" basado en lo realmente cobrado (`pagos`) vs. mantenerlo nominal y corregir "Métodos de pago":** se decidió que `pagos` es la fuente autoritativa (dinero que efectivamente entró), por lo que "Ventas totales" se ajusta a ese criterio en vez de modificar "Métodos de pago".
- **Filtro por `fecha_pago` vs. `fecha` de consulta:** se decidió filtrar ambas secciones por `fecha_pago`, ya que el objetivo es que coincidan con "Métodos de pago" (que ya usaba `fecha_pago`). Como consecuencia, "Ventas totales" ahora puede incluir el cobro de una consulta cuya fecha de atención cae fuera del rango seleccionado (si el pago se registró dentro del rango) — se acepta como parte de este cambio de semántica (de "atendido en" a "cobrado en").
- **Prorrateo proporcional al peso nominal vs. eliminar el desglose Servicios/Productos:** se eligió prorratear (en vez de mostrar un total combinado sin desglose) para conservar las 3 tarjetas de resumen y la gráfica apilada mensual tal como existen hoy, aceptando que es una aproximación (no un desglose exacto de qué parte del pago cubrió qué ítem).
- **Pago sin ítems nominales (`nom_total = 0`) atribuido 100% a "Productos":** decisión arbitraria para no perder el monto del total (y así garantizar que siga cuadrando con "Métodos de pago"); se documenta aquí en vez de crear una categoría "Sin clasificar" nueva, dado que se espera que sea un caso raro/inexistente en datos reales.
- **No tocar las gráficas "Servicios utilizados" y "Productos" (charts 1 y 2):** se mantienen nominales y filtradas por `c.fecha` porque responden a una pregunta distinta ("¿qué servicios/productos se aplicaron en este periodo?"), no a "¿cuánto dinero entró?". Se acepta que su suma pueda no cuadrar con "Ventas totales" — es una discrepancia conocida, ya documentada en el alcance, y separada de este spec.
- **No prorratear pagos de tratamientos de onicomicosis:** no fue necesario, ya que su cálculo ya coincidía entre ambas secciones antes de este spec.

## Riesgos identificados

- **Rendimiento:** la nueva consulta agrega dos CTEs adicionales (`nominal_servicios`, `nominal_productos`) que agrupan por `id_consulta` sin filtro de fecha (se calculan sobre todos los ítems históricos de las consultas que tuvieron pago en el rango, no solo del rango). En bases de datos grandes esto podría ser más costoso que las consultas actuales; se puede acotar después si se detecta lentitud, pero no se optimiza preventivamente en este spec.
- **Pagos duplicados o editados:** si un pago se edita (cambia de monto o fecha) después de haberse hecho el prorrateo, el nuevo cálculo simplemente reflejará el estado actual de `pagos` en la siguiente carga — no hay caché ni snapshot que reconciliar, así que no se considera un riesgo real, solo se documenta el comportamiento esperado.
