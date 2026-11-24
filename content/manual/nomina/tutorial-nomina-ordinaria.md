---
title: "Pagar una nómina ordinaria de principio a fin"
description: "Pasos para calcular y revisar una nómina ordinaria de principio a fin."
section: "tutoriales"
order: 1
updated: "2026-11-24"
---

## Qué vas a lograr

Calcular el periodo, revisar las incidencias, aprobarlo, marcarlo como pagado y timbrar sus recibos fiscales.

## Antes de empezar

El periodo debe existir y los empleados deben tener su frecuencia y salario capturados.

## Pasos

1. Abre [Periodos](./periodos) y confirma las fechas del periodo.
2. Revisa [Faltas](./faltas), [Retardos](./retardos), [Horas extra](./horas-extra) y [Días pendientes de pago](./dias-pendientes) del periodo.
3. Abre [Procesar nómina](./procesar-nomina) y calcula el periodo.

![Periodo recién calculado](captura:tutorial-nomina-paso-1)

4. Con el periodo **En cálculo** y sin avisos de "Recalcula" pendientes, presiona "Aprobar" y confirma (ver [Cómo aprobar un periodo](./procesar-nomina#como-aprobar-un-periodo)).
5. Cuando llegue la fecha de pago, presiona "Marcar como pagada" y confirma (ver [Cómo marcarlo como pagado](./procesar-nomina#como-marcarlo-como-pagado)).

![Periodo aprobado y pagado](captura:procesar-nomina-sello)

6. Cambia a **Fiscal**, revisa los requisitos y avisos de CFDI y presiona "Timbrar" por empleado o "Timbrar pendientes" (ver [Cómo timbrar los recibos](./procesar-nomina#como-timbrar-los-recibos)).
7. Abre el [detalle del empleado](./detalle-empleado#cfdi-de-nomina) para revisar el estado y descargar el XML y PDF.

## Cómo saber que quedó bien

La tabla de Procesar nómina muestra un renglón por cada empleado elegible, sin avisos de "Recalcula" pendientes, y el periodo termina en **Pagada** con su sello de aprobación y pago. En Fiscal, los recibos correspondientes aparecen como "Timbrado" o "Prueba" según el modo del emisor.

## Errores comunes

Calcular antes de resolver las faltas o los retardos pendientes cambia el total una vez que se recalcula. Aprobar el periodo lo congela; si ya está pagado, consulta las condiciones para reabrirlo antes de corregirlo.
