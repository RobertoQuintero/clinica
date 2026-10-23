---
title: "Retardos"
description: "Revisar los retardos que descuentan medio día o más de la nómina."
section: "pantallas"
order: 7
updated: "2026-10-23"
---

## Para qué sirve

Muestra los retardos detectados por la primera checada de entrada del día, para justificarlos o dejarlos como descuento.

## Antes de empezar

Aplican las mismas dos condiciones que en [Faltas](./faltas#antes-de-empezar): un usuario vinculado y activo, y horario capturado (ver [Preparar al empleado](./preparar-empleado)).

## Qué ves en la pantalla

La tabla lista un retardo por fila, con las columnas **Empleado**, **Día**, **Programada**, **Primera entrada**, **Minutos tarde**, **Tipo**, **Estado** y **Justificante o comentario**. El filtro "Tipo" separa los retardos "Graves" de los "Acumulables"; el de estado es igual al de Faltas.

![Tabla de retardos](captura:retardos-tabla)

## Cómo justificar un retardo

Igual que en Faltas: "Subir justificante" adjunta un comprobante, "No aplica" lo descarta con un comentario obligatorio, y "Volver a injustificado" deshace cualquiera de los dos.

> [!WARNING]
> Con el periodo en **Aprobada** o **Pagada**, la pantalla queda de solo lectura: desaparece la columna de acciones y ningún retardo se puede justificar, marcar como "No aplica" o devolver a injustificado. Para corregir algo hay que desaprobar el periodo primero (ver [Cómo desaprobar un periodo](./procesar-nomina#como-desaprobar-un-periodo)).

## Cómo calcula

Un retardo **grave** (por ejemplo, de 30 minutos o más) descuenta medio día completo. Los retardos **acumulables** (los que no llegan a grave) se van sumando y descuentan según una tabla de escalones configurada por frecuencia de pago — por ejemplo, para la frecuencia semanal, 1 retardo acumulable descuenta 0.5 días y 2 o más descuentan 1 día completo. Así, un empleado semanal con salario diario de $500.00, sin faltas y con 2 retardos acumulables en el periodo, cobra:

```
Sueldo = $500.00 × (7 − 1) días = $3,000.00
```

el mismo descuento que una falta completa, aunque haya llegado a trabajar los 7 días.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Faltas](./faltas)
