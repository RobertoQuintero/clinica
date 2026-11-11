"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import type { IPayrollCfdiReceipt } from "@/interfaces/payroll_cfdi";
import PayrollCfdiCancelDialog from "./PayrollCfdiCancelDialog";

interface Props {
  receipt: IPayrollCfdiReceipt;
  employeeName: string;
  issuerName: string | null;
}

/** Botón "Cancelar" de un recibo `'T'`, reutilizable en Procesar y en el Detalle (spec 99). */
export default function PayrollCfdiCancelButton({ receipt, employeeName, issuerName }: Props) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        title="Cancelar CFDI"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-[#ba1a1a] dark:text-red-400 hover:bg-[#ba1a1a]/10 dark:hover:bg-red-900/20 transition-colors"
      >
        <Ban size={14} aria-hidden />
        Cancelar
      </button>

      {showDialog && (
        <PayrollCfdiCancelDialog
          receipt={receipt}
          employeeName={employeeName}
          issuerName={issuerName}
          onClose={() => setShowDialog(false)}
          onCancelled={() => {
            setShowDialog(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
