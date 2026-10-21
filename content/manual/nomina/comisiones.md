---
title: "Comisiones"
description: "Configurar la comisión por consultas y la comisión por tratamientos de onicomicosis."
section: "pantallas"
order: 4
updated: "2026-10-21"
---

## Para qué sirve

Aquí se configuran dos de las tres comisiones operativas: por consultas atendidas y por tratamientos de onicomicosis liquidados. La tercera, por venta de productos, no se configura aquí: su monto se captura por producto en el catálogo de Productos; esta pantalla no la muestra, aunque sí aparece después en [Procesar nómina](./procesar-nomina).

## Antes de empezar

Ninguno.

## Qué ves en la pantalla

La tabla "Rango de consultas" / "Comisión fija" lista los tramos de la comisión por consultas, con sus acciones de editar y eliminar. Debajo, la tarjeta de la comisión por tratamientos muestra "Importe por tratamiento" y "Umbral de liquidación", con la fecha y el usuario del último cambio.

![Tabla de rangos de comisión por consultas](captura:comisiones-tiers)

## Cómo editar un rango de comisión por consultas

El botón de edición de cada renglón ajusta su rango de consultas y su comisión fija; los rangos no se pueden traslapar entre sí.

## Cómo configurar la comisión por tratamientos

El botón de edición de la tarjeta ajusta el "Importe por tratamiento" (lo que se paga una sola vez por cada tratamiento liquidado) y el "Umbral de liquidación" (la suma de pagos parciales con la que un tratamiento se considera pagado).

## Cómo calcula

La comisión por consultas paga un importe fijo según en qué rango cae el **total** de consultas atendidas en el periodo, no un monto por cada consulta. Por ejemplo, con los rangos 1–10 → $100.00, 11–25 → $200.00, 26–35 → $300.00 y 36 o más → $500.00, un empleado con 18 consultas atendidas cae en el rango 11–25 y cobra $200.00, lo mismo que si hubiera atendido 11.

La comisión por tratamientos paga el importe configurado por cada tratamiento de onicomicosis liquidado en el periodo. Por ejemplo, con un importe de $500.00 por tratamiento, un empleado que liquidó 3 tratamientos cobra 3 × $500.00 = $1,500.00.

## Avisos de esta pantalla

Esta pantalla no muestra avisos propios. Los cambios aquí son inmediatos para periodos futuros, pero no modifican un periodo ya calculado hasta que se recalcule desde [Procesar nómina](./procesar-nomina).

## Relacionado

- [Procesar nómina](./procesar-nomina)
