import "server-only";

/**
 * Spec 78: eventos de pago de vacaciones que caen dentro del periodo (`@fecha_inicio`..`@fecha_fin`).
 * Forma: (id_empleado, id_vacation_entitlement, concepto, fecha_evento, dias).
 *  - 'P' prima vacacional: fecha_evento = ISNULL(fecha_inicio, fecha_pago), sobre todos los dias_derecho.
 *  - 'D' días no disfrutados: fecha_evento = fecha_pago, sobre dias_pagados.
 * Es la única definición SQL de la regla: el cálculo y el aviso "Recalcula" la importan y ninguno la reescribe.
 * Se usa como subconsulta: `FROM (${VACATION_PAY_EVENTS_SQL}) ev`.
 */
export const VACATION_PAY_EVENTS_SQL = `
          SELECT ve.[id_empleado], ve.[id_vacation_entitlement], CAST('P' AS char(1)) AS [concepto],
                 ISNULL(ve.[fecha_inicio], ve.[fecha_pago]) AS [fecha_evento],
                 ve.[dias_derecho] AS [dias]
            FROM [CentroPodologico].[RH].[vacation_entitlements] ve
           WHERE ISNULL(ve.[fecha_inicio], ve.[fecha_pago]) IS NOT NULL
             AND ve.[dias_derecho] > 0
             AND ISNULL(ve.[fecha_inicio], ve.[fecha_pago]) BETWEEN @fecha_inicio AND @fecha_fin
          UNION ALL
          SELECT ve.[id_empleado], ve.[id_vacation_entitlement], CAST('D' AS char(1)),
                 ve.[fecha_pago], ve.[dias_pagados]
            FROM [CentroPodologico].[RH].[vacation_entitlements] ve
           WHERE ve.[fecha_pago] IS NOT NULL
             AND ve.[dias_pagados] > 0
             AND ve.[fecha_pago] BETWEEN @fecha_inicio AND @fecha_fin`;
