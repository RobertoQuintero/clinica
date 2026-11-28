// Solo para una base de pruebas. Crea datos sintéticos y los retira al terminar.
// Requiere SPEC110_DB_PRUEBAS=si, SPEC110_ADMIN_TOKEN y SPEC110_MEDICO_TOKEN (rol 5, usuario 1).
const assert = require('node:assert/strict');
const sql = require('mssql');
const { chromium } = require('playwright');

(async () => {
  assert.equal(process.env.SPEC110_DB_PRUEBAS, 'si', 'Confirma explícitamente la base de pruebas con SPEC110_DB_PRUEBAS=si');
  assert.ok(process.env.SPEC110_ADMIN_TOKEN && process.env.SPEC110_MEDICO_TOKEN, 'Faltan tokens de prueba');
  const base = -1000000000 - Math.floor(Math.random() * 100000000);
  const pool = await sql.connect({ server: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, options: { encrypt: false, trustServerCertificate: true, cryptoCredentialsDetails: { minVersion: 'TLSv1' } } });
  let inserted = false;
  let browser;
  const bind = request => request.input('base', sql.Int, base);
  try {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const request = bind(new sql.Request(tx));
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.consultas WHERE id_consulta IN (@base,@base-1)) OR EXISTS (SELECT 1 FROM dbo.Tratamiento_onicomicosis WHERE id_tratamiento IN (@base,@base-1)) OR EXISTS (SELECT 1 FROM dbo.Egresos WHERE id_egreso IN (@base,@base-1)) OR EXISTS (SELECT 1 FROM dbo.Egresos_archivos WHERE id_egreso_archivo IN (@base,@base-1)) THROW 50001, 'Identificadores de prueba ocupados', 1;
        DECLARE @paciente int = (SELECT id_paciente FROM dbo.consultas WHERE id_consulta = 1595);
        IF @paciente IS NULL THROW 50002, 'Falta paciente de referencia en base de pruebas', 1;
        INSERT dbo.consultas (id_consulta,id_paciente,id_podologo,fecha,id_sucursal,id_empresa,created_at) VALUES (@base,@paciente,1,GETDATE(),1,1,GETDATE()),(@base-1,@paciente,1,GETDATE(),5,1,GETDATE());
        INSERT dbo.Tratamiento_onicomicosis (id_tratamiento,id_consulta,id_stage,id_usuario,id_especialista,created_at) VALUES (@base,@base,1,2,1,GETDATE()),(@base-1,@base-1,1,2,1,GETDATE());
        INSERT dbo.Egresos (id_egreso,id_tabla_referencia,id_egreso_stage,referencia,status,origen,created_at,id_user_capturo,monto) VALUES (@base,@base,1,'SPEC110-CLASIFICADO',1,'TRATAMIENTO',GETDATE(),2,1),(@base-1,@base,1,'SPEC110-AMBIGUO',1,NULL,GETDATE(),2,1);
        INSERT dbo.Egresos_archivos (id_egreso_archivo,id_egreso,url,created_at,status,id_user) VALUES (@base,@base,'https://example.test/spec110-clasificado',GETDATE(),1,2),(@base-1,@base-1,'https://example.test/spec110-ambiguo',GETDATE(),1,2);`);
      await tx.commit(); inserted = true;
    } catch (error) { await tx.rollback().catch(() => {}); throw error; }
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    for (const [role, token] of Object.entries({ admin: process.env.SPEC110_ADMIN_TOKEN, medico: process.env.SPEC110_MEDICO_TOKEN })) {
      const context = await browser.newContext();
      await context.addCookies([{ name: 'auth_token', value: token, url: 'http://localhost:3000' }]);
      const page = await context.newPage();
      async function detail(id) {
        await page.goto(`http://localhost:3000/dashboard/tratamientos/${id}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.body.innerText.includes('Detalle del Tratamiento') || document.body.innerText.includes('No se pudo cargar el tratamiento') || document.body.innerText.includes('Tratamiento no encontrado'), null, { timeout: 30000 });
        return page.locator('body').innerText();
      }
      assert.match(await detail(base), /Detalle del Tratamiento/);
      await page.getByRole('button', { name: 'Egresos', exact: true }).click();
      await page.getByText('SPEC110-CLASIFICADO', { exact: true }).waitFor();
      assert.equal(await page.getByText('SPEC110-AMBIGUO', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Archivos', exact: true }).click();
      const file = page.getByRole('link', { name: 'Ver archivo' });
      await file.waitFor();
      assert.equal(await file.getAttribute('href'), 'https://example.test/spec110-clasificado');
      if (role === 'medico') {
        assert.equal(await page.getByRole('button', { name: 'Editar', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Eliminar', exact: true }).count(), 0);
        assert.match(await detail(base - 1), /No se pudo cargar el tratamiento/);
      } else assert.match(await detail(base - 1), /Detalle del Tratamiento/);
      console.log(`${role}: egreso clasificado y comprobante visibles; ambiguo oculto; alcance de sucursal correcto`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (inserted) {
      await bind(pool.request()).query(`DELETE dbo.Egresos_archivos WHERE id_egreso_archivo IN (@base,@base-1) AND url IN ('https://example.test/spec110-clasificado','https://example.test/spec110-ambiguo'); DELETE dbo.Egresos WHERE id_egreso IN (@base,@base-1) AND referencia IN ('SPEC110-CLASIFICADO','SPEC110-AMBIGUO'); DELETE dbo.Tratamiento_onicomicosis WHERE id_tratamiento IN (@base,@base-1) AND id_consulta IN (@base,@base-1); DELETE dbo.consultas WHERE id_consulta IN (@base,@base-1);`);
      console.log('Registros controlados retirados.');
    }
    await pool.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
