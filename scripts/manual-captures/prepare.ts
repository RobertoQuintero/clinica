// Fase de preparación de las capturas del manual de Nómina (spec 93, paso 6 del plan; spec 95
// agrega el ciclo de aprobar/pagar): todo por la interfaz real, con el usuario demo ya autenticado.
// Autoriza las horas extra sembradas, calcula cada semana terminada (de la más vieja a la más
// nueva) y el aguinaldo, aprueba una semana vieja y lleva otra por el ciclo completo hasta Pagada,
// precarga y cierra el reparto de PTU, y al final autoriza un día extra en la última semana
// calculada para dejar "Recalcula" pendiente. Cada paso se salta si el periodo ya llegó ahí, para
// poder correr el script dos veces seguidas.
import type { Page } from "@playwright/test";
import type { IManualCaptureContext } from "./types";

export interface IPrepareManualCapturesInput {
  baseUrl: string;
  weeklyPeriodIds: readonly number[]; // orden cronológico; el último es la semana en curso (no se calcula)
  calculatedPeriodIds: ReadonlySet<number>; // periodos que ya estaban calculados antes de correr este paso
  aguinaldoPeriodId: number;
  ptuDistributionId: number;
  sampleEmployeeName: string; // "Diego Domínguez García" (podologo-1): a quien se le autorizan las horas
  sampleEmployeeId: number;
}

async function calculatePeriod(page: Page, baseUrl: string, idPeriod: number, alreadyCalculated: boolean): Promise<void> {
  await page.goto(`${baseUrl}/dashboard/nomina/procesar?periodo=${idPeriod}`);
  await page.waitForLoadState("networkidle");
  if (alreadyCalculated) return;

  const label = "Calcular nómina";
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: label, exact: true }).click();
  await page.waitForLoadState("networkidle");
}

/** Clic en "Aprobar" si el botón existe (estatus 2); si no, el periodo ya pasó ese punto. */
async function approvePeriod(page: Page, baseUrl: string, idPeriod: number): Promise<void> {
  await page.goto(`${baseUrl}/dashboard/nomina/procesar?periodo=${idPeriod}`);
  await page.waitForLoadState("networkidle");

  const approveButton = page.getByRole("button", { name: "Aprobar", exact: true });
  if ((await approveButton.count()) === 0) return;
  await approveButton.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Aprobar", exact: true }).click();
  // El modal se cierra después de que `router.refresh()` arranca, no cuando termina: esperar a que
  // se desmonte (en vez de solo "networkidle") evita leer el estatus viejo en la siguiente navegación.
  await page.getByRole("alertdialog").waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
}

/** Clic en "Desaprobar" con el motivo si el botón existe (estatus 3); si no, el periodo ya pasó ese punto. */
async function unapprovePeriod(page: Page, baseUrl: string, idPeriod: number, comentario: string): Promise<void> {
  await page.goto(`${baseUrl}/dashboard/nomina/procesar?periodo=${idPeriod}`);
  await page.waitForLoadState("networkidle");

  const unapproveButton = page.getByRole("button", { name: "Desaprobar", exact: true });
  if ((await unapproveButton.count()) === 0) return;
  await unapproveButton.click();
  await page.getByRole("alertdialog").getByLabel("Motivo").fill(comentario);
  await page.getByRole("alertdialog").getByRole("button", { name: "Desaprobar", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
}

/** Clic en "Marcar como pagada" si el botón existe (estatus 3); si no, el periodo ya pasó ese punto. */
async function payPeriod(page: Page, baseUrl: string, idPeriod: number): Promise<void> {
  await page.goto(`${baseUrl}/dashboard/nomina/procesar?periodo=${idPeriod}`);
  await page.waitForLoadState("networkidle");

  const payButton = page.getByRole("button", { name: "Marcar como pagada", exact: true });
  if ((await payButton.count()) === 0) return;
  await payButton.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pagada", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
}

async function authorizeOvertimeDay(
  page: Page,
  baseUrl: string,
  idPeriod: number,
  employeeName: string,
  hours: number,
): Promise<void> {
  await page.goto(`${baseUrl}/dashboard/nomina/horas-extra?periodo=${idPeriod}`);
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("button", { name: new RegExp(`horas extra de ${employeeName}`) })
    .first()
    .click();
  await page.getByLabel("Horas a autorizar").fill(String(hours));
  await page.getByRole("dialog").getByRole("button", { name: "Autorizar", exact: true }).click();
  await page.waitForLoadState("networkidle");
}

export async function prepareManualCaptures(
  page: Page,
  input: IPrepareManualCapturesInput,
): Promise<IManualCaptureContext> {
  const { baseUrl, weeklyPeriodIds, calculatedPeriodIds, aguinaldoPeriodId, ptuDistributionId, sampleEmployeeName } =
    input;

  // La semana en curso (la última) no se calcula; la penúltima es "la última semana terminada".
  const latestCalculatedPeriodId = weeklyPeriodIds[weeklyPeriodIds.length - 2];
  const periodsToCalculate = weeklyPeriodIds.slice(0, -1);
  // Spec 95: tres semanas viejas más, cada una con un rol distinto en el ciclo de aprobar/pagar.
  const readyToApprovePeriodId = weeklyPeriodIds[0]; // se queda En cálculo, limpia, para la captura de "Aprobar"
  const approvedPeriodId = weeklyPeriodIds[1]; // se aprueba y se queda ahí (estatus 3)
  const paidPeriodId = weeklyPeriodIds[2]; // recorre el ciclo completo hasta Pagada (estatus 4)

  // 1. Autoriza las horas extra sembradas (martes y jueves de podologo-1), antes de calcular esa semana.
  await authorizeOvertimeDay(page, baseUrl, latestCalculatedPeriodId, sampleEmployeeName, 2);

  // 2. Calcula cada semana terminada, de la más vieja a la más nueva (el ISR acumula por año).
  for (const idPeriod of periodsToCalculate) {
    await calculatePeriod(page, baseUrl, idPeriod, calculatedPeriodIds.has(idPeriod));
  }
  // El aguinaldo, después de las semanas (no depende de ellas, pero así queda al final del año).
  await calculatePeriod(page, baseUrl, aguinaldoPeriodId, calculatedPeriodIds.has(aguinaldoPeriodId));

  // 3. Aprueba una semana vieja y lleva otra por el ciclo completo (aprobar → desaprobar con motivo →
  //    aprobar → marcar como pagada). Cada transición se salta si el periodo ya está en ese estatus,
  //    para que el script se pueda correr dos veces seguidas sin fallar.
  await approvePeriod(page, baseUrl, approvedPeriodId);
  await approvePeriod(page, baseUrl, paidPeriodId);
  await unapprovePeriod(page, baseUrl, paidPeriodId, "Faltaba justificar una falta del periodo");
  await approvePeriod(page, baseUrl, paidPeriodId);
  await payPeriod(page, baseUrl, paidPeriodId);

  // 4. Precarga y cierra el reparto de PTU (ya hay filas 'F' del ejercicio que precargar).
  await page.goto(`${baseUrl}/dashboard/nomina/ptu/${ptuDistributionId}`);
  await page.waitForLoadState("networkidle");
  const alreadyClosed = (await page.getByRole("button", { name: "Reabrir reparto" }).count()) > 0;
  if (!alreadyClosed) {
    await page.getByRole("button", { name: "Precargar trabajadores", exact: true }).click();
    // Espera el mensaje de resultado de la precarga, no solo networkidle: el refresco de React
    // Server Components que sigue a `router.refresh()` no siempre termina de asentarse a tiempo
    // para el siguiente clic, y perderlo hace que "Cerrar reparto" caiga en un botón a punto de
    // desmontarse (el clic no lanza error, pero tampoco hace nada).
    await page.getByRole("status").waitFor();
    await page.waitForLoadState("networkidle");

    // "Cerrar reparto" resulta intermitente justo después de la precarga (la confirmación se
    // cierra sin error pero el estado a veces no llega a "Cerrado"); unos reintentos son más
    // baratos que perseguir la causa exacta de la carrera.
    let closedSuccessfully = false;
    for (let attempt = 1; attempt <= 3 && !closedSuccessfully; attempt += 1) {
      await page.getByRole("button", { name: "Cerrar reparto", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar reparto", exact: true }).click();
      await page.getByRole("alertdialog").waitFor({ state: "detached" });
      await page.waitForLoadState("networkidle");
      closedSuccessfully = (await page.getByRole("button", { name: "Reabrir reparto" }).count()) > 0;
      if (!closedSuccessfully) {
        await page.reload();
        await page.waitForLoadState("networkidle");
      }
    }
    if (!closedSuccessfully) {
      throw new Error("No se pudo cerrar el reparto de PTU tras 3 intentos: sigue en borrador.");
    }
  }

  // 5. Al final, un día extra autorizado DESPUÉS de calcular: deja "Recalcula" pendiente en esa semana.
  //    El miércoles de podologo-1 quedó con checada incompleta (solo entrada): se autoriza a mano.
  await authorizeOvertimeDay(page, baseUrl, latestCalculatedPeriodId, sampleEmployeeName, 1);

  return {
    periodIdsByState: {
      latestCalculatedPeriod: latestCalculatedPeriodId,
      recalculationPending: latestCalculatedPeriodId,
      christmasBonusCalculated: aguinaldoPeriodId,
      ptuDistributionClosed: null,
      approvedPeriod: approvedPeriodId,
      paidPeriod: paidPeriodId,
      none: null,
    },
    readyToApprovePeriodId,
    ptuDistributionId,
    sampleEmployeeId: input.sampleEmployeeId,
  };
}
