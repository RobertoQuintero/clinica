// Entrada de `npm run seed:demo` (spec 93). Ver docs/sucursal-demo.md.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { addZeroToday } from "@/utils/date_helpper";
import {
  assertDemoSeedAllowed,
  assertDemoUserPasswordConfigured,
  checkDemoPrerequisites,
  isDemoSeedConfirmed,
} from "./demo/guard";

async function promptConfirmation(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question('Escribe "demo" para continuar: ');
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  assertDemoSeedAllowed();
  assertDemoUserPasswordConfigured();

  console.log(`DB_HOST: ${process.env.DB_HOST}`);
  console.log(`DB_NAME: ${process.env.DB_NAME}`);

  const confirmation = await promptConfirmation();
  if (!isDemoSeedConfirmed(confirmation)) {
    console.log("Cancelado. No se escribió nada.");
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

  console.log("Requisitos previos completos. (La siembra todavía no está implementada: llega en el paso 2.)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
