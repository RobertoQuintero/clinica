# 67 — Ventas de mostrador en estadísticas del dashboard

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [05 — Coincidir totales de ventas y métodos de pago](05-coincidir-totales-ventas-metodos-pago.md): define que el total de "Ventas totales" debe ser igual al de "Métodos de pago", y que los pagos de consulta se reparten entre servicios y productos.
  - [17 — Productos de consulta descuentan stock](17-productos-consulta-descuentan-stock.md): desde esa spec, `consulta_productos.id_producto` apunta a `inventory.Products`.
  - [35 — Ventas con múltiples productos por ticket](35-ventas-multiples-productos-ticket.md): crea las tablas `dbo.Ventas` (encabezado) y `dbo.VentasDetalle` (líneas).
- **Modifica base de datos:** No.
- **Fecha:** 2026-10-05
- **Objetivo:** Que `EstadisticasCharts` incluya las ventas de mostrador (`dbo.Ventas`/`dbo.VentasDetalle`) en "Ventas totales", "Productos" y "Métodos de pago".

## Alcance

**Incluye:**

- **Unificar el SQL.** `getEstadisticas(fecha_inicio, fecha_fin, id_sucursal)` pasa a llamar a `getEstadisticasMultiple(fecha_inicio, fecha_fin, [id_sucursal])`, y se borra su SQL duplicado. Las dos funciones conservan su firma y `EstadisticasCharts.tsx` sigue llamándolas igual.
- **Ventas de mostrador consideradas.** En todas las consultas nuevas, una venta de mostrador cuenta si cumple las tres condiciones siguientes:
  - `dbo.Ventas.status = 1`;
  - `created_at` está dentro del rango, con el mismo patrón `>= @fecha_inicio AND < DATEADD(day, 1, CAST(@fecha_fin AS date))`;
  - `id_sucursal IN (...)`.
- **"Ventas totales": vista de un periodo.** `ventas_cobradas.total_productos` pasa a sumar dos cosas:
  - lo que ya calcula: la parte de productos de los pagos de consulta, según el reparto de la spec 05;
  - más `SUM(Ventas.total)` de las ventas de mostrador.
- **"Ventas totales": vista por mes.** `ventas_mensuales.total_productos` suma también las ventas de mostrador, agrupadas por mes de `Ventas.created_at`. Un mes que solo tenga ventas de mostrador aparece igual en la gráfica.
- **Tarjeta "Productos" de "Ventas totales".** Muestra debajo del monto una línea secundaria "Mostrador: $X" con el total de ventas de mostrador.
- **"Métodos de pago".** Cada ticket de mostrador cuenta como 1 pago de su `idMetodoPago`, por el monto de `Ventas.total`. Con esto, el total de "Ventas totales" sigue siendo igual al de "Métodos de pago".
- **Gráfica "Productos": datos.**
  - Agrupa por `inventory.Products.id_product`, con `name` como etiqueta.
  - Deja de usar `dbo.productos`.
  - Filtra `inventory.Products.id_empresa = @id_empresa`.
- **Gráfica "Productos": productos de consulta.**
  - Se filtran por `c.fecha`, igual que hoy.
  - Solo entran los `consulta_productos` con `status = 1`.
  - Solo entran las filas cuyo `id_producto` existe en `inventory.Products` de la empresa, con `INNER JOIN`.
- **Gráfica "Productos": productos de mostrador.**
  - Se toman de `VentasDetalle`.
  - La cantidad es `cantidad` y los ingresos son `subtotal`.
- **Gráfica "Productos": presentación.**
  - Cada producto es una barra apilada con dos segmentos, Consulta y Mostrador.
  - Funciona con el toggle Cantidad/Ingresos que ya existe.
  - El top 7 se calcula con el total combinado.
  - El tooltip muestra el desglose Consulta / Mostrador y el total.

**No incluye (para otros specs):**

- Una categoría propia "Ventas mostrador" en "Ventas totales". Se decidió sumarlas a "Productos".
- Un filtro Todos / Consulta / Mostrador en la gráfica "Productos".
- Cambios en la gráfica "Servicios utilizados".
- Cambiar el filtro de fecha de los productos de consulta, de `c.fecha` a `fecha_pago`. Se mantiene la diferencia ya aceptada en la spec 05: la suma de las barras de "Productos" puede no coincidir con "Ventas totales".
- Migrar o corregir los `consulta_productos` históricos que apuntan a ids de `dbo.productos`.
- Eliminar la tabla `dbo.productos` o limpiar otras referencias a ella fuera de `app/dashboard/actions.ts`.
- Facturación de ventas de mostrador, o filtrar por `facturado`.
- Cambios en la pantalla `/dashboard/ventas` o en sus server actions.

## Modelo de datos

Esta spec no crea tablas ni columnas. Lee estas tablas que ya existen en `[CentroPodologico]`:

- `dbo.Ventas`: `id_venta`, `id_sucursal`, `idMetodoPago`, `total`, `created_at`, `status`.
- `dbo.VentasDetalle`: `id_venta`, `id_producto`, `cantidad`, `subtotal`.
- `dbo.consulta_productos`: `id_consulta`, `id_producto`, `precio`, `cantidad`, `status`.
- `inventory.Products`: `id_product`, `name`, `id_empresa`.

**Cambios en las interfaces de `app/dashboard/actions.ts`:**

```ts
export interface IProductoStat {
  id_producto: number;              // NUEVO — inventory.Products.id_product, se usa como key
  nombre: string;                   // ahora viene de inventory.Products.name
  total_cantidad: number;           // consulta + mostrador
  total_ingresos: number;           // consulta + mostrador
  cantidad_consulta: number;        // NUEVO
  cantidad_mostrador: number;       // NUEVO
  ingresos_consulta: number;        // NUEVO
  ingresos_mostrador: number;       // NUEVO
}

export interface IVentasCobradasStat {
  total_servicios: number;          // sin cambios
  total_productos: number;          // ahora incluye total_mostrador
  total_mostrador: number;          // NUEVO — SUM(Ventas.total) en el rango
}

// IVentaMensualStat no cambia de forma: total_productos incluye las ventas de mostrador del mes.
// IMetodoPagoStat no cambia de forma.
```

**Cómo se calcula cada cifra** (todo en `getEstadisticasMultiple`):

- **`productos`.**
  - Es un `UNION ALL` de dos partes, ya agregadas por `id_product`:
    - consulta: `consulta_productos` con `status = 1`, con `INNER JOIN consultas` filtrado por `c.fecha` y con `INNER JOIN inventory.Products` de la empresa;
    - mostrador: `VentasDetalle` con `INNER JOIN Ventas` (`status = 1`, `created_at` dentro del rango) y con `INNER JOIN inventory.Products` de la empresa.
  - Después se agrupa por `id_product, name` con `SUM(...)` de cada columna.
  - Se conserva el ranking `ROW_NUMBER()` actual (top 7 por cantidad o top 7 por ingresos), aplicado sobre los totales combinados.
- **`ventas_cobradas`.**
  - `total_servicios` y la parte de consulta de `total_productos` se calculan como hoy.
  - `total_mostrador` sale de una subconsulta escalar sobre `Ventas`.
  - `total_productos = parte de consulta + total_mostrador`.
- **`ventas_mensuales`.**
  - Un tercer bloque (meses de mostrador) se agrega al `FULL OUTER JOIN` de meses que ya existe (pagos de consulta y tratamientos): `CONVERT(varchar(7), v.created_at, 120) AS mes, SUM(v.total) AS total_mostrador`.
  - `total_productos` del mes = la parte de consulta del mes + `total_mostrador` del mes.
- **`metodos_pago`.**
  - Se agrega una rama al `UNION ALL` de la subconsulta `src`: `SELECT v.idMetodoPago, v.total AS monto FROM dbo.Ventas v WHERE ...`.
  - El `COUNT(*)` y el `SUM(monto)` ya existentes cuentan cada ticket como 1 pago.

**Convenciones:**

- No se devuelve ninguna fecha nueva al cliente. El mes ya sale como `varchar(7)`, así que no hace falta `toDBString` ni `Date`.
- Colores de la barra apilada en "Productos", los mismos para Cantidad e Ingresos:
  - Consulta: `#5C58D6`.
  - Mostrador: `#58CBD6`.
- Todos los parámetros siguen pasando por `queryParams`, con `@sid0..n` para las sucursales.

## Plan de implementación

1. **Unificar `getEstadisticas`.** En `app/dashboard/actions.ts`, reemplazar el cuerpo de `getEstadisticas` por `return getEstadisticasMultiple(fecha_inicio, fecha_fin, [id_sucursal])` y borrar su SQL duplicado. `getEstadisticasMultiple` ya obtiene `id_empresa` de `getActiveUser()`, así que no se pierde ese filtro.
   - Verificación: `npm run build` sin errores.
   - Verificación: con un usuario que no es rol 4, el dashboard muestra las mismas cifras que antes en las cuatro secciones.

2. **Mostrador en "Métodos de pago" y en el total de "Ventas totales".**
   - En `getEstadisticasMultiple`, agregar la rama de `dbo.Ventas` al `UNION ALL` de `metodos_pago`.
   - Agregar `total_mostrador` a `IVentasCobradasStat`. Calcularlo en la consulta de `ventas_cobradas` y sumarlo a `total_productos`.
   - Actualizar los `return` vacíos y los de error para que incluyan `total_mostrador: 0`.
   - En `EstadisticasCharts.tsx`, agregar la línea "Mostrador: $X" en la tarjeta "Productos". Se muestra solo si `total_mostrador > 0`.
   - Verificación: con una venta de mostrador en el rango, el total de la tarjeta de "Ventas totales" sigue igual al `tfoot` de "Métodos de pago" en la vista de un periodo.

3. **Mostrador en la vista por mes.** Agregar el bloque de meses de mostrador al `FULL OUTER JOIN` de `ventas_mensuales` y sumar su monto a `total_productos` del mes.
   - Verificación: en un rango de dos meses o más, la suma de los meses es igual al total de "Métodos de pago".
   - Verificación: un mes que solo tiene ventas de mostrador aparece en la gráfica.

4. **Datos de la gráfica "Productos".**
   - Reescribir la consulta `productos` con el `UNION ALL` consulta + mostrador, el `INNER JOIN` a `inventory.Products` de la empresa y `consulta_productos.status = 1`.
   - Actualizar `IProductoStat` con los campos nuevos.
   - En el componente, usar `id_producto` como `key`. La barra sigue siendo simple con `total_cantidad`/`total_ingresos`, así que la UI funciona sin más cambios.
   - Verificación: un producto vendido en consulta y en mostrador aparece en una sola barra con la suma de los dos.
   - Verificación: un producto de consulta inactivo no suma.

5. **Barra apilada y tooltip.** En `EstadisticasCharts.tsx`, cambiar la gráfica "Productos" a dos `<Bar>` con el mismo `stackId`:
   - con la métrica Cantidad usa `cantidad_consulta`/`cantidad_mostrador`; con Ingresos, `ingresos_consulta`/`ingresos_mostrador`;
   - colores `#5C58D6` / `#58CBD6`;
   - una leyenda con "Consulta" y "Mostrador".

   `BarTooltipProductos` muestra el desglose Consulta / Mostrador / Total de la métrica activa. El orden y el top 7 siguen usando `total_cantidad`/`total_ingresos`.
   - Verificación: el toggle Cantidad/Ingresos cambia los dos segmentos.
   - Verificación: la apariencia es correcta en modo claro y en modo oscuro.

6. **Prueba manual de extremo a extremo.** Tomar un rango con consultas, tratamientos y al menos dos tickets de mostrador con métodos de pago distintos. Una de ellas debe tener un producto que también se usó en una consulta. Comprobar lo siguiente:
   - las cifras de las tres secciones;
   - el total de "Ventas totales" igual al de "Métodos de pago", en la vista de un periodo y en la vista por mes;
   - el mismo resultado como rol 4, con varias sucursales seleccionadas;
   - un ticket con `status = 0` no aparece en ninguna sección.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript ni de lint nuevos.
- [ ] `getEstadisticas` ya no tiene SQL propio y devuelve lo mismo que `getEstadisticasMultiple(fecha_inicio, fecha_fin, [id_sucursal])`.
- [ ] Sin ventas de mostrador en el rango, las cuatro secciones muestran las mismas cifras que antes. La única excepción es "Productos", si había productos de consulta inactivos o con ids legacy.
- [ ] Un ticket de mostrador con `status = 1` y `created_at` dentro del rango sube el total de "Ventas totales" exactamente en `Ventas.total`.
- [ ] En la vista de un periodo, la tarjeta "Productos" de "Ventas totales" muestra "Mostrador: $X". `X` es la suma de `Ventas.total` del rango.
- [ ] La línea "Mostrador: $X" no aparece cuando `total_mostrador` es 0.
- [ ] En la vista por mes, cada ticket de mostrador suma a `total_productos` del mes de su `created_at`.
- [ ] Un mes con solo ventas de mostrador aparece como una columna en la gráfica mensual.
- [ ] En "Métodos de pago", cada ticket de mostrador suma 1 a la columna "Pagos" de su método y `Ventas.total` a su "Total".
- [ ] El total de "Ventas totales" es igual al `tfoot` de "Métodos de pago" en la vista de un periodo, para cualquier rango y cualquier selección de sucursales.
- [ ] En la vista por mes, la suma de `total_servicios + total_productos + total_tratamientos` de todos los meses es igual al `tfoot` de "Métodos de pago".
- [ ] Un ticket con `status = 0` no aparece en ninguna de las tres secciones.
- [ ] Un ticket de otra sucursal, o fuera del rango de fechas, no aparece en ninguna de las tres secciones.
- [ ] En la gráfica "Productos", un producto vendido en consulta y en mostrador aparece en una sola barra, con un segmento Consulta y un segmento Mostrador.
- [ ] En la gráfica "Productos", la suma de los dos segmentos es igual a `total_cantidad` (o a `total_ingresos`, según la métrica activa).
- [ ] El segmento Mostrador usa `VentasDetalle.cantidad` en Cantidad y `VentasDetalle.subtotal` en Ingresos.
- [ ] Un `consulta_productos` con `status ≠ 1` no suma en la gráfica "Productos".
- [ ] Un `consulta_productos` cuyo `id_producto` no existe en `inventory.Products` de la empresa no aparece en la gráfica "Productos".
- [ ] El nombre de cada barra de "Productos" viene de `inventory.Products.name`. `app/dashboard/actions.ts` ya no tiene ninguna referencia a `dbo.productos`.
- [ ] La gráfica "Productos" muestra como máximo 7 barras, ordenadas por el total combinado de la métrica activa.
- [ ] El tooltip de "Productos" muestra Consulta, Mostrador y Total de la métrica activa.
- [ ] Como rol 4 con varias sucursales, cada cifra es igual a la suma de las cifras de cada sucursal por separado.
- [ ] La gráfica "Servicios utilizados" no cambia.
- [ ] La barra apilada, la leyenda, el tooltip y la línea "Mostrador" se ven bien en modo claro y en modo oscuro.

## Decisiones

- **Sí:** las ventas de mostrador entran en "Ventas totales", "Productos" y "Métodos de pago".
  - Es la única forma de mantener la regla de la spec 05: el total de "Ventas totales" igual al de "Métodos de pago".
- **No:** incluirlas solo en "Productos", o solo en "Productos" y "Ventas totales".
  - Las dos secciones dejarían de coincidir sin aviso.
- **Sí:** en "Ventas totales" se suman a "Productos", con una línea "Mostrador: $X" en la tarjeta.
  - Son ingresos por productos.
  - La línea secundaria conserva el desglose sin agregar una categoría.
- **No:** una 4.ª categoría "Ventas mostrador".
  - Agregaría una barra, una tarjeta y una serie mensual para algo que conceptualmente ya es "Productos".
- **Sí:** barra apilada Consulta / Mostrador en la gráfica "Productos".
  - Muestra el total y el origen sin controles nuevos.
- **No:** una sola barra con la suma, porque se pierde el origen.
- **No:** un filtro Todos / Consulta / Mostrador, porque agrega estado y controles.
- **Sí:** el top 7 se calcula con el total combinado. Es la pregunta que responde la gráfica: qué productos se venden más.
- **Sí:** cada ticket de mostrador cuenta como 1 pago en "Métodos de pago", por el monto de `Ventas.total`.
  - El ticket tiene un solo método de pago (spec 35), así que equivale a un cobro.
- **Sí:** las ventas de mostrador se filtran por `Ventas.created_at`.
  - Es el momento del cobro, así que coincide con el criterio "cobrado en" de la spec 05.
- **No:** repartir los tickets de mostrador entre servicios y productos.
  - Un ticket solo tiene productos, así que su monto completo va a "Productos".
- **Sí:** la gráfica "Productos" agrupa por `inventory.Products.id_product` con `INNER JOIN` a la empresa.
  - `dbo.productos` ya no se usa (spec 17).
  - Agrupar por id evita barras duplicadas por nombre.
  - El `INNER JOIN` deja fuera los ids legacy que no existen en `inventory.Products` de la empresa.
- **No:** migrar los `consulta_productos` históricos con ids de `dbo.productos`.
  - Solo afecta a la gráfica de consultas viejas y sería otro trabajo.
- **Sí:** excluir los `consulta_productos` con `status ≠ 1`.
  - Mismo criterio que la spec 66: un producto inactivo ya devolvió su stock y no se cobra.
- **Sí:** los productos de consulta siguen filtrándose por `c.fecha` en la gráfica "Productos".
  - Se mantiene lo que decidió la spec 05: la gráfica responde "qué se usó o vendió en el periodo".
  - Puede no cuadrar con "Ventas totales". Es una diferencia conocida.
- **Sí:** `getEstadisticas` llama a `getEstadisticasMultiple([id_sucursal])` y se borra su SQL duplicado.
  - Esta spec cambia 4 de las 6 consultas.
  - Mantener dos copias duplica el trabajo y deja la puerta abierta a que queden distintas.
- **No:** convertir `EstadisticasCharts` a Server Component, o mover la carga de datos fuera de la acción.
  - Depende de `SucursalContext` y del selector de fechas del cliente, que es el caso que `CLAUDE.md` permite.
  - Está fuera del objetivo.
- **No:** filtrar ni distinguir las ventas facturadas. La facturación de ventas sigue fuera de alcance (spec 35).

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Sin ventas de mostrador, la gráfica "Productos" puede cambiar respecto a hoy. Desaparecen productos de consulta inactivos o con ids legacy de `dbo.productos`, y algunos nombres cambian porque ahora vienen de `inventory.Products`. | Es el efecto buscado de corregir el JOIN. El criterio de "mismas cifras que antes" lo menciona como excepción. |
| Si un `id_producto` legacy coincide por casualidad con un `id_product` de `inventory.Products` de la misma empresa, esa fila suma al producto equivocado. | Se acepta: `dbo.productos` ya no se usa y solo afecta a consultas anteriores a la spec 17. Corregirlo requiere una migración de datos, que está fuera de alcance. |
| Si `Ventas.total` no es igual a la suma de `VentasDetalle.subtotal` de su ticket, "Ventas totales" y "Métodos de pago" (que usan `total`) no cuadran con el segmento Mostrador de "Productos" (que usa `subtotal`). | La spec 35 calcula `total` en el servidor como la suma de las líneas, en la misma transacción. No se agrega ninguna validación extra. |
| Unificar las funciones cambia el plan de ejecución de SQL Server para una sola sucursal: pasa de `= @id_sucursal` a `IN (@sid0)`. | El efecto debería ser nulo. El paso 1 compara las cifras antes y después. |
| Las consultas agregan uniones y una rama más al `FULL OUTER JOIN` mensual, lo que puede hacer más lento el dashboard en rangos largos. | No se optimiza de antemano, como en la spec 05. `Ventas` y `VentasDetalle` son tablas pequeñas comparadas con `pagos`. |

## Lo que **no** incluye esta spec

- Una categoría propia "Ventas mostrador" en "Ventas totales".
- Un filtro Todos / Consulta / Mostrador en la gráfica "Productos".
- Cambios en la gráfica "Servicios utilizados".
- Cambiar el filtro de fecha de los productos de consulta a `fecha_pago`.
- Migrar los `consulta_productos` históricos con ids de `dbo.productos`.
- Eliminar `dbo.productos` o limpiar otras referencias a ella fuera de `app/dashboard/actions.ts`.
- Facturación de ventas de mostrador.
- Cambios en `/dashboard/ventas` o en sus server actions.

Cada uno de esos puntos, si se hace, va en su propio spec.
