/** ISO: 1 = lunes … 7 = domingo. */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Un día trabajado de RH.empleado_horarios. Horas siempre "HH:mm", nunca Date. */
export interface IScheduleDay {
  dia_semana: WeekdayNumber;
  hora_entrada_1: string;
  hora_salida_1: string;
  hora_entrada_2: string | null;
  hora_salida_2: string | null;
}

/** Semana del empleado: solo los días trabajados, ordenados por dia_semana. */
export interface IEmployeeSchedule {
  id_empleado: number;
  days: IScheduleDay[]; // vacío = sin horario definido
  updated_at: string | null; // MAX(created_at) de sus filas, "YYYY-MM-DD HH:mm:ss"
}
