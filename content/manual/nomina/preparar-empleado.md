---
title: "Preparar al empleado para nómina"
description: "Qué datos necesita el expediente de un empleado antes de incluirlo en la nómina."
section: "primeros-pasos"
order: 2
updated: "2026-10-21"
---

La mayoría de los avisos "No calculado" o de los empleados que faltan en una nómina vienen de datos que no se capturaron en el expediente del empleado. Esta página reúne, pestaña por pestaña, qué revisar antes de calcular.

## Datos personales

En la sección "Información Laboral" del expediente:

- **"Periodo de pago"**: la frecuencia con la que se le paga (semanal, quincenal, mensual...). **Sin esto, el empleado nunca entra a ninguna nómina**, ni operativa ni fiscal.
- **"Salario diario"**: su sueldo por día en la nómina operativa (el pago real). Si queda en $0.00, el empleado no entra a la operativa.
- **"Salario diario fiscal"**: su sueldo por día en la nómina fiscal. Si queda en $0.00, el empleado no entra a la fiscal. Un empleado puede tener los dos, solo uno, o ninguno.

En la sección "Datos fiscales", solo se exigen cuando el empleado tiene "Salario diario fiscal" capturado: RFC, CURP, NSS, código postal fiscal, tipo de régimen, tipo de contrato y tipo de jornada (más el banco, si su cuenta no es una CLABE de 18 dígitos). Si falta algo, el expediente muestra una caja ámbar "Pendiente para timbrar" con la lista exacta de lo que falta.

![Sección Información Laboral y Datos fiscales del expediente](captura:preparar-empleado-datos-personales)

## Asistencia

Las checadas que registra el checador biométrico son la base de las horas extra, los retardos y el bono de puntualidad. Para que las checadas de un empleado se le atribuyan a él, su huella o tarjeta debe estar dada de alta con el botón "Identificadores" de esta pestaña. Sin un identificador asignado, sus checadas nunca llegan a su expediente aunque el checador las reciba.

## Horario

El botón "Editar horario" abre un formulario con los 7 días de la semana; un día sin horario capturado es un día de descanso. "Guardar horario" reemplaza la semana completa, no la combina con la anterior.

El horario es lo que la app usa para decidir qué cuenta como hora extra (lo trabajado fuera de él) y qué día es de descanso (donde cualquier hora trabajada es extra). También decide si un día es laborable para los retardos, las vacaciones y los días económicos. Un empleado sin horario capturado muestra "Sin horario definido" y no se le detectan horas extra.

## Vacaciones

Cada año de servicio (contado desde el aniversario de ingreso) da un bloque de días de derecho, que se captura de una sola vez con "Capturar vacaciones". Ese bloque se puede mover con "Reprogramar" o quitar con "Cancelar bloque" mientras no haya empezado. Los días del bloque no disfrutados antes de que termine el año quedan "Por pagar", y se marcan con "Marcar como pagadas".

Los días dentro de un bloque de vacaciones no cuentan como falta, retardo, ni afectan las horas extra o los bonos de puntualidad y asistencia: el empleado está de vacaciones, no ausente.

## Días económicos

Cada empleado tiene hasta 3 días económicos por año calendario (se reinician cada 1 de enero), capturados uno por uno con "Registrar día económico" y, si hace falta, quitados con "Cancelar". Solo se pueden registrar en un día laborable según el horario del empleado.

Igual que las vacaciones, un día económico activo no cuenta como falta ni retardo, y no afecta las horas extra ni los bonos.

## IMSS

La tarjeta "SBC vigente hoy" muestra el salario base de cotización actual del empleado, el mismo que se reportó en IDSE. Se da de alta con "Nuevo SBC", se corrige el monto con "Editar SBC" (para moverlo a otra fecha hay que eliminarlo y crear uno nuevo) y se quita con "Eliminar SBC". Junto con el NSS capturado en Datos personales, el SBC es lo que permite calcular la cuota obrera del IMSS del empleado en la nómina fiscal.

## Usuarios

El botón "Vincular usuario" conecta este empleado con una o más cuentas del sistema; cada cuenta se desconecta con "Desvincular" sin afectar su acceso. Esta liga es la que atribuye al empleado las consultas, los tratamientos de onicomicosis liquidados y las ventas de producto que capturó con esa cuenta, y es lo que paga sus comisiones.

## Relacionado

- [Conceptos básicos](./conceptos-basicos)
