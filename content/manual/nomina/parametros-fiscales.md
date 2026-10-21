---
title: "Parámetros fiscales"
description: "Capturar la UMA, el salario mínimo y las tarifas de ISR vigentes cada año."
section: "pantallas"
order: 10
updated: "2026-10-21"
---

## Para qué sirve

Aquí se capturan, cada año, los valores oficiales que la nómina fiscal necesita para calcular el ISR y el IMSS. La app no trae ningún valor precargado (salvo las tasas y los límites del IMSS, que son ley y no cambian cada año): hay que escribirlos a mano desde el DOF, el INEGI o el SAT.

## Antes de empezar

Ninguno.

## Qué ves en la pantalla

Tres pestañas. "Parámetros" lista los valores del año seleccionado — UMA diaria, mensual y anual; salario mínimo general y de zona fronteriza; el subsidio al empleo; y los siete valores del IMSS — con las columnas **Parámetro**, **Vigente desde**, **Valor** y **Capturado por**. "Tarifa ISR" tiene un selector Semanal | Mensual y la tabla de tramos: **Límite inferior**, **Límite superior**, **Cuota fija** y **% sobre el excedente**. "Percepciones" lista el tope de exención de cada concepto (horas extra, aguinaldo, PTU...) con las columnas **Clave SAT**, **Percepción**, **Tope de exención** y **Estatus**.

![Tabla de parámetros fiscales](captura:parametros-fiscales-tabla)

## Cómo capturar un parámetro

"Nuevo parámetro" pide el parámetro, su valor y la fecha desde la que es vigente; "Editar parámetro" solo cambia el valor de uno ya capturado — para moverlo a otra fecha hay que eliminarlo y crear uno nuevo.

## Cómo capturar la tarifa de ISR

Cada tramo se agrega o se edita con su límite inferior, su límite superior (vacío en el último tramo), su cuota fija y su porcentaje sobre el excedente. Si un tramo queda con un hueco respecto al siguiente, la pantalla lo marca; para mover un límite hay que editar primero el límite inferior del tramo siguiente y luego el límite superior del anterior. El botón "Copiar de {año anterior}" duplica los tramos de un año a otro.

## Cómo calcula

El ISR y el IMSS de cada periodo usan el valor vigente a la fecha de **fin** del periodo, no el valor capturado más reciente: si un valor cambia a mitad de un periodo, ese periodo sigue usando el que ya tenía.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Inicio de año: UMA, salario mínimo y tarifas de ISR](./tutorial-inicio-de-anio)
