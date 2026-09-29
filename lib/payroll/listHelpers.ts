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
