/** Nombre completo con un solo espacio entre partes no vacías, para mostrar y para buscar. Alias esperado: `e`. */
export const EMPLOYEE_FULL_NAME_SQL = `LTRIM(RTRIM(
  e.nombre
  + ISNULL(' ' + NULLIF(e.apellido_paterno, ''), '')
  + ISNULL(' ' + NULLIF(e.apellido_materno, ''), '')))`;
