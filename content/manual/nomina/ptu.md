---
title: "PTU (reparto)"
description: "Repartir la PTU del ejercicio entre los empleados con derecho a ella."
section: "pantallas"
order: 9
updated: "2026-10-21"
---

## Para qué sirve

Calcula cuánto le toca de PTU (participación de los trabajadores en las utilidades) a cada empleado de la empresa en un ejercicio, a partir de la renta gravable que da el contador. El reparto es por empresa, no por sucursal: junta a los empleados de todas las sucursales de la misma razón social. Pagarlo es un paso aparte, ver [Repartir y pagar la PTU](./tutorial-ptu).

## Antes de empezar

Cada empleado necesita su categoría de PTU correcta en Datos fiscales del expediente: Normal, Confianza o Excluido (director, administrador o gerente general). Revisarla antes de precargar es importante: un director dejado como Normal cobra PTU que no le corresponde, y un trabajador de confianza dejado como Normal no se le topa su monto y sube el tope de los demás.

## Qué ves en la pantalla

El listado inicial muestra un reparto por ejercicio, con las columnas **Ejercicio**, **Persona**, **Fondo**, **Repartido**, **Remanente** y **Estado**. Dentro de un reparto, las tarjetas muestran el "Fondo a repartir" (y sus mitades "Por días trabajados" / "Por salario"), la "Base del reparto" (Total de días y Total de salario), los "Factores" usados y el "Remanente sin repartir". La tabla de trabajadores lista a cada uno con sus días, su salario, su PTU por días, su PTU por salario, el bruto, los topes aplicados y el monto final.

![Tabla de reparto de PTU](captura:ptu-reparto-tabla)

## Cómo crear y precargar un reparto

El botón "Nuevo reparto de PTU" pide el "Ejercicio de las utilidades", el "Tipo de persona" (moral o física), la "Renta gravable", la "PTU no cobrada del ejercicio anterior" y el "Factor de 3 meses de salario". Ya dentro del reparto, "Precargar trabajadores" trae a todos los empleados elegibles con sus días y su salario del ejercicio; se puede volver a precargar sin perder lo que ya se haya corregido a mano.

## Cómo editar o agregar un trabajador

El botón de edición de una fila ajusta sus días, su salario o su salario tope — por ejemplo, para corregir una incapacidad. Un trabajador que la precarga no haya traído se agrega a mano desde el buscador del reparto.

## Cómo cerrar o reabrir el reparto

Mientras el reparto esté en borrador, todo se puede editar. "Cerrar reparto" lo deja de solo lectura y congela los datos de cada trabajador con los que tiene ese día. "Reabrir reparto" lo regresa a borrador, pero no se puede si ya existe un periodo de nómina calculado que lo esté pagando.

## Cómo calcula

El fondo a repartir es el 10% de la renta gravable, más la PTU no cobrada del ejercicio anterior. La mitad del fondo se reparte entre todos los días trabajados, y la otra mitad entre todos los salarios, ambas a prorrata. Por ejemplo, con una renta gravable de $500,000.00 (fondo de $50,000.00, mitades de $25,000.00 cada una), si entre todos los trabajadores suman 1,000 días y $50,000.00 de salario del ejercicio, un trabajador con 100 días y $5,000.00 de salario recibe:

```
PTU por días    = $25,000.00 × (100 / 1,000)   = $2,500.00
PTU por salario = $25,000.00 × ($5,000 / $50,000) = $2,500.00
PTU bruta                                        = $5,000.00
```

Esa PTU bruta todavía puede reducirse por dos topes: el de 3 meses de salario y el promedio de los últimos 3 años con datos (se aplica el mayor de los dos), y los trabajadores de categoría Confianza además tienen un tope de 120% sobre el salario más alto de los trabajadores Normales.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Repartir y pagar la PTU](./tutorial-ptu)
- [Preparar al empleado](./preparar-empleado)
