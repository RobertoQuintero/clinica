import { addZeroToday } from "@/utils/date_helpper";

/**
 * Normaliza una fecha `"YYYY-MM-DD"` (o `"YYYY-MM-DD HH:mm:ss"`) a un `Date` parseado en
 * hora local, nunca `new Date(rawDbString)` sobre el string crudo (reglas de fechas de CLAUDE.md).
 */
function toLocalDate(dateString: string): Date {
  const normalized = dateString.includes("T")
    ? dateString
    : `${dateString.replace(" ", "T").slice(0, 10)}T00:00:00`;
  return new Date(normalized);
}

/**
 * Edad en años cumplidos, comparando mes y día (no solo el año) contra el día de hoy
 * en la zona horaria de la clínica. `null` si no hay fecha de nacimiento capturada.
 */
export function calculateAge(birthDateString: string | null): number | null {
  if (!birthDateString) return null;

  const birthDate = toLocalDate(birthDateString);
  const today = toLocalDate(addZeroToday(new Date()));

  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotHadBirthdayYet =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (hasNotHadBirthdayYet) age -= 1;

  return age;
}

/** Antigüedad en años y meses completos, desde `fecha_ingreso` hasta el día de hoy. */
export function calculateSeniority(hireDateString: string): { years: number; months: number } {
  const hireDate = toLocalDate(hireDateString);
  const today = toLocalDate(addZeroToday(new Date()));

  let totalMonths =
    (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
  if (today.getDate() < hireDate.getDate()) totalMonths -= 1;
  if (totalMonths < 0) totalMonths = 0;

  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}
