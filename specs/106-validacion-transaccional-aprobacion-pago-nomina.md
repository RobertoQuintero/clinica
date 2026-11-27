# SPEC 106 — Validación transaccional al aprobar y pagar nómina

> **Estado:** Implementado
> **Depende de:** SPEC 94 y SPEC 96.
> **Fecha:** 2026-11-27
> **Objetivo:** Evitar que cambios concurrentes invaliden las comprobaciones de nómina durante la aprobación o el pago de un periodo.

## Alcance

**Entra:**

- Al aprobar, comprobar los avisos de recálculo y cambiar el estatus en una transacción que impida que cambios concurrentes invaliden esas comprobaciones antes de confirmar la operación.
- Al pagar, aplicar la misma garantía a la comprobación de empleados elegibles faltantes, conservando la regla actual de bloqueo.
- Mantener las validaciones de sucursal y estatus, los sellos de aprobación y pago y la bitácora de transiciones.
- Verificar la concurrencia contra una base SQL Server de prueba y agregar pruebas automatizadas de las acciones.
- Actualizar la documentación técnica y registrar la atención de D1 en la auditoría con la evidencia obtenida.

**No entra:**

- Agregar al pago otros bloqueos por avisos de recálculo.
- Revertir automáticamente una aprobación o un pago por cambios posteriores a su confirmación.
- Resolver las capturas retroactivas ni los demás riesgos de D2.
- Atender otros hallazgos de la auditoría.

## Modelo de datos

Esta spec no introduce tablas ni columnas. Reutiliza:

- `payroll.periods`, para validar el estatus y registrar los sellos de aprobación y pago.
- `payroll.period_status_log`, para conservar la transición en la misma transacción.
- Las tablas existentes que alimentan los avisos de recálculo y la comprobación de empleados elegibles.

La implementación deberá coordinar las lecturas y escrituras concurrentes mediante transacciones y bloqueos de SQL Server, incluidos los casos en que todavía no exista una fila que cumpla la condición consultada.

## Plan de implementación

1. **Identificar las fuentes y escrituras concurrentes.** Documentar las tablas, consultas y operaciones que afectan los avisos de `collectRecalculationFlags` y la elegibilidad de empleados. Definir un orden consistente de adquisición de bloqueos y comprobar cómo se protegen también las inserciones.
2. **Preparar las comprobaciones transaccionales.** Adaptar las comprobaciones necesarias para que puedan ejecutarse en la misma conexión y transacción que la transición del periodo. Conservar las reglas actuales para periodos ordinarios y extraordinarios.
3. **Proteger la aprobación.** Validar sucursal, estatus y avisos de recálculo dentro de la transacción. Mantener los bloqueos necesarios hasta el `COMMIT`; si hay un aviso activo o falla una comprobación, rechazar la operación sin cambiar el periodo ni registrar la transición.
4. **Proteger el pago.** Validar sucursal, estatus y empleados elegibles faltantes dentro de la transacción. Mantener los bloqueos necesarios hasta el `COMMIT`; si faltan empleados o falla la comprobación, rechazar el pago sin cambiar el periodo ni registrar la transición.
5. **Verificar la concurrencia.** Agregar pruebas automatizadas de las acciones y pruebas con sesiones SQL Server concurrentes. Cubrir cambios e inserciones que intenten producirse durante las validaciones, así como la liberación de bloqueos tras confirmar o revertir.
6. **Actualizar la documentación.** Ajustar `docs/nomina.md` y registrar en `audits/2026-11-16-auditoria-nomina.md` el resultado y la evidencia de D1, incluidas las limitaciones de las pruebas realizadas.

## Criterios de aceptación

- [x] Aprobar rechaza el periodo si hay algún aviso de recálculo activo.
- [x] Pagar rechaza el periodo si faltan empleados elegibles.
- [x] Los cambios concurrentes no invalidan esas comprobaciones antes del `COMMIT`.
- [x] Si falla una validación, el estatus y la bitácora permanecen sin cambios.
- [x] Las pruebas automatizadas y de concurrencia en SQL Server pasan.
- [x] La documentación y la auditoría reflejan el resultado y la evidencia.

## Decisiones tomadas y descartadas

- **Sí:** validar dentro de la transacción y conservar los bloqueos hasta el `COMMIT`.
- **No:** aprobar y comprobar después; existiría una ventana de aprobación inválida.
- **Sí:** mantener al pagar únicamente el bloqueo por empleados faltantes.
- **No:** corregir cambios posteriores a la transición; quedan fuera de D1.

## Riesgos identificados

- **Bloqueos prolongados o interbloqueos:** usar un orden consistente de adquisición y probar la concurrencia.
- **Inserciones concurrentes:** comprobar que los bloqueos protejan también rangos sin filas existentes.
- **Cambios posteriores al `COMMIT`:** quedan fuera de esta corrección y conservan los riesgos documentados en D2.

## Qué no incluye esta spec

Otros bloqueos al pagar, correcciones automáticas por cambios posteriores, los riesgos de D2 y otros hallazgos de la auditoría.
