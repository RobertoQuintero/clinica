// Ejecuta las consultas de autorización reales sobre tablas temporales aisladas.
// Uso: node --env-file=.env.local scripts/spec110-sql-control.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = require('mssql');

async function main() {
  const source = fs.readFileSync('app/dashboard/tratamientos/actions.ts', 'utf8');
  function extract(marker) {
    const index = source.indexOf(marker);
    assert.notEqual(index, -1, marker);
    const start = source.indexOf('`SELECT', index);
    const end = source.indexOf('`', start + 1);
    assert.ok(start >= 0 && end > start);
    return source.slice(start + 1, end)
      .replaceAll('[CentroPodologico].[dbo].[Tratamiento_onicomicosis]', '#tratamientos')
      .replaceAll('[CentroPodologico].[dbo].[consultas]', '#consultas')
      .replaceAll('[CentroPodologico].[dbo].[Egresos]', '#egresos');
  }
  const treatmentQuery = extract('async function authorizeTreatment');
  const consultationQuery = extract('async function authorizeConsultation');
  const expenseQuery = extract('async function authorizeExpense');
  const pool = await sql.connect({ server: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, options: { encrypt: false, trustServerCertificate: true, cryptoCredentialsDetails: { minVersion: 'TLSv1' } } });
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const request = () => new sql.Request(tx);
    await request().batch(`CREATE TABLE #consultas (id_consulta int, id_tratamiento int NULL, id_paciente int, id_empresa int, id_sucursal int);
      CREATE TABLE #tratamientos (id_tratamiento int, id_consulta int, id_especialista int);
      CREATE TABLE #egresos (id_egreso int, id_tabla_referencia int, id_egreso_stage int, origen varchar(32));
      INSERT #consultas VALUES (1,NULL,10,7,1),(2,1,10,7,1),(3,99,10,7,1),(4,2,10,7,1),(5,NULL,10,7,1),(6,1,10,8,1),(7,1,10,7,3);
      INSERT #tratamientos VALUES (1,1,2),(2,4,3),(3,5,2),(4,5,2);
      INSERT #egresos VALUES (1,1,1,'TRATAMIENTO'),(2,1,1,NULL),(3,1,1,'OTRO'),(4,99,1,'TRATAMIENTO');`);
    const run = async (query, key, id) => (await request().input(key, sql.Int, id).query(query)).recordset;
    for (const [id, count] of [[1,1],[2,1],[3,0],[4,1],[5,2],[99,0]]) {
      assert.equal((await run(consultationQuery, 'id_consulta', id)).length, count, `consulta ${id}`);
    }
    // La consulta 4 apunta al mismo tratamiento del que es inicial; cambiarla crea contradicción.
    await request().query('UPDATE #consultas SET id_tratamiento = 1 WHERE id_consulta = 4');
    assert.equal((await run(consultationQuery, 'id_consulta', 4)).length, 2);
    assert.equal((await run(treatmentQuery, 'id_tratamiento', 2)).length, 0);
    assert.equal((await run(treatmentQuery, 'id_tratamiento', 3)).length, 0);
    assert.equal((await run(treatmentQuery, 'id_tratamiento', 1)).length, 1);
    for (const [id, count] of [[1,1],[2,0],[3,0],[4,1],[99,0]]) assert.equal((await run(expenseQuery, 'id_egreso', id)).length, count, `egreso ${id}`);
    const orphan = (await run(expenseQuery, 'id_egreso', 4))[0];
    assert.equal((await run(treatmentQuery, 'id_tratamiento', orphan.id_tabla_referencia)).length, 0);
    const foreignCompany = (await run(consultationQuery, 'id_consulta', 6))[0];
    const foreignBranch = (await run(consultationQuery, 'id_consulta', 7))[0];
    assert.equal(foreignCompany.id_empresa, 8); assert.equal(foreignBranch.id_sucursal, 3);
    console.log('SQL controlado: relaciones, origen, padres inexistentes y ámbitos verificados en tablas temporales.');
  } finally {
    if (tx._aborted !== true) await tx.rollback().catch(() => {});
    await pool.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
