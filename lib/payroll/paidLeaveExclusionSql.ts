import "server-only";

import { NOT_ON_VACATION_CONDITION } from "@/lib/payroll/vacationExclusionSql";

/**
 * Spec 80: un día económico activo (RH.economic_days con cancelado_at IS NULL) no es falta ni retardo.
 * Supone los mismos alias que `NOT_ON_VACATION_CONDITION`: `e` (RH.empleados) y `d` (period_days).
 * La igualdad por (id_empleado, fecha) usa el índice filtrado UX_economic_days_empleado_fecha_activo.
 */
export const NOT_ON_ECONOMIC_DAY_CONDITION = `
          NOT EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[economic_days] ed
                       WHERE ed.[id_empleado] = e.[id_empleado]
                         AND ed.[cancelado_at] IS NULL
                         AND ed.[fecha] = d.[fecha])`;

/**
 * Spec 80: días con goce (vacaciones + días económicos). Es la única constante que importan los seis lugares
 * de incidencias; un futuro catálogo de festivos tocaría solo esta definición.
 */
export const NOT_ON_PAID_LEAVE_CONDITION = `${NOT_ON_VACATION_CONDITION}
          AND ${NOT_ON_ECONOMIC_DAY_CONDITION}`;
