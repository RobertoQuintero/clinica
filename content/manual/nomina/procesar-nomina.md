---
title: "Procesar nómina"
description: "Calcular la nómina de la sucursal y revisar el total que se paga a cada empleado."
section: "pantallas"
order: 2
updated: "2026-10-21"
---

## Para qué sirve

Calcula la nómina operativa y la nómina fiscal de un periodo, y muestra cuánto le toca a cada empleado elegible.

## Antes de empezar

El periodo debe existir (ver [Periodos](./periodos)), y cada empleado necesita su frecuencia y su salario capturados (ver [Preparar al empleado](./preparar-empleado#datos-personales)). Conviene revisar antes [Faltas](./faltas), [Retardos](./retardos) y [Horas extra](./horas-extra) del rango del periodo, porque cambian el resultado del cálculo.

## Qué ves en la pantalla

Arriba, un selector de periodo y un interruptor entre **Operativa** y **Fiscal**, más un filtro de puesto y un buscador por nombre. Debajo, tarjetas con el resumen: "Periodo", "Fecha de pago", "Empleados calculados" y "Total de percepciones" (en la vista fiscal se agregan "ISR retenido" y, en un periodo ordinario, "IMSS retenido"). La tabla trae una fila por empleado, con columnas como **Empleado**, **Puesto**, **Salario D.**, **Días**, **Sueldo**, las comisiones ("Com. consultas", "Com. onicomicosis", "Com. Ventas"), "Horas extra", "Vacaciones", los tres bonos ("Bono punt.", "Bono asist.", "Bono ext.") y **Total percepciones**; en la vista fiscal se agregan **ISR**, **IMSS** y **Neto**.

![Tabla de Procesar nómina](captura:procesar-nomina-tabla)

## Cómo calcular el periodo

Con el periodo en **Programada**, el botón "Calcular nómina" genera el resultado de todos los empleados elegibles y lo deja guardado. Mientras esté **En cálculo**, "Recalcular" vuelve a generarlo desde cero con los datos actuales (los importes anteriores se pierden), y "Revertir a Programada" borra el cálculo por completo para poder editar las fechas del periodo otra vez.

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
