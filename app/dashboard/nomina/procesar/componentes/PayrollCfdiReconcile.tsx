"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reconcilePayrollReceipt } from "../actions";

export default function PayrollCfdiReconcile({ idReceipt, historical }: { idReceipt: number; historical: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("issued");
  const [evidence, setEvidence] = useState("");
  const [facturapiId, setFacturapiId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await reconcilePayrollReceipt({ idReceipt, outcome, evidence, facturapiId });
      if (!result.ok) setMessage(result.message);
      else { setOpen(false); router.refresh(); }
    } catch { setMessage("No se pudo consultar el estado."); }
    finally { setBusy(false); }
  }

  return <div className="flex flex-col gap-2 text-left text-xs max-w-sm">
    {historical ? <>
      <button type="button" onClick={() => setOpen(!open)} className="font-semibold text-blue-700 dark:text-blue-300 underline">Registrar revisión manual</button>
      {open && <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
        <p>Revisa el recibo en Facturapi antes de registrar el resultado.</p>
        <label>Resultado <select value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full rounded border p-1 dark:bg-zinc-900"><option value="issued">CFDI emitido</option><option value="not_issued">No se emitió</option></select></label>
        {outcome === "issued" && <label>ID del CFDI en Facturapi <input value={facturapiId} onChange={e => setFacturapiId(e.target.value)} className="w-full rounded border p-1 dark:bg-zinc-900" /></label>}
        <label>Referencia de la evidencia <textarea value={evidence} maxLength={1000} onChange={e => setEvidence(e.target.value)} className="w-full rounded border p-1 dark:bg-zinc-900" /></label>
        <button type="button" disabled={busy} onClick={submit} className="font-semibold text-blue-700 dark:text-blue-300 disabled:opacity-50">{busy ? "Guardando…" : "Guardar revisión"}</button>
      </div>}
    </> : <button type="button" onClick={submit} disabled={busy} className="font-semibold text-blue-700 dark:text-blue-300 underline disabled:opacity-50">{busy ? "Consultando…" : "Consultar estado"}</button>}
    {message && <p role="alert" className="text-red-700 dark:text-red-400">{message}</p>}
  </div>;
}
