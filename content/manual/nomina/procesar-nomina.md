---
title: "Procesar nómina"
description: "Calcular la nómina de la sucursal y revisar el total que se paga a cada empleado."
section: "pantallas"
order: 2
updated: "2026-10-23"
---

## Para qué sirve

Calcula la nómina operativa y la nómina fiscal de un periodo, y muestra cuánto le toca a cada empleado elegible.

## Antes de empezar

El periodo debe existir (ver [Periodos](./periodos)), y cada empleado necesita su frecuencia y su salario capturados (ver [Preparar al empleado](./preparar-empleado#datos-personales)). Conviene revisar antes [Faltas](./faltas), [Retardos](./retardos) y [Horas extra](./horas-extra) del rango del periodo, porque cambian el resultado del cálculo.

## Qué ves en la pantalla

Arriba, un selector de periodo y un interruptor entre **Operativa** y **Fiscal**, más un filtro de puesto y un buscador por nombre. Debajo, tarjetas con el resumen: "Periodo", "Fecha de pago", "Empleados calculados" y "Total de percepciones" (en la vista fiscal se agregan "ISR retenido" y, en un periodo ordinario, "IMSS retenido"). La tabla trae una fila por empleado, con columnas como **Empleado**, **Puesto**, **Salario D.**, **Días**, **Sueldo**, las comisiones ("Com. consultas", "Com. onicomicosis", "Com. Ventas"), "Horas extra", "Vacaciones", los tres bonos ("Bono punt.", "Bono asist.", "Bono ext.") y **Total percepciones**; en la vista fiscal se agregan **ISR**, **IMSS** y **Neto**.

![Tabla de Procesar nómina](captura:procesar-nomina-tabla)

Una vez que el periodo se aprueba, debajo del título aparece un sello: "Aprobada por {nombre} el {fecha}"; si además ya se pagó, una segunda línea dice "Pagada por {nombre} el {fecha}". Debajo del encabezado, el plegable **"Historial de estatus"** (cerrado por defecto) lista, más reciente primero, cada aprobación, pago o desaprobación del periodo, con las columnas **Fecha**, **Autor**, **Cambio** (por ejemplo "En cálculo → Aprobada") y **Motivo** (el texto de la desaprobación, o "—" si no aplica). Solo aparece si el periodo ya tuvo al menos un cambio de estatus.

![Historial de estatus abierto](captura:procesar-nomina-historial)

## Cómo calcular el periodo

Con el periodo en **Programada**, el botón "Calcular nómina" genera el resultado de todos los empleados elegibles y lo deja guardado. Mientras esté **En cálculo**, "Recalcular" vuelve a generarlo desde cero con los datos actuales (los importes anteriores se pierden), y "Revertir a Programada" borra el cálculo por completo para poder editar las fechas del periodo otra vez.

## Cómo aprobar un periodo

Con el periodo **En cálculo**, el botón "Aprobar" abre un modal de confirmación con el título "¿Aprobar {código}?".

![Periodo en cálculo, listo para aprobar](captura:procesar-nomina-aprobar)

Si hay empleados con alguna retención sin calcular, o si el periodo no tiene ningún empleado calculado, el modal muestra una o varias advertencias en ámbar: "N empleado(s) con ISR no calculado", "N empleado(s) con IMSS no calculado" o "El periodo no tiene ningún empleado calculado". Estas advertencias no bloquean la aprobación, solo informan.

Al confirmar con "Aprobar", el periodo pasa a **Aprobada** y el cálculo queda congelado: ya no se puede recalcular, revertir, ni cambiar faltas, retardos u horas extra del periodo.

> [!WARNING]
> **Pagada** es definitiva. La única salida de **Aprobada** es desaprobar el periodo con un motivo (ver "Cómo desaprobar un periodo" más abajo); un periodo **Pagada** ya no se puede desaprobar ni revertir.

El botón "Aprobar" aparece deshabilitado mientras algún aviso "Recalcula la nómina" esté activo en el periodo (ver [Avisos y preguntas frecuentes](./avisos-y-preguntas#recalcula-la-nomina)); hay que recalcular primero.

## Cómo marcarlo como pagado

Con el periodo **Aprobada**, el botón "Marcar como pagada" abre un modal con el título "¿Marcar {código} como pagada?". Si la fecha de pago del periodo todavía no llega, el modal muestra la advertencia ámbar "La fecha de pago del periodo es el DD/MM/AAAA; aún no llega" — tampoco bloquea. Al confirmar, el periodo pasa a **Pagada**.

## Cómo desaprobar un periodo

Con el periodo **Aprobada**, el botón "Desaprobar" abre un modal con el título "¿Desaprobar {código}?" y un campo **Motivo** obligatorio, de 5 a 200 caracteres; el botón de confirmar permanece deshabilitado hasta que el texto tenga una longitud válida. Al confirmar, el periodo regresa a **En cálculo** y se puede volver a recalcular; el motivo capturado queda guardado en el "Historial de estatus".

## Cómo calcula

El sueldo de cada empleado es su salario diario por los días que le tocan pagar en el periodo, menos los días de falta y de retardo. Por ejemplo, un empleado con salario diario de $500.00 en un periodo semanal de 7 días, sin faltas ni retardos, cobra:

```
Sueldo = $500.00 × 7 días = $3,500.00
```

A ese sueldo se le suman las comisiones y los bonos que haya ganado en el periodo para llegar al **Total percepciones**. En la nómina fiscal, al total se le restan el ISR y, en un periodo ordinario, la cuota obrera del IMSS, para llegar al **Neto**.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Periodos](./periodos)
- [Detalle por empleado](./detalle-empleado)
