---
title: "Detalle por empleado"
description: "Ver el desglose completo de percepciones, deducciones y neto de un empleado en el periodo."
section: "pantallas"
order: 3
updated: "2026-10-23"
---

## Para qué sirve

Muestra, para un empleado y un periodo ya calculado, cada percepción y cada deducción que forma su pago, una por una.

## Antes de empezar

El periodo debe estar calculado (ver [Procesar nómina](./procesar-nomina)); mientras esté en **Programada** esta pantalla solo muestra el aviso "Esta nómina aún no se calcula".

## Qué ves en la pantalla

El interruptor **Operativa** / **Fiscal** cambia de vista sin salir de la pantalla. La tarjeta "Percepciones totales" lista cada percepción que cobró el empleado (sueldo, comisiones, bonos...) y su suma. En la vista fiscal se agrega la tarjeta "Deducciones", con el ISR y, en un periodo ordinario, el IMSS, y termina con el renglón **Neto a pagar**. El botón "Regresar" vuelve a Procesar nómina, y "Anterior" / "Siguiente" pasan al empleado anterior o siguiente del mismo periodo sin salir del detalle.

![Detalle de percepciones de un empleado](captura:detalle-empleado-percepciones)

## Cómo llegar al detalle

Desde [Procesar nómina](./procesar-nomina), haz clic en el nombre de un empleado de la tabla.

## Cómo calcula

Cada percepción se muestra con la regla que la generó en lenguaje simple — por ejemplo, la comisión por consultas se describe como "N consultas × $importe del rango", y las horas extra como "N horas × tarifa". El total de percepciones, el ISR, el IMSS y el neto son siempre los que se guardaron al calcular el periodo en [Procesar nómina](./procesar-nomina); si algo no cuadra, hay que recalcular el periodo desde ahí, no se puede editar desde el detalle.

> [!WARNING]
> Con el periodo en **Aprobada** o **Pagada**, el cálculo queda congelado: ya no se puede recalcular desde [Procesar nómina](./procesar-nomina), así que lo que se ve aquí no cambia aunque se corrija una falta, un retardo o una hora extra. Para corregir algo hay que desaprobar el periodo primero (ver [Cómo desaprobar un periodo](./procesar-nomina#como-desaprobar-un-periodo)).

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Procesar nómina](./procesar-nomina)
