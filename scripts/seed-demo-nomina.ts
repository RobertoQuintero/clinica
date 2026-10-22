// Entrada de `npm run seed:demo` (spec 93). Ver docs/sucursal-demo.md.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import db from "@/database/connection";
import { addZeroToday } from "@/utils/date_helpper";
import {
  assertDemoSeedAllowed,
  assertDemoUserPasswordConfigured,
  checkDemoPrerequisites,
  isDemoSeedConfirmed,
} from "./demo/guard";
import { removeDemoOrganization } from "./demo/removeDemo";
import { seedOrganization } from "./demo/seedOrganization";
import { seedPayrollInputs } from "./demo/seedPayrollInputs";
import { seedPeriods } from "./demo/seedPeriods";

async function promptConfirmation(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question('Escribe "demo" para continuar: ');
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const removeOnly = process.argv.includes("--remove");

  assertDemoSeedAllowed();
  const demoUserPassword = removeOnly ? null : assertDemoUserPasswordConfigured();

  console.log(`DB_HOST: ${process.env.DB_HOST}`);
  console.log(`DB_NAME: ${process.env.DB_NAME}`);

  const confirmation = await promptConfirmation();
  if (!isDemoSeedConfirmed(confirmation)) {
    console.log("Cancelado. No se escribió nada.");
    return;
  }

  if (removeOnly) {
    await db.transaction((tx) => removeDemoOrganization(tx));
    console.log("Empresa Demo borrada.");
    return;
  }

  const currentYear = Number(addZeroToday(new Date()).slice(0, 4));
  const prerequisites = await checkDemoPrerequisites(currentYear);
  const missing = prerequisites.filter((prerequisite) => !prerequisite.present);
  if (missing.length > 0) {
    console.error("Faltan parámetros fiscales para sembrar la Empresa Demo:");
    for (const prerequisite of missing) console.error(`  - ${prerequisite.label}`);
    process.exitCode = 1;
    return;
  }

  const demoUserPasswordHash = await bcrypt.hash(demoUserPassword as string, 10);
  const seeded = await db.transaction(async (tx) => {
    await removeDemoOrganization(tx);
    const organization = await seedOrganization(tx, demoUserPasswordHash);
    await seedPayrollInputs(tx, organization);
    await seedPeriods(tx, organization);
    return organization;
  });

  console.log(
    `Empresa Demo sembrada: id_empresa=${seeded.id_empresa}, id_sucursal=${seeded.id_sucursal}, ` +
      `${Object.keys(seeded.employeeIdsByKey).length} empleados.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
