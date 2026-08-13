# Sistema de inventario multisucursal

informacion necesaria de las tablas a utilizar en el sistema de inventario y compras, asi como reglas y especificaciones

## Tablas 
estas tablas pueden incluir mas columnas si es necesario o quitar las columnas redundantes

**Productos**(ya esta creada)
- Nombre: Lidocaina al 2%
- Categoría: medicamento
- Marca: Astra
- Presentación: frasco 115 ml
- unidad de medida: frasco/caja/paquete
- Talla/tamaño: no aplica
- Precio Unitario
- No. Producto/codigo de barras: XC22345
- Proveedor: Medinsumos Veracruz
- piezas por producto
- activo
- descripcion: Es un anestésico local y antiarrítmico de tipo amida que bloquea los impulsos nerviosos para adormecer áreas específicas del cuerpo
- split( true o false, indica si el producto será dividido en piezas o alguna unidad especifica, ejem: 1 Caja Cubrebocas 100 se convertirá en 100 cubrebocas que son los que se descontaran 1 por consulta consulta)
  
  ayudame a mejorar la logica del uso del campo split o complementar o si es necesario cambiarla

**Purchase_orders**(ordenes de compra)(pendiente de creacion)(Pendiente de creacion, sujeta a cambios)
- id_purchase_order
- id_status(pedido/enviado/stock)
- created_at
- id_proveedor
- subtotal:
- iva
- descuento
- estimated_date
- delivery_date
- id_sucursal
- shipping_cost

**Product_orders**(orden de producto a comprar)(Pendiente de creacion, sujeta a cambios)(un mismo producto puede ser comprado a distintos proveedores)
- id_product_order
- id_product
- price , En pedidos de inventario el precio unitario debe ser editable
- brand
- descuento
- quantity
- created_at

**order_templates**(plantillas de orden - son listas de productos que no se compran pero puden utilizarse para realizarse la compra o pedido porteriormente
son como las ordenes de compra pero no se realiza la compra)
- id_order_template

**Proveedores**(ya esta creada)
- Nombre Corto
- Nombre legal
- Telefono principal
- id_phonecode_principal
- Telefono 2
- Whatsapp principal 
- id_whatsappcode_principal
- Whastapp 2
- Email principal
- Email 2
- RFC:
- Codigo Postal
- Direccion:
- Web:
- activo
- eliminado

**Categorias**(ya esta creada)
- id_category: 2
- name: Consumibles
- status: true
- id_empresa: 1

 valores: 
 Consumibles
 Instrumental
 Medicamentos
 Venta de Productos

**Unidades de medida**(ya esta creada)
- id_unidad: 1
- name: Pieza
- key: PZA
- status: true
  
valores: pieza, caja, paquete, kilo, frasco, litro, mililitro, gramo
  
 **Estado del pedido**(ya esta creada)
 - id_status
 - name
 - status
 - id_empresa

valores:
-Pedido: El producto fue pedido por la podóloga
-Enviado: La factura esta dada de alta en el sistema
-Stock: La chica de suministros confirmado con la podologa que le producto llego a la clinica

**Movements**(son los tipos de movimientos que se hacen en el inventario- salidas, entradas, devoluciones, traspasos)(ya esta creada)
- id_movement
- name
- status
- id_empresa
- short_name
- increases_storage(este es un campo boolean en el que se indica si el movimiento aumenta en el almacen)

valores:
- Entrada por compra(EXC) - increases_storage=1 // agrega al acumulado
- Salida por devolucion(SXD) - increases_storage=0 // resta al acumulado
- Entrada por traspaso(EXT) - increases_storage=1
- Salida por traspaso(SXT) - increases_storage=0
- Salida por consulta(SXC) - increases_storage=0
- Salida por venta(SXV) - increases_storage=0
- Entrada por ajuste(EXA) - increases_storage=1
- Salida por ajuste(SXA) - increases_storage=0
- Salida por daño/merma - increases_storage=0


**kardex**(Pendiente de creacion, sujeta a cambios)
- id_kardex
- id_product_order
- id_movement
- quantity
- created_at
- id_user(el usuario que guardó el registro)
- acumulado
- unidad de medida
- id_sucursal


### Stock

Stock Actual vs Stock Minimo

-Pedido: Las podologas tendran, que rellenar el stock actual, y el sistema al comprarlo con el stock minimo en automatico, envia alerta de:

PEDIDO

***NOta: El Stock Minimo solo lo puede ajustar el administrador

## Tipos de inventario

- Opcion de agregar provedor (al darle clic al provedor me aparezca una pantalla con los datos del provedor)
- Opcion de Agregar Producto
- Opcion de Agregar precio del producto
- Opcion de Agregar categoria

### Inventario descuento Automático 
se refiere a articulos que se descontaran en automatico del inventario por cada consulta iniciada(los productos que tienen el campo split=true, son los que se descontaran por pieza al realizarse cada consulta)

Producto:
 - Campos
 - Cubrebocas
 - Guantes

Entradas:
 - 1 Caja de Cubrebocas = 100 Cubrebocas
 - 1 Caja de Guantes = 100 Guantes
 - 1 paquete de campos= 100 Campos

Salidas por cliente(por cada consulta realizada se descuentan éstos productos del stock):
 - 2 Campos
 - 1 Cubrebocas
 - 1 Par de guantes
  
Nota importante: Aun no es necesario crear la logica de descuento de producto por consulta, solo es para tener en cuenta, esto se realizará en otro spec

### Inventario por pedido
Un mismo producto puede comprarse a distintos proveedores

Producto (productos frecuentes - estos se agregaran manualmente, ya existen algunos en la base de datos incluidos los que tienen el campo split=true):
 - Gasas
 - Alchol
 - Algodon 
 - Cinta COVAN (grosor del 10)
 - Lidocaina (Pharmacaine, Sol 10, 100 ML)
 - Geringas de 1 ML Aguja desmontable
 - Queratolitico de 1 Litro
 - Crema curación (sulfadiacina de plata 1%)
 - Crema Mupirocina 2%
 - Agua para tomar
 - Te
 - Desodorante
 - Crema Humectante Goicochea
 - Pach Fresas Aashta
 - Dremel
 - Mango de Bisturi
 - Bisturi
 - Limas 120
 - Limas 150
 - Cinta adhesiva doble cara
 - Contenedor punzocortantes
 - Atomizador de 750 ML
 - Atomizador 500 ML
 - Algodonera
 - Sanitas
 - Gorros quirurgicos
 - Batas de seguridad
 - Kit AASHTA


### Afilar instrumentos 
este servicio consiste en enviar las herramientas de trabajo a afilar a un proveedor especifico

Producto AASHTA:
 - 6 Alicate PN1009 (Normal)
 - 3 Alicate PN1008 (Uña Media)
 - 3 Alicate PN1050 (uña gruesa)
 - 6 Guiador 1.5
 - 6 Guiador 2
 - 6 Cucharilla Doble
 - 6 Cucharilla Sencilla
 - 12 Pinza Mozco PN1033
 - 3 Pinza adson ultrafino

afilacion y mantenimiento de instrumental cada 6 meses o puede ser configurable el periodo de mantenimineto para alertar en el sistema cuando se haya 
cumplido el periodo o esté proximo a cumplirse

## Notas importantes

1. Que al momento de hacer el pedido me aparezcan todos los productos del mismo provedor en una sola cesta de compras

2. Estados
Pedido:
Para que se marque la casilla de PEDIDO, es necesaria la comparacion del stock minimo con el stock actual
-Enviado:
Para que se marque la casilla de enviado es necesario subir la factura del producto comprado
-Stock:
Para que el sistema vuelva a marcar producto en stock, es necesario que se cumplan 2 condiciones: 
subida del PDF de la factura del producto 
y confirmación de la llegada del producto en sucursal con podologa 



## Alcance Inventario y compras
- Catalogo de productos
- Categorias
- Existencias
- Stock minimo
- Proveedores
- Entradas
- Salidas
- Ajustes
- Compras
- Kardex
- Reportes
- Productos por agotarse
- CRUD Productos
- CRUD Proveedores
- Movimientos
- Reportes


En pedidos de inventario el precio unitario debe ser editable


para esta implementacion solo necesito :
1 la creacion de los pedidos `references/orders/pedidos_de_inventario.html`
2 visualizacion de los productos seleccionados `references/orders/revision_de_orden.html`
3 recepcion de compras `references/orders/recepcion_de_compras.html`

si es necesario crear mas pantallas como la lista de compras para recepcion, agregarla, ya que solo se muestra el detalle de la compra por recibir