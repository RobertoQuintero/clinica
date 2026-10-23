---
title: "Conceptos básicos"
description: "Qué es un periodo, cómo se calcula una nómina y qué significa cada estado."
section: "primeros-pasos"
order: 1
updated: "2026-10-23"
---

Este manual explica, en lenguaje sencillo, cómo pagar la nómina del Centro Podológico. Antes de entrar a las pantallas, conviene tener claros unos pocos conceptos que se repiten en todas ellas.

## Qué es un periodo

Un periodo es el rango de fechas que se va a pagar: por ejemplo, una semana completa. Cada periodo tiene cuatro fechas:

- **Inicio** y **fin**: los días que cubre.
- **Corte**: hasta qué día se cuentan las checadas, faltas y retardos.
- **Pago**: el día en que se paga.

Cada periodo pertenece a una sola sucursal y a una sola frecuencia (semanal, quincenal, mensual, etc.). Su código se arma solo, por ejemplo `NOM-2026-S38`, y nunca cambia.

## Los estados de un periodo

Un periodo pasa por estos estados, que se muestran como una etiqueta de color:

- **Programada**: el periodo existe pero todavía no se ha calculado. Sus fechas se pueden editar o el periodo se puede eliminar.
- **En cálculo**: ya se calculó al menos una vez con el botón "Calcular nómina". Mientras esté en este estado no se pueden editar sus fechas; el botón "Recalcular" vuelve a calcular con los datos más recientes, y "Revertir a Programada" borra el cálculo y regresa el periodo a Programada.
- **Aprobada**: el cálculo queda congelado al presionar "Aprobar". Ya no se puede recalcular, revertir, ni cambiar faltas, retardos u horas extra del periodo. La única salida de este estado es "Desaprobar", que regresa el periodo a En cálculo.
- **Pagada**: se llega con "Marcar como pagada" desde Aprobada, una vez que ya se les pagó a los empleados. Es definitiva: un periodo pagado no se puede desaprobar ni revertir.

Ver [Procesar nómina](./procesar-nomina#como-aprobar-un-periodo) para el detalle de cómo aprobar, pagar y desaprobar un periodo.

## Nómina operativa y nómina fiscal

Cada periodo calcula dos nóminas por separado:

- **Operativa**: el pago real a cada empleado, con su salario, sus comisiones y sus bonos.
- **Fiscal**: la base que se usaría para el recibo de nómina timbrado ante el SAT, con su propio salario y, cuando aplica, el ISR y el IMSS.

Un empleado puede tener salario en una, en la otra, o en ambas. Si no tiene salario capturado en alguna de las dos, simplemente no aparece en esa nómina.

## Percepciones y deducciones

Una **percepción** es cualquier monto que se le paga al empleado: su sueldo base, sus comisiones, sus bonos, el aguinaldo o la PTU. Una **deducción** es un monto que se le resta; hoy la app solo calcula dos, y únicamente en la nómina fiscal: el ISR y la cuota obrera del IMSS.

## Todavía no disponible

Esta primera versión del módulo cubre el cálculo, la aprobación y el pago del periodo. Todavía no están disponibles: timbrar el recibo de nómina ante el SAT, calcular las cuotas patronales del IMSS, ni el finiquito de un empleado que causa baja.
