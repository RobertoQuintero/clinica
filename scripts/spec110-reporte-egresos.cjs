// Uso: node --env-file=.env.local scripts/spec110-reporte-egresos.cjs
// Genera el reporte en el directorio temporal del sistema, fuera del repositorio.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sql = require('mssql');

async function main() {
  const pool = await sql.connect({
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, cryptoCredentialsDetails: { minVersion: 'TLSv1' } },
  });
  try {
    const hasOrigin = (await pool.request().query("SELECT CASE WHEN COL_LENGTH('dbo.Egresos', 'origen') IS NULL THEN 0 ELSE 1 END AS existe")).recordset[0].existe;
    const result = await pool.request().query(hasOrigin
      ? "SELECT id_egreso FROM dbo.Egresos WHERE origen IS NULL OR origen <> 'TRATAMIENTO' ORDER BY id_egreso"
      : 'SELECT id_egreso FROM dbo.Egresos ORDER BY id_egreso');
    const lines = ['id_egreso,motivo', ...result.recordset.map(({ id_egreso }) => `${id_egreso},origen de tratamiento no acreditado`)];
    const report = path.join(os.tmpdir(), `spec110-egresos-${Date.now()}.csv`);
    fs.writeFileSync(report, `\uFEFF${lines.join('\r\n')}\r\n`, { flag: 'wx' });
    console.log(`Reporte: ${report}\nRegistros: ${result.recordset.length}`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
