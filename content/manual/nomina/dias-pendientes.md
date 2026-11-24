---
title: "Días pendientes de pago"
description: "Capturar días trabajados que aún no se pagaron."
section: "pantallas"
order: 11
updated: "2026-11-24"
---

## Para qué sirve

Permite capturar días ya trabajados que no se pagaron, para incluirlos una sola vez en un periodo ordinario. Cada nómina usa su propia tarifa diaria.

## Antes de empezar

Selecciona el periodo ordinario que pagará los días y verifica que el empleado esté activo en la sucursal. Se puede capturar o eliminar mientras el periodo esté **Programada** o **En cálculo**; en **Aprobada** o **Pagada** queda de solo lectura.

## Qué ves en la pantalla

El selector de periodo y el buscador filtran las capturas. Las tarjetas resumen los días y montos; la tabla muestra empleado, fecha, tarifas, importes estimados, motivo, autor, fecha de captura y estado de pago.

## Cómo capturar días

1. Presiona "Capturar días" y selecciona un empleado de la lista.
2. Captura **Fecha inicial** y **Fecha final**. Se crea una captura por cada día del rango, incluidos ambos extremos.
3. Revisa las tarifas diarias operativa y fiscal, propuestas desde el expediente y editables. Una tarifa en cero excluye esa nómina; al menos una debe ser mayor que cero.
4. Escribe un **Motivo** de 5 a 200 caracteres y presiona "Guardar captura".

Las fechas no pueden ser anteriores al ingreso, posteriores al fin del periodo que paga ni estar ya capturadas para el mismo empleado. Un aviso indica si pertenecen a un periodo ya calculado; esto no impide guardarlas. Para corregir una captura, elimínala y vuelve a capturarla. Si el periodo ya está pagado, puedes [reabrirlo](./procesar-nomina#como-reabrir-un-periodo-pagado) si cumple las condiciones. Un día omitido que aún no se haya capturado puede registrarse en el siguiente periodo.

## Cómo calcula

Cada día se suma a la nómina correspondiente con la tarifa guardada, sin cambiar los días ordinarios del periodo. La percepción fiscal está gravada. Consulta el desglose en [Detalle por empleado](./detalle-empleado#dias-pendientes-de-pago). Si capturas o eliminas después del cálculo, recalcula desde [Procesar nómina](./procesar-nomina).

Una captura con tarifa positiva no se paga en una nómina si el empleado no aparece en el cálculo de esa nómina. El aviso "días pendientes capturados no se pagarán en este cálculo" identifica estos casos: revisa su salario y frecuencia y recalcula. La captura no pagada no se pierde.

## Relacionado

- [Procesar nómina](./procesar-nomina)
- [Detalle por empleado](./detalle-empleado)
