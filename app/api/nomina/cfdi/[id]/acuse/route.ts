import { NextResponse } from "next/server";
import { Readable } from "node:stream";

import { requireBillingAccess } from "@/lib/auth/session";
import { getOrgClient } from "@/lib/billing/facturapiClient";
import { toUserMessage } from "@/lib/billing/errors";
import { payrollCfdiDownloadParamsSchema } from "@/lib/payroll/schemas";
import { loadPayrollCfdiReceiptForDownload } from "@/lib/payroll/cfdi/payrollCfdiRepository";

export const runtime = "nodejs";

/**
 * Descarga el acuse de cancelación del CFDI de nómina (spec 99). Mismo patrón que
 * `xml/route.ts` de al lado, pero solo responde para recibos en `'C'`: cualquier otro
 * estado (o un recibo de otra empresa) se trata como 404, igual que un recibo inexistente.
 */
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
    if (!target || target.receipt.estado !== "C") {
      return NextResponse.json({ ok: false, message: "El recibo no existe o no está cancelado" }, { status: 404 });
    }

    const client = await getOrgClient(target.receipt.org_uid, id_empresa);
    const download = await client.invoices.downloadCancellationReceiptXml(target.receipt.facturapi_id as string);
    const body = download instanceof Readable ? (Readable.toWeb(download) as ReadableStream) : (download as Blob);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="NOM-${target.receipt.folio}-${target.codigoEmpleado}-acuse.xml"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: toUserMessage(err) }, { status: 400 });
  }
};
