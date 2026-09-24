# Comision por tratamiento onicomcosis en la nomina

## Reglas para calculo de comision tratamientos de onicomicosis vinculados a un usuario

1.- Se tienen que revisar los tratamientos de onicomicosis pagados vinculados a un empleado
2.- los regsitros de pagos se encuentran en la tabla Tratamiento_onicomicosis_pagos
3.- Para que un tratamiento se considere pagado debe cumplir con los siguientes criterios:
    - los pagos parciales deben sumar 5000mxn o mas
    - los pagos parciales son los registros con id_tratamiento_pago_tipo=2
    - pagos parciales con status=1
4.- Los tratamientos se encuentran en la tabla tratamiento_onicomicosis
5.- Deben estar dentro del rango del periodo de nomina
6.- solo tratamientos sin cancelar con id_stage diferente de 6
7.- por cada tratamiento el empleado gana 500mxn, este cantidad de dinero debe ser editable
y al modificarse guardar fecha de modificacion y usuario que modificó