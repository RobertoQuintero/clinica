/** Minúsculas y sin acentos, para que la búsqueda por nombre sea tolerante como el LIKE de SQL Server. */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function groupByEmployee<T extends { id_empleado: number }>(rows: T[]): Map<number, T[]> {
  const rowsByEmployee = new Map<number, T[]>();
  for (const row of rows) {
    const employeeRows = rowsByEmployee.get(row.id_empleado);
    if (employeeRows) employeeRows.push(row);
    else rowsByEmployee.set(row.id_empleado, [row]);
  }
  return rowsByEmployee;
}

/** Códigos de los periodos que ya descontaron cada día, indexados por "id_empleado|fecha" y sin repetir. */
export function buildDiscountedCodesByDay(
  discountedRows: { id_empleado: number; fecha: string; codigo: string }[],
): Map<string, string[]> {
  const codesByDay = new Map<string, string[]>();
  for (const discounted of discountedRows) {
    const dayKey = `${discounted.id_empleado}|${discounted.fecha}`;
    const codes = codesByDay.get(dayKey);
    if (!codes) codesByDay.set(dayKey, [discounted.codigo]);
    else if (!codes.includes(discounted.codigo)) codes.push(discounted.codigo);
  }
  return codesByDay;
}
