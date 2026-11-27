# SPEC 106: fuentes y estrategia de bloqueo

## Inventario de lecturas y escrituras concurrentes

Las comprobaciones parten de `payroll.periods` y comparan las fuentes vigentes con el cálculo guardado en `payroll.period_employees` y sus tablas de detalle. El cálculo, recálculo y reversión pueden insertar, modificar o borrar ese cálculo. El exento también consulta periodos y percepciones anteriores, no solo el periodo que se está aprobando.

| Comprobación | Fuentes adicionales que pueden cambiar |
| --- | --- |
| Horas extra | `RH.empleados`, `payroll.overtime_settings`, `payroll.overtime_authorizations`, `payroll.period_employee_overtime` |
| Faltas | `RH.empleados`, `dbo.users`, `RH.empleado_horarios`, `RH.asistencias`, `RH.vacation_entitlements`, `RH.economic_days`, `payroll.absence_justifications`, `payroll.period_employee_absences` |
| Retardos | Las fuentes de asistencia, horarios, permisos y usuarios anteriores; `payroll.lateness_settings`, `payroll.lateness_tiers`, `payroll.lateness_justifications`, `payroll.period_employee_lateness` |
| Bonos de puntualidad y asistencia | Las fuentes de faltas y retardos, `payroll.punctuality_bonus_settings` y `payroll.attendance_bonus_settings` |
| Extensión de jornada | `RH.empleados`, `RH.empleado_horarios`, `RH.asistencias`, `payroll.shift_extension_assignments` |
| ISR | `payroll.period_employee_perceptions`, `payroll.tax_parameters`, `payroll.tablas_retencion` |
| IMSS | `RH.empleados`, `RH.employee_sbc`, `payroll.period_employee_perceptions`, `payroll.tax_parameters`, `payroll.period_employee_imss` |
| Exento | `RH.payment_periods`, `payroll.tax_parameters`, `payroll.perceptions`, `payroll.period_employee_perceptions`, `payroll.period_employees` y `payroll.periods`, incluidos acumulados de otros periodos |
| Vacaciones | `RH.vacation_entitlements`, `payroll.period_employee_vacations` |
| Extraordinaria | `RH.empleados`, `RH.payment_periods`, `payroll.period_employee_perceptions`, `payroll.tablas_retencion`, `payroll.period_employee_isr_article174` |
| Días pendientes | `payroll.pending_day_payments`, `payroll.period_employee_pending_days` |
| Empleados faltantes | `RH.empleados`, `payroll.periods`, `payroll.period_employees` |

Estas fuentes se modifican mediante las capturas de empleados, usuarios, horarios, asistencias, permisos, incidencias, autorizaciones, bonos, parámetros y percepciones, además de los procesos de cálculo y sus escrituras de detalle. También pueden existir escritores externos de asistencias; la protección debe funcionar sin exigirles un protocolo nuevo.

La elegibilidad ordinaria requiere empleado activo y vigente, sucursal y frecuencia correspondientes, ingreso no posterior al fin y salario positivo para cada tipo de nómina. Aguinaldo omite la frecuencia; PTU no aplica esta comprobación. La consulta solo devuelve faltantes en estatus 2 o 3.

## Orden y protección propuestos

1. Abrir una transacción y adquirir primero `UPDLOCK, HOLDLOCK` sobre el periodo de la sucursal, comprobando su estatus. Mantenerlo hasta confirmar o revertir.
2. Ejecutar las comprobaciones secuencialmente en esa misma conexión, en un orden fijo compartido por las transiciones. Usar aislamiento `SERIALIZABLE` para que las lecturas mantengan bloqueos compartidos y de rango hasta el fin de la transacción, incluso en las búsquedas `NOT EXISTS` y rangos vacíos. El plan de SQL Server y los índices determinan la granularidad: sin índice adecuado puede bloquearse una parte amplia o toda la tabla.
3. Tras validar, actualizar el periodo e insertar la bitácora en la misma transacción. Un error o aviso debe provocar rollback.

El orden entre consultas reduce variaciones entre aprobaciones, pero no garantiza ausencia de interbloqueos con escritores existentes, que pueden adquirir sus bloqueos en otro orden. Las consultas incluyen subconsultas, agregados y fuentes de otros periodos; se debe comprobar con sesiones reales que SQL Server protege inserciones y actualizaciones relevantes, incluidos rangos vacíos y configuraciones de aislamiento de la base. Las pruebas del paso 5 deben demostrar el bloqueo hasta `COMMIT` y su liberación tras `COMMIT` y `ROLLBACK`; hasta entonces esta estrategia es una propuesta, no evidencia de concurrencia.

La implementación debe revisar los planes y evitar lecturas con `NOLOCK` o aislamiento que debilite estas garantías. Los bloqueos amplios y los interbloqueos siguen siendo riesgos operativos que deben medirse y documentarse.
