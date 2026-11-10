import { NextResponse } from "next/server";
import { Readable } from "node:stream";

import { requireBillingAccess } from "@/lib/auth/session";
import { getOrgClient } from "@/lib/billing/facturapiClient";
import { toUserMessage } from "@/lib/billing/errors";
import { payrollCfdiDownloadParamsSchema } from "@/lib/payroll/schemas";
import { loadPayrollCfdiReceiptForDownload } from "@/lib/payroll/cfdi/payrollCfdiRepository";

export const runtime = "nodejs";

/** Descarga el PDF del CFDI de nómina (spec 98). Mismo patrón que `xml/route.ts` de al lado. */
export const GET = async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  let id_empresa: number;
  try {
    ({ id_empresa } = await requireBillingAccess());
  } catch (err) {
    return NextResponse.json({ ok: false, message: toUserMessage(err) }, { status: 401 });
  }

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

    const client = await getOrgClient(target.receipt.org_uid, id_empresa);
    const download = await client.invoices.downloadPdf(target.receipt.facturapi_id as string);
    const body = download instanceof Readable ? (Readable.toWeb(download) as ReadableStream) : (download as Blob);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="NOM-${target.receipt.folio}-${target.codigoEmpleado}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: toUserMessage(err) }, { status: 400 });
  }
};
