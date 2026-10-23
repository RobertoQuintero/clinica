---
title: "Avisos y preguntas frecuentes"
description: "Qué significa cada aviso de nómina y qué hacer para resolverlo."
section: "avisos"
order: 1
updated: "2026-10-23"
---

Esta página reúne los avisos que pueden aparecer en las pantallas de nómina, qué significan y qué hacer con cada uno.

## "Recalcula la nómina"

Aparece en [Procesar nómina](./procesar-nomina), [Horas extra](./horas-extra), [Faltas](./faltas), [Retardos](./retardos) y [Bonos](./bonos) cuando algo cambió después del último cálculo del periodo: una hora extra autorizada o rechazada, una falta o un retardo justificado, una decisión de bono, o un cambio en los parámetros fiscales (ISR, IMSS, exenciones, vacaciones o primas) posterior al cálculo. El mensaje siempre nombra qué dejó de coincidir, por ejemplo "Hay retardos que no coinciden con el último cálculo. Recalcula la nómina."

**Qué hacer:** entra a [Procesar nómina](./procesar-nomina) y presiona "Recalcular". Solo aparece con el periodo en **En cálculo**; en **Programada** todavía no hay nada que recalcular. Mientras este aviso esté activo, el botón "Aprobar" aparece deshabilitado: hay que recalcular antes de poder aprobar el periodo.

![Aviso de recálculo pendiente](captura:aviso-recalcula)

## "No calculado"

En la tabla de [Procesar nómina](./procesar-nomina), vista fiscal, las columnas **ISR** e **IMSS** muestran "No calculado" en el renglón de un empleado al que no se le pudo calcular esa retención en el periodo. Encima de la tabla, un aviso ámbar agrupa a todos los empleados en esa situación ("N empleados quedaron sin ISR calculado" / "sin IMSS calculado") con el motivo exacto de cada grupo. El aviso de IMSS solo aparece en un periodo ordinario, nunca en uno extraordinario (aguinaldo o PTU).

El aviso enlaza a donde se corrige: la pestaña correspondiente de [Parámetros fiscales](./parametros-fiscales) cuando falta una tarifa o un parámetro del ejercicio, o el expediente del empleado cuando le falta un dato propio (su NSS o su SBC, ver [Preparar al empleado](./preparar-empleado#imss)).

**Qué hacer:** sigue el enlace del aviso ("Revisar la tarifa", "Revisar los parámetros" o el nombre del empleado), captura lo que falte y recalcula la nómina desde [Procesar nómina](./procesar-nomina). Mientras el dato falte, a ese empleado no se le retiene ISR ni IMSS en ese periodo. Al aprobar el periodo, estos mismos empleados aparecen en el modal de aprobación como advertencia ámbar ("N empleado(s) con ISR no calculado" / "con IMSS no calculado"); esa advertencia no bloquea la aprobación.

## "N empleados sin horario definido"

Aparece en [Horas extra](./horas-extra), [Faltas](./faltas), [Retardos](./retardos) y [Bonos](./bonos) cuando uno o más podólogos no tienen capturado su horario semanal. Sin horario la app no puede saber qué es tiempo extra, qué día es de descanso, ni cuándo debió checar, así que a estos empleados no se les detecta nada en esa pantalla.

**Qué hacer:** el aviso trae un enlace directo a cada empleado; ábrelo y captura su horario semanal en la pestaña Horario del expediente (ver [Preparar al empleado](./preparar-empleado#horario)).

## "N empleados no entran a la nómina operativa/fiscal"

Aparece en [Procesar nómina](./procesar-nomina) cuando uno o más empleados elegibles (misma frecuencia y sucursal que el periodo) se quedaron fuera de esa nómina porque les falta su salario diario (operativa) o su salario diario fiscal (fiscal). La app no usa el salario de una nómina como respaldo de la otra: un empleado puede faltarle uno y tener el otro.

**Qué hacer:** abre la ficha del empleado desde el enlace del aviso, captura el salario que falte en Datos personales (ver [Preparar al empleado](./preparar-empleado#datos-personales)) y recalcula la nómina.

## "Checada incompleta"

Aparece en [Horas extra](./horas-extra) cuando un día tiene una entrada sin su salida correspondiente (o al revés), así que no se puede saber cuánto trabajó ese día. No cuenta como hora extra.

**Qué hacer:** revisa la pestaña Asistencia del expediente del empleado (ver [Preparar al empleado](./preparar-empleado#asistencia)) y confirma que su identificador del checador esté dado de alta; una checada faltante no se puede capturar a mano desde nómina.

## Aviso de fecha límite del aguinaldo o de la PTU

Desde el 1 de diciembre, [Periodos](./periodos) y [Procesar nómina](./procesar-nomina) muestran un aviso si la sucursal todavía no tiene su periodo extraordinario de aguinaldo del año: en ámbar mientras falten días para el 20 de diciembre, y en rojo a partir del día siguiente (ver [Pagar el aguinaldo](./tutorial-aguinaldo)). Lo mismo ocurre con la PTU una vez que la empresa cierra el reparto del ejercicio anterior, con su propia fecha límite según el tipo de persona (ver [Repartir y pagar la PTU](./tutorial-ptu)).

**Qué hacer:** sigue el enlace "Crear la nómina extraordinaria" del aviso. Basta con **crear** el periodo para que el aviso desaparezca; no hace falta calcularlo de inmediato, aunque conviene hacerlo antes de la fecha límite.

## Preguntas frecuentes

**¿Por qué el botón "Aprobar" aparece deshabilitado?**
Porque hay un aviso "Recalcula la nómina" activo en el periodo: el cálculo guardado ya no coincide con los datos actuales. Entra a [Procesar nómina](./procesar-nomina) y presiona "Recalcular" antes de aprobar.

**¿Puedo deshacer un periodo aprobado o pagado?**
Un periodo **Aprobada** se puede desaprobar con un motivo, y regresa a **En cálculo**. Un periodo **Pagada** es definitivo: no se puede desaprobar ni revertir. Ver [Procesar nómina](./procesar-nomina#como-desaprobar-un-periodo).

**¿Por qué ya no puedo editar las faltas, los retardos o las horas extra de este periodo?**
Porque el periodo está en **Aprobada** o **Pagada** y el cálculo quedó congelado. Para volver a editar hay que desaprobar el periodo primero desde [Procesar nómina](./procesar-nomina#como-desaprobar-un-periodo).

**¿Por qué un empleado no aparece en ninguna nómina, ni siquiera en el aviso de excluidos?**
Casi siempre porque le falta su "Periodo de pago" en Datos personales. Un empleado sin esa frecuencia capturada nunca entra a ningún periodo de esa frecuencia, y tampoco genera el aviso de excluido: hay que revisar su expediente a mano (ver [Preparar al empleado](./preparar-empleado#datos-personales)).

**¿Pierdo algo si recalculo un periodo que ya tenía horas extra, faltas o retardos decididos?**
No. Las decisiones (autorizar, rechazar, justificar) son independientes del cálculo y se vuelven a aplicar al recalcular. Lo que cambia son los montos, que se recalculan con los datos actuales.

## Relacionado

- [Procesar nómina](./procesar-nomina)
- [Preparar al empleado para nómina](./preparar-empleado)
