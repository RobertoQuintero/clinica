# 100 — Salario diario integrado para CFDI de nómina

## Header

- **Estado:** Implementado
- **Depende de:** 53 (cálculo de salario), 91 (cuota obrera IMSS y SBC) y 98 (timbrado de CFDI ordinario).
- **Modifica base de datos:** Sí; agrega `payroll.period_employee_sdi`.
- **Fecha:** 2026-11-24
- **Objetivo:** Calcular y guardar el salario diario integrado fijo de cada empleado para incorporarlo al CFDI de nómina, usando su salario fiscal y las prestaciones mínimas.

## Alcance

### Entra

- Calcular el salario diario integrado (SDI) fijo con el salario diario fiscal del periodo, 15 días de aguinaldo, prima vacacional del 25 % y días de vacaciones según la antigüedad al cierre del periodo.
- Guardar el resultado y sus componentes al calcular la nómina fiscal y mostrarlos en el detalle fiscal del empleado.
- Enviar el SDI guardado en `SalarioDiarioIntegrado` del CFDI. Mantener el SBC capturado como fuente independiente de `SalarioBaseCotApor` y del cálculo de la cuota obrera.
- Para periodos anteriores sin SDI guardado, calcularlo y guardarlo antes de timbrar, usando el salario fiscal congelado del periodo y la fecha de ingreso disponible. Permitir regenerarlo explícitamente antes de emitir un CFDI vigente.
- Bloquear el timbrado con un mensaje claro si no es posible calcular el SDI por falta de datos.
- Actualizar la documentación técnica del módulo.

### No entra

- Integrar bonos, comisiones u otras percepciones variables, o configurar prestaciones superiores a los mínimos.
- Calcular o actualizar el SBC de IMSS, generar movimientos para IDSE o modificar la cuota obrera.
- Modificar CFDI ya emitidos o incorporar timbrado de nóminas extraordinarias.
- Actualizar el manual de usuario.

## Modelo de datos

Agregar `payroll.period_employee_sdi`, con una fila por empleado y periodo fiscal, vinculada a `payroll.period_employees`. Guardar salario diario fiscal, fecha de ingreso, fecha de referencia, antigüedad, días de vacaciones, días de aguinaldo, porcentaje de prima vacacional, factor de integración, SDI calculado y origen del cálculo: procesamiento de nómina o preparación del timbrado de un periodo anterior.

El cálculo de un periodo anterior se guarda antes de timbrar para que un reintento use los mismos datos. La tabla de SBC permanece independiente. Los CFDI ya emitidos conservan su comprobante original.

## Plan de implementación

1. Agregar la tabla y la migración correspondiente en `queries.txt`, con relación al registro fiscal del periodo.
2. Implementar `SDI = salario diario fiscal × (1 + (15 + días de vacaciones × 0.25) / 365)`. Usar 12 días de vacaciones desde el ingreso, 14 después del primer aniversario y los tramos sucesivos por antigüedad. Mantener la precisión durante el cálculo y redondear el SDI final a dos decimales.
3. Integrar el cálculo al procesamiento de la nómina fiscal y guardar los datos utilizados junto con el resultado. Si faltan datos, conservar el motivo para impedir el timbrado.
4. Mostrar el SDI y sus componentes en el detalle fiscal. Para periodos anteriores sin registro, calcularlo y guardarlo antes del primer intento de timbrado; permitir regenerarlo explícitamente mientras no exista un CFDI vigente.
5. Usar el SDI guardado en `SalarioDiarioIntegrado` y conservar el SBC para `SalarioBaseCotApor`. Bloquear el timbrado si no puede calcularse el SDI.
6. Actualizar la documentación técnica y verificar el cálculo, los periodos anteriores, los reintentos y el contenido enviado al proveedor.

## Criterios de aceptación

- [ ] El SDI usa el salario fiscal del periodo y la antigüedad a su cierre, con las prestaciones y el redondeo acordados.
- [ ] El cálculo y sus componentes quedan guardados y visibles en el detalle fiscal.
- [ ] El CFDI recibe el SDI calculado y el SBC capturado en sus respectivos campos.
- [ ] Los periodos anteriores calculan y guardan el SDI al timbrar; se puede regenerar antes de emitir un CFDI vigente.
- [ ] Si faltan datos para calcular el SDI, el timbrado se bloquea e indica la causa.
- [ ] El cálculo de la cuota obrera y los CFDI ya emitidos conservan su comportamiento.
- [ ] Las pruebas cubren aniversarios, redondeo, datos faltantes, periodos anteriores y reintentos.

### Escenarios de verificación

Las casillas marcadas tienen evidencia ejecutada; las pendientes requieren una prueba adicional. La prueba de base de datos usa una transacción que se revierte al terminar.

- Cálculo y prestaciones:
  - [x] Antes y después del primer aniversario cambia de 12 a 14 días de vacaciones.
  - [x] Se aplican los tramos comprobados de cinco y diez años, y el aniversario de ingreso el 29 de febrero.
  - [x] Se redondea el importe final a dos decimales para el caso probado.
  - [x] Se comprueban los cambios de tramo antes y en los aniversarios de uno a cinco, diez, quince, veinte, veinticinco y treinta años.
  - [ ] Comprobar el cálculo durante el procesamiento fiscal completo.
- Registro y detalle:
  - [x] Un periodo histórico sin registro guarda el cálculo y sus componentes básicos con origen de timbrado en la base migrada.
  - [x] En Chrome, el detalle fiscal histórico sin registro informa que el SDI se calculará al preparar el timbrado y ofrece calcularlo cuando el recibo está pendiente.
  - [ ] Comprobar el registro durante el procesamiento y la visualización de todos sus componentes en el detalle fiscal autenticado.
- CFDI y SBC:
  - [x] El cuerpo construido para el proveedor conserva importes distintos para SDI y SBC en sus campos correspondientes.
  - [ ] Comprobar el flujo completo desde el registro congelado hasta la solicitud al proveedor.
- Históricos y reintentos:
  - [x] El SQL de preparación crea un registro histórico con el resultado esperado y una segunda lectura conserva sus valores.
  - [ ] Comprobar un reintento real de timbrado que reutilice el registro sin recalcularlo.
  - [x] En Chrome, el detalle de un recibo de prueba vigente no muestra el botón para calcular o regenerar el SDI.
  - [ ] Comprobar la regeneración sin CFDI vigente y su rechazo cuando existe uno vigente o en proceso.
- Datos faltantes:
  - [x] El cálculo rechaza salario o fechas ausentes, fechas inválidas y fecha de ingreso posterior al cierre con un motivo.
  - [ ] Comprobar que el flujo de timbrado se bloquea y presenta el motivo sin solicitar un CFDI al proveedor.
- Regresiones:
  - [ ] Comprobar que la cuota obrera conserva su resultado con el SBC capturado.
  - [ ] Comprobar que un CFDI ya emitido permanece sin cambios.

## Decisiones tomadas y descartadas

- **Sí:** calcular el SDI fijo y congelarlo por periodo para reproducir el importe enviado al CFDI.
- **Sí:** usar mínimos legales y el salario fiscal del periodo para no depender del salario actual.
- **Sí:** conservar el SBC manual independiente para IMSS.
- **Sí:** permitir regenerar el cálculo de periodos anteriores antes de emitir un CFDI vigente.
- **No:** integrar percepciones variables o prestaciones configurables; requieren una especificación aparte.
- **No:** actualizar el manual de usuario en esta especificación.

## Riesgos identificados

- **SDI incompleto:** al excluir percepciones variables o prestaciones superiores, el resultado puede no reflejar todas las prestaciones del empleado. El contador debe validar que el cálculo fijo sea aplicable.
- **Históricos:** se usa la fecha de ingreso disponible al timbrar; si fue corregida posteriormente, podría no reflejar el dato registrado originalmente.

## Qué no incluye esta spec

Percepciones variables, prestaciones configurables, cálculo del SBC, movimientos IDSE, cambios a CFDI emitidos, timbrado extraordinario y actualización del manual de usuario.
