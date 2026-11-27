import { NextResponse } from "next/server";
import { Readable } from "node:stream";

import { getCurrentPayrollUser } from "@/lib/payroll/access";
import { getOrgClientForStoredMode } from "@/lib/billing/facturapiClient";
import { toUserMessage } from "@/lib/billing/errors";
import { payrollCfdiDownloadParamsSchema } from "@/lib/payroll/schemas";
import { loadPayrollCfdiReceiptForDownload } from "@/lib/payroll/cfdi/payrollCfdiRepository";

export const runtime = "nodejs";

/** Descarga el PDF del CFDI de nómina (spec 98). Responde para `'T'`, `'X'` y `'C'` (spec 99). Mismo patrón que `xml/route.ts` de al lado. */
export const GET = async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const access = await getCurrentPayrollUser();
  if (!access.ok) return NextResponse.json(access, { status: 401 });
  const { id_empresa } = access.data;

  const parsed = payrollCfdiDownloadParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Solicitud inválida" },
      { status: 400 }
    );
  }

  try {
    const target = await loadPayrollCfdiReceiptForDownload(parsed.data.id, id_empresa);
    if (!target) {
      return NextResponse.json({ ok: false, message: "El recibo no existe o no está timbrado" }, { status: 404 });
    }

    const client = await getOrgClientForStoredMode(target.receipt.org_uid, id_empresa, target.receipt.livemode);
    const download = await client.invoices.downloadPdf(target.receipt.facturapi_id as string);
    const body = download instanceof Readable ? (Readable.toWeb(download) as ReadableStream) : (download as Blob);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="NOM-${target.receipt.folio}-${target.codigoEmpleado}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: toUserMessage(err) }, { status: 400 });
  }
};
