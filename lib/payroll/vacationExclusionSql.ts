import "server-only";

/**
 * Spec 77: un día dentro de un bloque de vacaciones capturado no es falta ni retardo.
 * Supone los alias `e` (RH.empleados) y `d` (period_days) que ya usan todas las consultas de incidencias.
 * Es la única definición SQL de la regla: los seis lugares la importan y ninguno la reescribe.
 */
export const NOT_ON_VACATION_CONDITION = `
          NOT EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[vacation_entitlements] ve
                       WHERE ve.[id_empleado] = e.[id_empleado]
                         AND ve.[fecha_inicio] IS NOT NULL
                         AND d.[fecha] BETWEEN ve.[fecha_inicio] AND ve.[fecha_fin])`;
