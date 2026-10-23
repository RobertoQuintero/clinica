// Entrada de `npm run capture:manual` (spec 93). Ver docs/sucursal-demo.md.
// 1. Valida que los 16 marcadores `captura:` de content/manual/nomina/*.md coincidan exactamente
//    con las definiciones de scripts/manual-captures/nomina.ts.
// 2. Abre Chromium, entra como el usuario demo.
// 3. Corre la fase de preparación (scripts/manual-captures/prepare.ts).
// 4. Captura las 16 pantallas y escribe public/manual/nomina/manifest.json.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import db from "@/database/connection";
import { buildDate } from "@/utils/date_helpper";
import { assertDemoUserPasswordConfigured } from "./demo/guard";
import { DEMO_USER_EMAIL } from "./demo/constants";
import { NOMINA_MANUAL_CAPTURES } from "./manual-captures/nomina";
import { prepareManualCaptures } from "./manual-captures/prepare";
import type { IManualCaptureContext } from "./manual-captures/types";

const MANUAL_CONTENT_DIR = path.join(process.cwd(), "content", "manual", "nomina");
const OUTPUT_DIR = path.join(process.cwd(), "public", "manual", "nomina");
const BASE_URL = process.env.MANUAL_CAPTURE_BASE_URL ?? "http://localhost:3000";
const CAPTURE_WIDTH = 1440;
const DEVICE_SCALE_FACTOR = 2;
const MARKER_PATTERN = /\(captura:([a-z0-9-]+)\)/g;

/** Lee todos los marcadores `captura:<name>` de content/manual/nomina/*.md. */
async function readMarkerNames(): Promise<Set<string>> {
  const files = (await readdir(MANUAL_CONTENT_DIR)).filter((file) => file.endsWith(".md"));
  const markers = new Set<string>();
  for (const file of files) {
    const body = await readFile(path.join(MANUAL_CONTENT_DIR, file), "utf-8");
    for (const match of body.matchAll(MARKER_PATTERN)) markers.add(match[1]);
  }
  return markers;
}

/** Falla con el nombre exacto si sobra o falta algún marcador/definición. */
function assertMarkersMatchDefinitions(markerNames: ReadonlySet<string>): void {
  const definitionNames = new Set(NOMINA_MANUAL_CAPTURES.map((definition) => definition.name));

  const missingDefinitions = [...markerNames].filter((name) => !definitionNames.has(name));
  const missingMarkers = [...definitionNames].filter((name) => !markerNames.has(name));

  if (missingDefinitions.length > 0 || missingMarkers.length > 0) {
    const lines: string[] = [];
    if (missingDefinitions.length > 0) {
      lines.push(`Marcadores sin definición: ${missingDefinitions.join(", ")}`);
    }
    if (missingMarkers.length > 0) {
      lines.push(`Definiciones sin marcador: ${missingMarkers.join(", ")}`);
    }
    throw new Error(lines.join(" | "));
  }
}

interface IDemoCaptureIds {
  id_sucursal: number;
  weeklyPeriodIds: number[];
  calculatedPeriodIds: Set<number>;
  aguinaldoPeriodId: number;
  ptuDistributionId: number;
  sampleEmployeeId: number;
  sampleEmployeeName: string;
}

/** Resuelve los ids de la Empresa Demo que la preparación y las capturas necesitan. */
async function fetchDemoCaptureIds(): Promise<IDemoCaptureIds> {
  const [empresa] = (await db.queryParams(
    `SELECT e.id_empresa, s.id_sucursal
       FROM [CentroPodologico].[dbo].[empresas] e
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_empresa = e.id_empresa
      WHERE e.nombre = 'Empresa Demo'`,
    {},
  )) as { id_empresa: number; id_sucursal: number }[];
  if (!empresa) throw new Error('No existe la Empresa Demo: corre "npm run seed:demo" primero.');

  const periods = (await db.queryParams(
    `SELECT id_period, status
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_sucursal = @id_sucursal AND tipo_periodo = 'O'
      ORDER BY fecha_inicio`,
    { id_sucursal: empresa.id_sucursal },
  )) as { id_period: number; status: number }[];

  const aguinaldo = (await db.queryParams(
    `SELECT id_period, status
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_sucursal = @id_sucursal AND tipo_periodo = 'E' AND concepto_extraordinario = 'A'`,
    { id_sucursal: empresa.id_sucursal },
  )) as { id_period: number; status: number }[];
  if (!aguinaldo[0]) throw new Error("No existe el periodo de aguinaldo de la Empresa Demo.");

  const ptu = (await db.queryParams(
    `SELECT id_ptu_distribution FROM [CentroPodologico].[payroll].[ptu_distributions] WHERE id_empresa = @id_empresa`,
    { id_empresa: empresa.id_empresa },
  )) as { id_ptu_distribution: number }[];
  if (!ptu[0]) throw new Error("No existe el reparto de PTU de la Empresa Demo.");

  const [employee] = (await db.queryParams(
    `SELECT id_empleado, nombre, apellido_paterno, apellido_materno
       FROM [CentroPodologico].[RH].[empleados]
      WHERE codigo_empleado = 'EMP-DEMO-001'`,
    {},
  )) as { id_empleado: number; nombre: string; apellido_paterno: string; apellido_materno: string }[];
  if (!employee) throw new Error("No existe el empleado EMP-DEMO-001 (podologo-1) de la Empresa Demo.");

  const calculatedPeriodIds = new Set(
    [...periods, aguinaldo[0]].filter((period) => period.status >= 2).map((period) => period.id_period),
  );

  return {
    id_sucursal: empresa.id_sucursal,
    weeklyPeriodIds: periods.map((period) => period.id_period),
    calculatedPeriodIds,
    aguinaldoPeriodId: aguinaldo[0].id_period,
    ptuDistributionId: ptu[0].id_ptu_distribution,
    sampleEmployeeId: employee.id_empleado,
    sampleEmployeeName: `${employee.nombre} ${employee.apellido_paterno} ${employee.apellido_materno}`,
  };
}

const HIDE_NEXT_DEV_INDICATOR_CSS = `
  nextjs-portal, [data-nextjs-dev-tools-button], #__next-build-watcher { display: none !important; }
`;

async function main(): Promise<void> {
  const demoUserPassword = assertDemoUserPasswordConfigured();

  const markerNames = await readMarkerNames();
  assertMarkersMatchDefinitions(markerNames);
  console.log(`${markerNames.size} marcadores coinciden con sus definiciones.`);

  const demoIds = await fetchDemoCaptureIds();

  const browser = await chromium.launch();
  const browserContext = await browser.newContext({
    viewport: { width: CAPTURE_WIDTH, height: 900 },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: "light",
  });
  await browserContext.addInitScript(() => window.localStorage.setItem("theme", "light"));
  const page = await browserContext.newPage();

  try {
    await page.goto(`${BASE_URL}/login`);
    await page.locator("#email").fill(DEMO_USER_EMAIL);
    await page.locator("#password").fill(demoUserPassword);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(`${BASE_URL}/dashboard`);
    console.log("Sesión iniciada como el usuario demo.");

    const context: IManualCaptureContext = await prepareManualCaptures(page, {
      baseUrl: BASE_URL,
      weeklyPeriodIds: demoIds.weeklyPeriodIds,
      calculatedPeriodIds: demoIds.calculatedPeriodIds,
      aguinaldoPeriodId: demoIds.aguinaldoPeriodId,
      ptuDistributionId: demoIds.ptuDistributionId,
      sampleEmployeeName: demoIds.sampleEmployeeName,
      sampleEmployeeId: demoIds.sampleEmployeeId,
    });
    console.log("Preparación terminada.");

    await mkdir(OUTPUT_DIR, { recursive: true });
    const captures: Record<string, { width: number; height: number }> = {};

    for (const definition of NOMINA_MANUAL_CAPTURES) {
      await page.goto(`${BASE_URL}${definition.path(context)}`);
      await page.addStyleTag({ content: HIDE_NEXT_DEV_INDICATOR_CSS });
      await page.waitForLoadState("networkidle");
      if (definition.beforeCapture) await definition.beforeCapture(page);

      const locator =
        definition.target === "content" ? page.locator("[data-manual-capture-content]") : page.locator(definition.target.locator);

      // El viewport debe cubrir el elemento completo: una captura más alta que el viewport obliga a
      // Chrome a hacer scroll y pegar varios recortes, y un encabezado `position: sticky` se repite
      // "pegado" en cada recorte intermedio en vez de quedarse en su lugar real de la página.
      const initialBox = await locator.boundingBox();
      if (!initialBox) throw new Error(`No se encontró el elemento de la captura "${definition.name}"`);
      await page.setViewportSize({ width: CAPTURE_WIDTH, height: Math.ceil(initialBox.y + initialBox.height) + 40 });

      const boundingBox = await locator.boundingBox();
      if (!boundingBox) throw new Error(`No se encontró el elemento de la captura "${definition.name}"`);

      const filePath = path.join(OUTPUT_DIR, `${definition.name}.png`);
      await locator.screenshot({ path: filePath });
      captures[definition.name] = {
        width: Math.round(boundingBox.width * DEVICE_SCALE_FACTOR),
        height: Math.round(boundingBox.height * DEVICE_SCALE_FACTOR),
      };
      console.log(`Capturada "${definition.name}".`);
    }

    const manifest = { generatedAt: buildDate(new Date()), captures };
    await writeFile(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    console.log(`manifest.json escrito con ${Object.keys(captures).length} capturas.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
