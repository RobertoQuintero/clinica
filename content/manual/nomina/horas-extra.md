---
title: "Horas extra"
description: "Revisar y autorizar las horas extra detectadas por las checadas."
section: "pantallas"
order: 5
updated: "2026-10-23"
---

## Para qué sirve

Muestra las horas extra que la app detecta a partir de las checadas de cada empleado, para autorizarlas, rechazarlas o dejarlas pendientes. Las horas autorizadas se pagan al calcular la nómina del periodo.

## Antes de empezar

El empleado necesita su horario capturado (ver [Preparar al empleado](./preparar-empleado#horario)); sin horario, la app no puede saber qué es tiempo extra y no detecta nada.

## Qué ves en la pantalla

La tabla lista un día por fila, con las columnas **Empleado**, **Día**, **Horario**, **Checadas**, **Detectadas**, **Estado**, **Autorizadas** y **Comentario**. Arriba, la tarjeta de configuración muestra "Límite de horas dobles por periodo" y "Tope de horas por día".

![Tabla de horas extra](captura:horas-extra-tabla)

## Cómo decidir un día

El botón de la fila abre un modal con tres opciones: "Autorizar" (se puede ajustar el número de horas), "Rechazar" o, si ya tiene una decisión, "Volver a pendiente".

> [!WARNING]
> Con el periodo en **Aprobada** o **Pagada**, la pantalla queda de solo lectura: desaparece la columna de acciones y ningún día se puede autorizar, rechazar o devolver a pendiente. Para corregir algo hay que desaprobar el periodo primero (ver [Cómo desaprobar un periodo](./procesar-nomina#como-desaprobar-un-periodo)).

## Cómo calcula

La hora extra es el tiempo trabajado fuera del horario capturado del empleado, redondeado hacia abajo a bloques de 30 minutos. Dentro de las horas autorizadas, las primeras hasta el "Límite de horas dobles por periodo" se pagan dobles y el resto triples. Por ejemplo, con un límite de 9 horas dobles y un salario diario de $400.00 (tarifa por hora $50.00), un empleado con 12 horas autorizadas en la semana cobra:

```
9 horas dobles  × $50.00 × 2 = $900.00
3 horas triples × $50.00 × 3 = $450.00
Total                        = $1,350.00
```

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Preparar al empleado](./preparar-empleado#horario)
- [Procesar nómina](./procesar-nomina)
