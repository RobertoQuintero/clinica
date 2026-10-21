---
title: "Periodos"
description: "Crear, editar y eliminar los periodos de pago de la sucursal."
section: "pantallas"
order: 1
updated: "2026-10-21"
---

## Para qué sirve

Aquí se crean, editan y eliminan los periodos de pago de la sucursal: el calendario que luego usa [Procesar nómina](./procesar-nomina) para calcular el sueldo de cada empleado.

## Antes de empezar

Cada empleado necesita su **"Periodo de pago"** capturado en su expediente (ver [Preparar al empleado](./preparar-empleado#datos-personales)) para poder entrar a un periodo de esa frecuencia. Un empleado sin frecuencia nunca entra a ningún periodo, sin importar su salario.

## Qué ves en la pantalla

La tarjeta "Periodo activo en curso" muestra el periodo que incluye el día de hoy, con una línea de tiempo de Inicio, Corte, Pago y Fin. Debajo, pestañas filtran por frecuencia ("Todos", "Semanal", "Extraordinaria"...), con selectores de estatus y de ejercicio y un buscador por código. La tabla lista cada periodo con las columnas **Código**, **Tipo**, **Rango**, **Corte**, **Fecha de pago** y **Estatus**, y en **Acciones** un enlace "Procesar" hacia [Procesar nómina](./procesar-nomina).

![Listado de periodos](captura:periodos-listado)

## Cómo crear un periodo

El botón "Nuevo periodo de nómina" abre un formulario. Primero se elige el "Tipo de periodo": Ordinaria (la nómina normal, por frecuencia), Aguinaldo o PTU (periodos extraordinarios; ver [Pagar el aguinaldo](./tutorial-aguinaldo) y [Repartir y pagar la PTU](./tutorial-ptu)). Para un periodo ordinario se elige la frecuencia; la app sugiere las cuatro fechas (Inicio, Fin, Corte de asistencias, Pago) y todas se pueden ajustar antes de guardar.

## Cómo editar o eliminar un periodo

Mientras un periodo esté en estado **Programada**, sus acciones muestran un lápiz y un bote de basura: el lápiz solo deja cambiar las cuatro fechas, y el bote de basura lo elimina por completo. Ninguno de los dos está disponible una vez que el periodo pasa a **En cálculo**.

## Cómo calcula

El código de cada periodo se arma solo, con el formato `NOM-{ejercicio}-{letra}{consecutivo}` — por ejemplo, el segundo periodo semanal de 2026 es `NOM-2026-S02`. Si ese periodo se elimina más adelante, el siguiente periodo semanal que se cree sigue siendo `NOM-2026-S03`, nunca vuelve a usar el `S02`: el código identifica al periodo, no cuenta cuántos hay.

## Avisos de esta pantalla

Ver [Avisos y preguntas frecuentes](./avisos-y-preguntas).

## Relacionado

- [Procesar nómina](./procesar-nomina)
- [Conceptos básicos](./conceptos-basicos)
