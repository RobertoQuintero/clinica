"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Save, TriangleAlert } from "lucide-react";
import type { PayrollIssuerInput } from "@/interfaces/organization";
import { updatePayrollIssuerData, setPayrollIssuer } from "../../../actions";
import {
  getPayrollIssuerIssues,
  getPayrollIssuerWarnings,
  getRequiredPayrollIssuerFields,
  type PayrollIssuerWarning,
} from "@/lib/billing/payrollIssuer";
import { SAT_JOB_RISK_CLASSES } from "@/lib/payroll/satCatalogs";

interface Props {
  orgId: string;
  /** RFC en vivo de Facturapi; decide si la CURP del emisor es obligatoria. */
  taxId: string | null;
  hasCertificate: boolean;
  isLive: boolean;
  payrollIssuer: PayrollIssuerInput & { isActive: boolean };
}

interface FormState {
  registro_patronal: string;
  riesgo_puesto: string;
  curp_emisor: string;
}

const inputClass =
  "rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5] dark:focus:ring-zinc-400";
const labelClass = "text-xs font-medium text-[#44474f] dark:text-zinc-400";

const WARNING_COPY: Record<PayrollIssuerWarning, { title: string; description: string }> = {
  no_certificate: {
    title: "Sin CSD",
    description: "Se puede activar, pero no podrá timbrar hasta que cargues el certificado.",
  },
  test_mode: {
    title: "En modo Test",
    description: "Se puede activar, pero los recibos no tendrán validez fiscal hasta pasar a Live.",
  },
};

/** Mismo criterio que `PayrollIssuerSchema`: mayúsculas y sin espacios. */
function normalizeIdentifier(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function toFormState(payrollIssuer: PayrollIssuerInput): FormState {
  return {
    registro_patronal: payrollIssuer.registro_patronal ?? "",
    riesgo_puesto: payrollIssuer.riesgo_puesto ?? "",
    curp_emisor: payrollIssuer.curp_emisor ?? "",
  };
}

export default function OrganizationPayrollIssuerSection({
  orgId,
  taxId,
  hasCertificate,
  isLive,
  payrollIssuer,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(payrollIssuer));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const savedForm = toFormState(payrollIssuer);
  const hasUnsavedChanges =
    form.registro_patronal !== savedForm.registro_patronal ||
    form.riesgo_puesto !== savedForm.riesgo_puesto ||
    form.curp_emisor !== savedForm.curp_emisor;

  const isCurpRequired = getRequiredPayrollIssuerFields(taxId).includes("curp_emisor");
  // El interruptor actúa sobre lo guardado (la acción lee de la BD), no sobre el borrador del formulario.
  const issues = getPayrollIssuerIssues(payrollIssuer, taxId);
  const warnings = getPayrollIssuerWarnings(hasCertificate, isLive);
  const isActive = payrollIssuer.isActive;
  const isSwitchDisabled = toggling || (!isActive && (issues.length > 0 || hasUnsavedChanges));

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: name === "riesgo_puesto" ? value : normalizeIdentifier(value),
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updatePayrollIssuerData(orgId, {
        registro_patronal: form.registro_patronal,
        riesgo_puesto: form.riesgo_puesto,
        curp_emisor: form.curp_emisor,
      });
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setSaveError("Error inesperado al guardar los datos del emisor de nómina");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    setToggleError(null);
    try {
      const result = await setPayrollIssuer(orgId, !isActive);
      if (!result.ok) {
        setToggleError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setToggleError("Error inesperado al cambiar el emisor de nómina");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">Emisor de nómina</h3>
        {isActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-[#009c6b]/10 px-3 py-1 text-xs font-semibold text-[#009c6b] dark:bg-emerald-900/20 dark:text-emerald-400">
            <BadgeCheck size={14} />
            Activa para nómina
          </span>
        ) : (
          <span className="rounded-full bg-[#44474f]/10 px-3 py-1 text-xs font-semibold text-[#44474f] dark:bg-zinc-700/50 dark:text-zinc-400">
            No timbra nómina
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {saveError && (
          <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Registro patronal *</span>
            <input
              type="text"
              name="registro_patronal"
              value={form.registro_patronal}
              onChange={handleChange}
              maxLength={11}
              autoComplete="off"
              spellCheck={false}
              placeholder="11 caracteres"
              className={`${inputClass} font-mono tracking-wider`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Clase de riesgo *</span>
            <select
              name="riesgo_puesto"
              value={form.riesgo_puesto}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Seleccione…</option>
              {SAT_JOB_RISK_CLASSES.map((riskClass) => (
                <option key={riskClass.key} value={riskClass.key}>
                  {riskClass.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>CURP del emisor{isCurpRequired ? " *" : ""}</span>
            <input
              type="text"
              name="curp_emisor"
              value={form.curp_emisor}
              onChange={handleChange}
              maxLength={18}
              autoComplete="off"
              spellCheck={false}
              placeholder="18 caracteres"
              className={`${inputClass} font-mono tracking-wider`}
            />
          </label>
        </div>

        <p className="text-xs text-[#44474f] dark:text-zinc-500">
          El registro patronal y la clase de riesgo son obligatorios para activar.{" "}
          {isCurpRequired
            ? "El RFC de esta organización es de persona física, así que también se exige la CURP."
            : "La CURP solo aplica si el RFC de la organización es de persona física."}{" "}
          Estos datos se guardan solo aquí y viajan en cada recibo de nómina.
        </p>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !hasUnsavedChanges}
            className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0051d5]/90 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Guardando…" : "Guardar datos"}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3 pt-4 border-t border-[#c4c6d0] dark:border-zinc-700">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span id="payroll-issuer-switch-label" className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Usar esta organización para timbrar nómina
            </span>
            <span className="text-xs text-[#44474f] dark:text-zinc-400">
              Solo una organización por empresa timbra la nómina. Activar esta desactiva la anterior.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-labelledby="payroll-issuer-switch-label"
            disabled={isSwitchDisabled}
            onClick={handleToggle}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-400 dark:focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive ? "bg-[#009c6b]" : "bg-[#c4c6d0] dark:bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {!isActive && issues.length > 0 && (
          <div className="rounded-md bg-[#eff4ff] dark:bg-zinc-800 px-4 py-3 text-sm text-[#0b1c30] dark:text-zinc-100">
            <p className="font-semibold">Para activarla falta:</p>
            <ul className="mt-1 list-disc pl-5 text-[#44474f] dark:text-zinc-300">
              {issues.map((issue) => (
                <li key={issue.field}>{issue.label}</li>
              ))}
            </ul>
          </div>
        )}

        {!isActive && issues.length === 0 && hasUnsavedChanges && (
          <p className="text-xs text-[#44474f] dark:text-zinc-400">
            Guarda los cambios para poder activarla.
          </p>
        )}

        {toggleError && (
          <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {toggleError}
          </p>
        )}

        {warnings.length > 0 && (
          <ul className="flex flex-col gap-2">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
              >
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">{WARNING_COPY[warning].title}.</span>{" "}
                  {WARNING_COPY[warning].description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
