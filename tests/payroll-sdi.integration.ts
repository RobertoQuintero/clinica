import test from "node:test";
import assert from "node:assert/strict";
import sql from "mssql";
import { INSERT_HISTORICAL_SDI_SQL } from "../lib/payroll/sdiSql";
import { calculateSdi } from "../lib/payroll/sdiCalculation";

test("historical SDI is persisted with its frozen inputs and reused on retry", async () => {
  const pool = await sql.connect({
    server: process.env.DB_HOST!, database: process.env.DB_NAME!,
    user: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD!,
    options: { encrypt: false, trustServerCertificate: true, cryptoCredentialsDetails: { minVersion: "TLSv1" } },
  });
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const candidate = await new sql.Request(tx).query(`
      SELECT TOP (1) pe.id_period_employee, pe.salario_diario,
             CONVERT(char(10), e.fecha_ingreso, 23) AS fecha_ingreso,
             CONVERT(char(10), p.fecha_fin, 23) AS fecha_fin
        FROM payroll.period_employees pe WITH (UPDLOCK, HOLDLOCK)
        JOIN payroll.periods p ON p.id_period = pe.id_period
        JOIN RH.empleados e ON e.id_empleado = pe.id_empleado
        LEFT JOIN payroll.period_employee_sdi s ON s.id_period_employee = pe.id_period_employee
       WHERE pe.tipo_nomina = 'F' AND s.id_period_employee IS NULL
         AND pe.salario_diario > 0 AND e.fecha_ingreso <= p.fecha_fin
       ORDER BY pe.id_period_employee`);
    assert.equal(candidate.recordset.length, 1, "No fiscal historical row without an SDI snapshot is available");
    const row = candidate.recordset[0];
    const insert = new sql.Request(tx);
    insert.input("id_period_employee", sql.Int, row.id_period_employee);
    await insert.query(INSERT_HISTORICAL_SDI_SQL);

    const read = async () => {
      const request = new sql.Request(tx);
      request.input("id_period_employee", sql.Int, row.id_period_employee);
      return (await request.query(`SELECT estado, motivo, salario_diario_integrado, dias_vacaciones, origen
        FROM payroll.period_employee_sdi WHERE id_period_employee = @id_period_employee`)).recordset[0];
    };
    const saved = await read();
    const expected = calculateSdi(Number(row.salario_diario), row.fecha_ingreso, row.fecha_fin);
    assert.equal(expected.ok, true);
    if (expected.ok) {
      assert.equal(saved.estado, "C");
      assert.equal(saved.origen, "timbrado");
      assert.equal(Number(saved.salario_diario_integrado), expected.salarioDiarioIntegrado);
      assert.equal(saved.dias_vacaciones, expected.diasVacaciones);
    }
    // A retry reads the same snapshot rather than calculating it again.
    assert.deepEqual(await read(), saved);
  } finally {
    await tx.rollback();
    await pool.close();
  }
});
