ventas x consulta
	Son las ventas de productos que se vendieron durante las consultas
ventas y ventas detalle
	son las ventas de productos que se vendieron a publico general desde el modulo de ventas
	

======================================================================
Cálculo de comisiones por empleado:
Cada empleado puede tener asociados uno o varios usuarios. Durante el periodo de nómina, el sistema debe identificar todas las ventas de productos realizadas por esos usuarios, tanto las hechas dentro de una consulta como las realizadas mediante una venta directa.

Para cada producto vendido se toma el bono de venta configurado en inventory.Products y se calcula la comisión correspondiente según la cantidad vendida.

Finalmente, el sistema suma las comisiones de todos los usuarios asociados al empleado dentro del periodo seleccionado y obtiene la comisión total que corresponde pagarle al empleado.

Considerando dos fuentes de venta:

Consultas: consultas → consulta_productos → Products
Ventas directas: ventas → VentasDetalle → Products

============================================COMISION X VENTA DE PRODUCTOS============================================
=====================================================================================================================

Necesito desarrollar el cálculo de comisiones por venta de productos dentro del módulo de Nómina.

### Objetivo

Un empleado puede tener asociados **cero, uno o varios usuarios** del sistema.

Al generar una nómina para un periodo determinado, el sistema debe calcular la **comisión total por venta de productos de cada empleado**, considerando las ventas realizadas por cualquiera de los usuarios asociados a dicho empleado durante ese periodo.

### Tablas involucradas

**1. inventory.Products**

Campos importantes:

* `id_product`
* `bono_venta`
* `status`

`bono_venta` indica la comisión que genera la venta de ese producto.

**2. dbo.consultas**

Campos importantes:

* `id_consulta`
* `id_podologo` <---- hace referencia al id_usuario
* `fecha`
* `fecha_fin`

En este caso, `id_podologo` corresponde al `id_usuario`.

Una consulta puede tener productos vendidos.

**3. dbo.consulta_productos**

Campos importantes:

* `id_consulta`
* `id_producto`
* `precio`
* `cantidad`
* `estatus`

Relaciona los productos vendidos dentro de una consulta.

**4. dbo.ventas**

Campos importantes:

* `id_venta`
* `id_usuario`
* `created_at`

Representa una venta directa realizada por un usuario.

**5. dbo.VentasDetalle**

Campos importantes:

* `id_venta`
* `id_producto`
* `cantidad`
* `precio_unitario`
* `total`

Contiene los productos incluidos en cada venta directa.

### Lógica requerida

Para cada empleado:

1. Obtener todos los usuarios asociados al empleado.
2. Buscar las ventas de productos realizadas por esos usuarios dentro del periodo de nómina.
3. Considerar dos fuentes de venta:

   * Productos vendidos dentro de `consultas` mediante `consulta_productos`.
   * Productos vendidos directamente mediante `ventas` y `VentasDetalle`.
4. Relacionar cada producto vendido con `inventory.Products` mediante `id_producto = id_product`.
5. Obtener el `bono_venta` correspondiente al producto.
6. Calcular la comisión de cada producto vendido tomando en cuenta su cantidad.
7. Sumar todas las comisiones generadas por todos los usuarios asociados al empleado.
8. El resultado será la **comisión total del empleado para ese periodo de nómina**.

### Fórmula

Por cada producto:

`comisión = cantidad_vendida × bono_venta`

Después:

`comisión_empleado = suma de todas las comisiones de sus usuarios durante el periodo`

### Importante

El cálculo debe evitar duplicar ventas cuando se obtengan los datos de ambas fuentes.

También se debe definir claramente qué fecha determina que una venta pertenece al periodo de nómina:

* Para ventas directas: `ventas.created_at`.
* Para productos de consultas: definir si se utilizará `consultas.fecha` o `consultas.fecha_fin`.

Antes de modificar la base de datos o crear código definitivo, revisa la estructura existente y las relaciones actuales entre empleados y usuarios para adaptar la implementación al proyecto.

La solución debe integrarse con la arquitectura actual del módulo de Nómina y permitir obtener el desglose de la comisión, idealmente mostrando:

Empleado → Usuario → Venta/Consulta → Producto → Cantidad → Bono de venta → Comisión.

No quiero únicamente el total; el sistema debe permitir identificar de dónde proviene la comisión para poder auditar el cálculo.
