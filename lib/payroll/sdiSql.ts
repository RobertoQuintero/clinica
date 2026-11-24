/**
 * Inserta el SDI fijo de las filas fiscales dentro de la transacción de cálculo.
 * Requiere @id_period y @fecha_fin. El cálculo puro equivalente está en sdiCalculation.ts.
 */
export const INSERT_PERIOD_SDI_SQL = `
       INSERT INTO [CentroPodologico].[payroll].[period_employee_sdi]
         ([id_period_employee], [estado], [motivo], [salario_diario_fiscal], [fecha_ingreso],
          [fecha_referencia], [antiguedad_anios], [dias_vacaciones], [dias_aguinaldo],
          [porcentaje_prima_vacacional], [factor_integracion], [salario_diario_integrado], [origen])
       SELECT pe.[id_period_employee], CASE WHEN sdi_error.[motivo] IS NULL THEN 'C' ELSE 'E' END,
              sdi_error.[motivo], pe.[salario_diario], e.[fecha_ingreso], @fecha_fin,
              sdi_years.[anios], sdi_vacation.[dias],
              CASE WHEN sdi_error.[motivo] IS NULL THEN 15 END,
              CASE WHEN sdi_error.[motivo] IS NULL THEN 25 END,
              CASE WHEN sdi_error.[motivo] IS NULL THEN sdi_amount.[factor] END,
              CASE WHEN sdi_error.[motivo] IS NULL THEN sdi_amount.[sdi] END, 'procesamiento'
         FROM [CentroPodologico].[payroll].[period_employees] pe
         JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
        CROSS APPLY (SELECT CASE WHEN e.[fecha_ingreso] IS NOT NULL AND @fecha_fin IS NOT NULL
                                   AND e.[fecha_ingreso] <= @fecha_fin
          THEN DATEDIFF(YEAR, e.[fecha_ingreso], @fecha_fin)
             - CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, e.[fecha_ingreso], @fecha_fin), e.[fecha_ingreso]) > @fecha_fin
                    THEN 1 ELSE 0 END END AS [anios]) sdi_years
        CROSS APPLY (SELECT CASE WHEN sdi_years.[anios] < 5 THEN 12 + 2 * sdi_years.[anios]
                                 ELSE 20 + 2 * (sdi_years.[anios] / 5) END AS [dias]) sdi_vacation
        CROSS APPLY (SELECT
          CAST(1 + CAST(60 + sdi_vacation.[dias] AS decimal(18,12)) / 1460 AS decimal(18,12)) AS [factor],
          ROUND(CAST(pe.[salario_diario] * (1520 + sdi_vacation.[dias]) AS decimal(30,10)) / 1460, 2) AS [sdi]
        ) sdi_amount
        CROSS APPLY (SELECT CASE
          WHEN pe.[salario_diario] IS NULL OR pe.[salario_diario] <= 0 THEN N'Falta un salario diario fiscal válido del periodo.'
          WHEN e.[fecha_ingreso] IS NULL THEN N'Falta una fecha de ingreso válida.'
          WHEN @fecha_fin IS NULL THEN N'Falta una fecha de cierre de periodo válida.'
          WHEN e.[fecha_ingreso] > @fecha_fin THEN N'La fecha de ingreso es posterior al cierre del periodo.'
          WHEN sdi_amount.[sdi] > 9999999999.99 THEN N'El salario diario integrado excede el máximo permitido.'
          END AS [motivo]) sdi_error
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F';`;

/** Mismo cálculo para una sola fila histórica, con la fecha de cierre del periodo. */
export const INSERT_HISTORICAL_SDI_SQL = `
       DECLARE @id_period int, @fecha_fin date;
       SELECT @id_period = pe.[id_period], @fecha_fin = p.[fecha_fin]
         FROM [CentroPodologico].[payroll].[period_employees] pe
         JOIN [CentroPodologico].[payroll].[periods] p ON p.[id_period] = pe.[id_period]
        WHERE pe.[id_period_employee] = @id_period_employee;
       ${INSERT_PERIOD_SDI_SQL
         .replace("END, 'procesamiento'", "END, 'timbrado'")
         .replace("pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F'",
           "pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[id_period_employee] = @id_period_employee")}`;
