---
title: "Faltas"
description: "Revisar las faltas injustificadas que descuentan días de la nómina."
section: "pantallas"
order: 6
updated: "2026-10-21"
---

## Para qué sirve

Muestra los días sin ninguna checada de los podólogos, para justificarlos o dejarlos como falta.

## Antes de empezar

Solo se controlan los podólogos con un usuario vinculado y activo (ver [Preparar al empleado](./preparar-empleado#usuarios)) y con horario capturado (ver [Preparar al empleado](./preparar-empleado#horario)). Un podólogo sin usuario vinculado nunca aparece aquí, y tampoco genera ningún aviso: hay que revisarlo a mano.

## Qué ves en la pantalla

La tabla lista un día por fila, con las columnas **Empleado**, **Día**, **Horario** y **Estado**, más el **Justificante o comentario**. Los filtros de estado son "Todas", "Injustificadas", "Justificadas", "No aplica", "Vacaciones" y "Día económico" — estos dos últimos son de solo lectura: los días de vacaciones o de día económico no se marcan desde aquí, se excluyen solos.

![Tabla de faltas](captura:faltas-tabla)

## Cómo justificar una falta

"Subir justificante" adjunta un PDF o una imagen (máximo 5 MB) como comprobante. "No aplica" la descarta con un comentario obligatorio, para días como un feriado o una falla del checador. Ambas se pueden deshacer con "Volver a injustificada".

## Cómo calcula

Una falta injustificada resta un día de los días que se pagan en el periodo. Por ejemplo, un empleado con salario diario de $500.00 en un periodo semanal de 7 días, con 1 falta injustificada, cobra:

```
Sueldo = $500.00 × (7 − 1) días = $3,000.00
```

en vez de los $3,500.00 que cobraría sin esa falta.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Retardos](./retardos)
- [Preparar al empleado](./preparar-empleado#usuarios)
