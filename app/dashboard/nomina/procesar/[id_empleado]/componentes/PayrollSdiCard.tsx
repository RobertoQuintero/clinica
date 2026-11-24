"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IPayrollSdi } from "@/interfaces/payroll_calculation";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { regeneratePayrollSdi } from "../../actions";

export default function PayrollSdiCard({ sdi, canRegenerate, idPeriod, idEmpleado }: {
  sdi: IPayrollSdi | null; canRegenerate: boolean; idPeriod: number; idEmpleado: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regeneratePayrollSdi({ idPeriod, idEmpleado });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }
  const items = sdi?.estado === "C" ? [
    ["Salario diario fiscal", formatPayrollCurrency(sdi.salario_diario_fiscal!)],
    ["Fecha de ingreso", formatPeriodDate(sdi.fecha_ingreso!)],
    ["Cierre del periodo", formatPeriodDate(sdi.fecha_referencia!)],
    ["Antigüedad", `${sdi.antiguedad_anios} años`],
    ["Vacaciones", `${sdi.dias_vacaciones} días`],
    ["Aguinaldo", `${sdi.dias_aguinaldo} días`],
    ["Prima vacacional", `${sdi.porcentaje_prima_vacacional} %`],
    ["Factor de integración", sdi.factor_integracion!.toFixed(8)],
    ["Origen", sdi.origen === "procesamiento" ? "Cálculo de nómina" : "Preparación de timbrado"],
  ] : [];
  return (
    <section className="rounded-xl border border-[#c4c6d0] bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900" aria-labelledby="sdi-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e8f0] px-5 py-4 dark:border-zinc-700">
        <h3 id="sdi-title" className="font-semibold text-[#0b1c30] dark:text-zinc-100">Salario diario integrado</h3>
        {canRegenerate && <button type="button" onClick={regenerate} disabled={pending}
          className="rounded-lg border border-[#0051d5] px-3 py-2 text-sm font-semibold text-[#0051d5] disabled:opacity-50 dark:text-blue-300">
          {pending ? "Calculando…" : sdi ? "Regenerar SDI" : "Calcular SDI"}
        </button>}
      </div>
      <div className="space-y-3 px-5 py-4 text-sm text-[#44474f] dark:text-zinc-300">
        {!sdi && <p>El SDI se calculará al preparar el timbrado.</p>}
        {sdi?.estado === "E" && <p role="alert">No se pudo calcular el SDI: {sdi.motivo}</p>}
        {sdi?.estado === "C" && <>
          <p className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-100">{formatPayrollCurrency(sdi.salario_diario_integrado!)}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {items.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-medium">{value}</dd></div>)}
          </dl>
        </>}
        {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}
