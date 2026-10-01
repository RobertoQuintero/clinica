import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function periodDate(label: string) {
  return z
    .string()
    .regex(DATE_REGEX, `${label} debe tener formato AAAA-MM-DD`)
    .refine(isRealCalendarDate, `${label} no es una fecha válida`);
}

const periodDatesShape = {
  fecha_inicio: periodDate("La fecha de inicio"),
  fecha_fin: periodDate("La fecha de fin"),
  fecha_corte: periodDate("La fecha de corte"),
  fecha_pago: periodDate("La fecha de pago"),
};

type PeriodDatesInput = { fecha_inicio: string; fecha_fin: string; fecha_corte: string; fecha_pago: string };

// Fechas "YYYY-MM-DD": la comparación de strings equivale a la cronológica.
function validatePeriodDateOrder(dates: PeriodDatesInput, context: z.RefinementCtx) {
  if (dates.fecha_fin < dates.fecha_inicio) {
    context.addIssue({ code: "custom", path: ["fecha_fin"], message: "La fecha de fin no puede ser anterior a la de inicio" });
  }
  if (dates.fecha_corte < dates.fecha_inicio || dates.fecha_corte > dates.fecha_fin) {
    context.addIssue({ code: "custom", path: ["fecha_corte"], message: "La fecha de corte debe estar dentro del periodo (entre inicio y fin)" });
  }
  if (dates.fecha_pago < dates.fecha_corte) {
    context.addIssue({ code: "custom", path: ["fecha_pago"], message: "La fecha de pago no puede ser anterior a la de corte" });
  }
}

export const createPayrollPeriodSchema = z
  .object({
    id_payment_period: z.number().int().positive("Selecciona una frecuencia"),
    ...periodDatesShape,
  })
  .superRefine(validatePeriodDateOrder);

export const updatePayrollPeriodSchema = z
  .object({
    id_period: z.number().int().positive(),
    ...periodDatesShape,
  })
  .superRefine(validatePeriodDateOrder);

export const calculatePayrollPeriodSchema = z.object({
  id_period: z.number().int().positive("Periodo inválido"),
});

export const revertPayrollCalculationSchema = z.object({
  id_period: z.number().int().positive("Periodo inválido"),
});

export const payrollEmployeeDetailFiltersSchema = z.object({
  idEmpleado: z.number().int().positive("Empleado inválido"),
  idPeriod: z.number().int().positive("Periodo inválido"),
  payrollType: z.enum(["O", "F"]),
  idPuesto: z.number().int().positive().nullable(),
  search: z.string(),
});

export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>;
export type UpdatePayrollPeriodInput = z.infer<typeof updatePayrollPeriodSchema>;

export const commissionTierSchema = z
  .object({
    min_consultas: z.number().int("El mínimo debe ser un entero").min(1, "El mínimo debe ser al menos 1"),
    max_consultas: z.number().int("El máximo debe ser un entero").min(1, "El máximo debe ser al menos 1").nullable(),
    importe: z.number("El importe es inválido").min(0, "El importe no puede ser negativo"),
  })
  .refine((tier) => tier.max_consultas === null || tier.max_consultas >= tier.min_consultas, {
    path: ["max_consultas"],
    message: "El máximo debe ser mayor o igual al mínimo",
  });

export type CommissionTierSchemaInput = z.infer<typeof commissionTierSchema>;

export const treatmentCommissionSettingsSchema = z.object({
  importe_por_tratamiento: z
    .number("El importe es inválido")
    .min(0, "El importe no puede ser negativo")
    .multipleOf(0.01, "El importe admite máximo 2 decimales"),
  umbral_liquidacion: z
    .number("El umbral es inválido")
    .positive("El umbral debe ser mayor a 0")
    .multipleOf(0.01, "El umbral admite máximo 2 decimales"),
});

export type TreatmentCommissionSettingsSchemaInput = z.infer<typeof treatmentCommissionSettingsSchema>;

export const overtimeSettingsSchema = z.object({
  limite_horas_dobles_periodo: z
    .number("El límite de horas dobles es inválido")
    .min(0, "El límite de horas dobles no puede ser negativo")
    .multipleOf(0.5, "El límite de horas dobles debe ir en pasos de 0.5"),
  tope_horas_dia: z
    .number("El tope por día es inválido")
    .positive("El tope por día debe ser mayor a 0")
    .max(24, "El tope por día no puede pasar de 24 horas")
    .multipleOf(0.5, "El tope por día debe ir en pasos de 0.5"),
});

export type OvertimeSettingsSchemaInput = z.infer<typeof overtimeSettingsSchema>;

const overtimeDayShape = {
  id_period: z.number("El periodo es inválido").int("El periodo es inválido").positive("El periodo es inválido"),
  id_empleado: z.number("El empleado es inválido").int("El empleado es inválido").positive("El empleado es inválido"),
  fecha: periodDate("La fecha"),
};

export const decideOvertimeDaySchema = z
  .object({
    ...overtimeDayShape,
    decision: z.enum(["authorized", "rejected"], "La decisión es inválida"),
    horas_autorizadas: z
      .number("Las horas autorizadas son inválidas")
      .positive("Las horas autorizadas deben ser mayores a 0")
      .multipleOf(0.5, "Las horas autorizadas deben ir en pasos de 0.5")
      .optional(),
    comentario: z
      .string("El comentario es inválido")
      .trim()
      .max(500, "El comentario admite máximo 500 caracteres")
      .optional(),
  })
  .refine((value) => value.decision !== "authorized" || value.horas_autorizadas !== undefined, {
    path: ["horas_autorizadas"],
    message: "Captura las horas a autorizar",
  });

export type DecideOvertimeDaySchemaInput = z.infer<typeof decideOvertimeDaySchema>;

export const clearOvertimeDecisionSchema = z.object(overtimeDayShape);

export type ClearOvertimeDecisionSchemaInput = z.infer<typeof clearOvertimeDecisionSchema>;

export const absencePageFiltersSchema = z.object({
  idPeriod: z.number().int().positive().nullable(),
  status: z.enum(["all", "unjustified", "justified", "not_applicable"]),
  search: z.string(),
  page: z.number().int().positive(),
});

const absenceDayShape = overtimeDayShape;

const ABSENCE_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const justifyAbsenceSchema = z.object({
  ...absenceDayShape,
  url: z
    .string("El archivo es inválido")
    .max(500, "La URL del archivo es demasiado larga")
    .startsWith("https://res.cloudinary.com/", "El archivo es inválido"),
  mime_type: z.enum(["application/pdf", "image/jpeg", "image/png"], "El formato del archivo no es válido"),
  size_bytes: z
    .number("El tamaño del archivo es inválido")
    .int("El tamaño del archivo es inválido")
    .positive("El tamaño del archivo es inválido")
    .max(ABSENCE_MAX_FILE_BYTES, "El archivo supera el tamaño máximo de 5 MB"),
  comentario: z.string("El comentario es inválido").trim().max(500, "El comentario admite máximo 500 caracteres").optional(),
});

export type JustifyAbsenceSchemaInput = z.infer<typeof justifyAbsenceSchema>;

export const markAbsenceNotApplicableSchema = z.object({
  ...absenceDayShape,
  comentario: z
    .string("El comentario es inválido")
    .trim()
    .min(1, "Escribe un comentario")
    .max(500, "El comentario admite máximo 500 caracteres"),
});

export type MarkAbsenceNotApplicableSchemaInput = z.infer<typeof markAbsenceNotApplicableSchema>;

export const clearAbsenceJustificationSchema = z.object(absenceDayShape);

export type ClearAbsenceJustificationSchemaInput = z.infer<typeof clearAbsenceJustificationSchema>;

// ---- Retardos (spec 63) ----

export const latenessPageFiltersSchema = z.object({
  idPeriod: z.number().int().positive().nullable(),
  status: z.enum(["all", "unjustified", "justified", "not_applicable"]),
  classification: z.enum(["all", "severe", "accumulable"]),
  search: z.string(),
  page: z.number().int().positive(),
});

const LATENESS_MAX_SMALLINT = 32767;

const latenessTierSchema = z.object({
  id_payment_period: z
    .number("La frecuencia es inválida")
    .int("La frecuencia es inválida")
    .positive("La frecuencia es inválida"),
  retardos: z
    .number("El número de retardos es inválido")
    .int("El número de retardos debe ser entero")
    .positive("El número de retardos debe ser mayor a 0")
    .max(LATENESS_MAX_SMALLINT, "El número de retardos es demasiado grande"),
  dias_descuento: z
    .number("Los días de descuento son inválidos")
    .positive("Los días de descuento deben ser mayores a 0")
    .max(31, "Los días de descuento no pueden pasar de 31")
    .multipleOf(0.5, "Los días de descuento deben ir en pasos de 0.5"),
});

/**
 * Configuración de retardos de la empresa (spec 63). Los escalones de cada frecuencia no pueden repetir
 * `retardos` y no pueden decrecer cuando `retardos` crece (un CHECK de SQL no ve otras filas).
 */
export const updateLatenessSettingsSchema = z
  .object({
    tolerancia_minutos: z
      .number("La tolerancia es inválida")
      .int("La tolerancia debe ser un número entero de minutos")
      .positive("La tolerancia debe ser mayor a 0")
      .max(LATENESS_MAX_SMALLINT, "La tolerancia es demasiado grande"),
    minutos_retardo_grave: z
      .number("El umbral del retardo grave es inválido")
      .int("El umbral del retardo grave debe ser un número entero de minutos")
      .max(LATENESS_MAX_SMALLINT, "El umbral del retardo grave es demasiado grande"),
    dias_descuento_retardo_grave: z
      .number("El descuento del retardo grave es inválido")
      .min(0.5, "El descuento del retardo grave debe ser de 0.5 o 1 día")
      .max(1, "El descuento del retardo grave debe ser de 0.5 o 1 día")
      .multipleOf(0.5, "El descuento del retardo grave debe ser de 0.5 o 1 día"),
    tiers: z.array(latenessTierSchema).max(60, "Hay demasiados escalones"),
  })
  .superRefine((value, context) => {
    if (value.minutos_retardo_grave <= value.tolerancia_minutos) {
      context.addIssue({
        code: "custom",
        path: ["minutos_retardo_grave"],
        message: "El umbral del retardo grave debe ser mayor a la tolerancia",
      });
    }

    const tiersByFrequency = new Map<number, typeof value.tiers>();
    for (const tier of value.tiers) {
      const frequencyTiers = tiersByFrequency.get(tier.id_payment_period);
      if (frequencyTiers) frequencyTiers.push(tier);
      else tiersByFrequency.set(tier.id_payment_period, [tier]);
    }
    for (const frequencyTiers of tiersByFrequency.values()) {
      const sortedTiers = [...frequencyTiers].sort((first, second) => first.retardos - second.retardos);
      for (let index = 1; index < sortedTiers.length; index++) {
        const previousTier = sortedTiers[index - 1];
        const currentTier = sortedTiers[index];
        if (currentTier.retardos === previousTier.retardos) {
          context.addIssue({
            code: "custom",
            path: ["tiers"],
            message: "Un escalón repite el mismo número de retardos en una frecuencia",
          });
          return;
        }
        if (currentTier.dias_descuento < previousTier.dias_descuento) {
          context.addIssue({
            code: "custom",
            path: ["tiers"],
            message: "Los días de descuento no pueden bajar cuando aumentan los retardos",
          });
          return;
        }
      }
    }
  });

export type UpdateLatenessSettingsSchemaInput = z.infer<typeof updateLatenessSettingsSchema>;

// Las escrituras de justificación de retardos tienen la misma forma que las de Faltas.
export const justifyLatenessSchema = justifyAbsenceSchema;
export const markLatenessNotApplicableSchema = markAbsenceNotApplicableSchema;
export const clearLatenessJustificationSchema = clearAbsenceJustificationSchema;

// ---- Bono de puntualidad (spec 64) ----

export const punctualityBonusPageFiltersSchema = z.object({
  idPeriod: z.number().int().positive().nullable(),
  result: z.enum(["all", "keeps", "loses", "not_evaluated"]),
  search: z.string(),
  page: z.number().int().positive(),
});

export const attendanceBonusPageFiltersSchema = punctualityBonusPageFiltersSchema;

const PUNCTUALITY_BONUS_MAX_AMOUNT = 9999999999.99;   // decimal(12,2)
const PUNCTUALITY_BONUS_MAX_SMALLINT = 32767;

const punctualityBonusSettingSchema = z.object({
  id_payment_period: z
    .number("La frecuencia es inválida")
    .int("La frecuencia es inválida")
    .positive("La frecuencia es inválida"),
  monto: z
    .number("El monto es inválido")
    .positive("El monto debe ser mayor a 0")
    .max(PUNCTUALITY_BONUS_MAX_AMOUNT, "El monto es demasiado grande")
    .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6, "El monto admite máximo 2 decimales"),
  maximo_incidencias: z
    .number("El máximo de incidencias es inválido")
    .int("El máximo de incidencias debe ser un número entero")
    .min(0, "El máximo de incidencias no puede ser negativo")
    .max(PUNCTUALITY_BONUS_MAX_SMALLINT, "El máximo de incidencias es demasiado grande"),
  status: z.boolean("El estatus es inválido"),
});

export const updatePunctualityBonusSettingsSchema = z
  .object({
    settings: z.array(punctualityBonusSettingSchema).min(1, "No hay frecuencias que guardar").max(20, "Hay demasiadas frecuencias"),
  })
  .superRefine((value, context) => {
    const seenFrequencies = new Set<number>();
    for (const setting of value.settings) {
      if (seenFrequencies.has(setting.id_payment_period)) {
        context.addIssue({ code: "custom", path: ["settings"], message: "Una frecuencia está repetida" });
        return;
      }
      seenFrequencies.add(setting.id_payment_period);
    }
  });

export type UpdatePunctualityBonusSettingsSchemaInput = z.infer<typeof updatePunctualityBonusSettingsSchema>;
