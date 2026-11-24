---
title: "Detalle por empleado"
description: "Ver el desglose completo de percepciones, deducciones y neto de un empleado en el periodo."
section: "pantallas"
order: 3
updated: "2026-11-24"
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
> Con el periodo en **Aprobada** o **Pagada**, el cálculo queda congelado. Para corregirlo, desaprueba el periodo aprobado o [reabre el pagado](./procesar-nomina#como-reabrir-un-periodo-pagado) si cumple las condiciones.

## Días pendientes de pago

En un periodo ordinario, la percepción **Días pendientes de pago** y su lista muestran los días capturados, sus tarifas y montos. Se incluyen al calcular o recalcular; para corregir la captura visita [Días pendientes de pago](./dias-pendientes).

## Salario diario integrado

En la vista fiscal, la tarjeta **Salario diario integrado** muestra el salario fiscal, fecha de ingreso, antigüedad al cierre, días de vacaciones y aguinaldo, prima vacacional, factor y origen. Se calcula con prestaciones fijas: 15 días de aguinaldo, vacaciones según antigüedad y prima vacacional de 25 %. No incluye prestaciones superiores ni pagos variables; consulta al contador sobre su aplicación.

Si falta en un periodo histórico, la app lo prepara al timbrar con el salario fiscal guardado y la fecha de ingreso disponible. "Calcular SDI" o "Regenerar SDI" permite prepararlo cuando no hay un recibo en proceso, timbrado o con cancelación en proceso en ninguno de los modos. Si aparece un error, revisa el motivo y los datos del empleado. El SDI enviado al CFDI es distinto del **SBC** registrado en IMSS, que se usa para la cuota obrera y el campo correspondiente del comprobante.

## CFDI de nómina

En la vista fiscal de un periodo ordinario, la tarjeta de CFDI muestra el estado y los motivos que impiden timbrar. Desde aquí puedes timbrar o reintentar, cancelar un recibo y consultar una cancelación pendiente. Descarga el XML y PDF del comprobante timbrado; en **Recibos cancelados** también están el XML, PDF y acuse de cancelación. Consulta [Procesar nómina](./procesar-nomina#como-timbrar-los-recibos) para los requisitos y el procedimiento.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Procesar nómina](./procesar-nomina)
