---
title: "Bonos"
description: "Configurar y revisar los bonos de puntualidad, asistencia y extensión de jornada."
section: "pantallas"
order: 8
updated: "2026-10-21"
---

## Para qué sirve

Reúne, en tres pestañas, los bonos operativos de los podólogos: Puntualidad, Asistencia y Extensión de jornada.

## Antes de empezar

Aplican las mismas condiciones que en [Faltas](./faltas#antes-de-empezar): un usuario vinculado y activo, y horario capturado (ver [Preparar al empleado](./preparar-empleado)). Los bonos de Puntualidad y Asistencia también necesitan que la frecuencia de pago tenga configuración propia; sin ella, el empleado sale como "No evaluado".

## Qué ves en la pantalla

- **Puntualidad**: tabla con **Empleado**, **Retardos**, **Faltas**, **Incidencias**, **Máximo** (de incidencias permitidas), **Resultado** e **Importe**. Arriba, la tarjeta de configuración por frecuencia con el monto del bono y el máximo de incidencias.
- **Asistencia**: tabla con **Empleado**, **Faltas**, **Resultado** e **Importe**. Arriba, la tarjeta de configuración por frecuencia con el monto del bono.
- **Extensión de jornada**: tabla con **Empleado**, **Días con horario**, **Días trabajados**, **Bono** (asignado o no), **Importe estimado** y **Acción**. No tiene tarjeta de configuración: el monto y las horas están fijos en la app.

![Pestañas de bonos](captura:bonos-tabs)

## Cómo configurar Puntualidad o Asistencia

El botón de edición de la tarjeta de configuración ajusta, por frecuencia de pago, el monto del bono y, en Puntualidad, el máximo de incidencias permitidas.

## Cómo asignar la extensión de jornada

En la pestaña Extensión de jornada, el botón "Asignar" de cada fila activa el bono para ese empleado; "Quitar" lo desactiva. No tiene fecha de vigencia: aplica mientras esté activo.

## Cómo calcula

**Puntualidad**: las incidencias son la suma de retardos y faltas injustificados del periodo. Si no pasan del máximo configurado se cobra el bono completo; si lo pasan, se pierde por completo. Por ejemplo, con un bono de $500.00 y un máximo de 1 incidencia, un empleado con 1 retardo y 0 faltas conserva los $500.00; con 2 incidencias los pierde y cobra $0.00.

**Asistencia**: una sola falta injustificada en el periodo pierde el bono completo; los retardos no cuentan para este bono. Por ejemplo, con un bono de $500.00, un empleado sin faltas en el periodo cobra $500.00; con 1 falta cobra $0.00.

**Extensión de jornada**: paga una hora doble de salario por cada día con horario en el que el empleado checó, sin importar si llegó tarde. Por ejemplo, con un salario diario de $315.04 y 12 días trabajados en el periodo:

```
Bono = $315.04 × 2 ÷ 8 × 12 días = $945.12
```

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Horas extra](./horas-extra)
- [Faltas](./faltas)
- [Retardos](./retardos)
