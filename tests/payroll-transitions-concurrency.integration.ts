import test from "node:test";
import assert from "node:assert/strict";
import sql from "mssql";
import { loadMissingEligibleEmployees } from "../lib/payroll/missingEmployeesRecalculation";
import { isPendingDaysRecalculationNeeded } from "../lib/payroll/pendingDaysRecalculation";

// Use only against the dedicated test database. Both writer transactions always roll back.
test("serializable payroll checks block source updates and empty-range inserts until transaction end", async () => {
  const pool = await sql.connect({ server: process.env.DB_HOST!, database: process.env.DB_NAME!, user: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD!, options: { encrypt: false, trustServerCertificate: true, cryptoCredentialsDetails: { minVersion: "TLSv1" } } });
  try {
    const candidate = (await pool.request().query(`SELECT TOP (1) p.id_period, p.id_sucursal, p.id_payment_period,
      CONVERT(varchar(10), p.fecha_fin, 120) fecha_fin, p.tipo_periodo, p.concepto_extraordinario,
      pe.id_empleado, pe.calculated_by
      FROM payroll.periods p JOIN payroll.period_employees pe ON pe.id_period = p.id_period
      JOIN RH.empleados e ON e.id_empleado = pe.id_empleado
      WHERE p.status = 2 AND p.tipo_periodo = 'O' AND e.status = 1 AND e.activo = 1
        AND e.id_sucursal = p.id_sucursal AND e.id_periodo_pago = p.id_payment_period
        AND e.fecha_ingreso <= p.fecha_fin AND (e.salario_diario > 0 OR e.salario_diario_fiscal > 0)
      ORDER BY p.id_period DESC`)).recordset[0];
    assert.ok(candidate, "Se requiere un periodo ordinario en cálculo con empleado elegible calculado");

    for (const mode of ["update", "insert"] as const) {
      const reader = new sql.Transaction(pool);
      const writer = new sql.Transaction(pool);
      await reader.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      await writer.begin();
      let readerDone = false;
      try {
        const client = { queryParams: async (query: string, params: Record<string, unknown>) => {
          const request = new sql.Request(reader);
          for (const [name, value] of Object.entries(params)) request.input(name, value);
          return (await request.query(query)).recordset;
        } };
        await client.queryParams("SELECT id_period FROM payroll.periods WITH (UPDLOCK, HOLDLOCK) WHERE id_period = @id_period AND status = 2", { id_period: candidate.id_period });
        if (mode === "update") await loadMissingEligibleEmployees(candidate, client);
        else await isPendingDaysRecalculationNeeded(candidate.id_period, client);

        const request = new sql.Request(writer);
        request.input("id_period", sql.Int, candidate.id_period);
        request.input("id_empleado", sql.Int, candidate.id_empleado);
        request.input("created_by", sql.Int, candidate.calculated_by);
        // The date is deliberately absent, so this tests a phantom insertion.
        const operation = request.query(mode === "update"
          ? "UPDATE RH.empleados SET salario_diario = salario_diario WHERE id_empleado = @id_empleado"
          : "INSERT INTO payroll.pending_day_payments (id_period,id_empleado,fecha,tarifa_operativa,tarifa_fiscal,motivo,created_by,created_at) VALUES (@id_period,@id_empleado,'19000101',1,0,N'prueba concurrencia',@created_by,SYSDATETIME())");
        const pending = await Promise.race([operation.then(() => false), new Promise<boolean>(resolve => setTimeout(() => resolve(true), 500))]);
        assert.equal(pending, true, `${mode} no quedó bloqueado durante la validación`);
        if (mode === "update") await reader.commit(); else await reader.rollback();
        readerDone = true;
        await operation;
      } finally {
        if (!readerDone) await reader.rollback();
        await writer.rollback();
      }
    }
  } finally { await pool.close(); }
});
