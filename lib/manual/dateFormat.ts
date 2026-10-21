const LONG_MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "2026-10-21" -> "21 de octubre de 2026". Normaliza con `"T00:00:00"` antes de pasar por
 * `Date` (regla 4 de fechas de CLAUDE.md), para que el navegador no la interprete en UTC.
 */
export function formatManualUpdatedDate(updated: string): string {
  const date = new Date(`${updated}T00:00:00`);
  return `${date.getDate()} de ${LONG_MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}
