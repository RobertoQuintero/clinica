import type { ReactNode } from "react";
import Link from "next/link";
import ManualHelpLink from "@/app/dashboard/componentes/ManualHelpLink";
import { EMPLOYEE_SETUP_ANCHORS, PAYROLL_MANUAL_TOPICS } from "@/lib/manual/links";
import { IEmployeeRecord } from "@/interfaces/employee";
import { IEmployeeSchedule } from "@/interfaces/employee_schedule";
import { formatScheduleSummary } from "../horario/scheduleFormatting";
import EmployeeTerminationHistory from "./EmployeeTerminationHistory";
import { dayFirst } from "@/utils/date_helpper";
import { calculateAge, calculateSeniority } from "@/utils/employee_helpers";
import {
  SAT_CONTRACT_TYPES,
  SAT_REGIME_TYPES,
  SAT_WORKDAY_TYPES,
  describeCatalogKey,
} from "@/lib/payroll/satCatalogs";
import { getStampingIssues, isFiscalEmployee } from "@/lib/payroll/payrollStampingReadiness";

interface Props {
  employee: IEmployeeRecord;
  schedule: IEmployeeSchedule;
}

const GENERO_LABELS: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
};

const ESTADO_CIVIL_LABELS: Record<string, string> = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  divorciado: "Divorciado/a",
  viudo: "Viudo/a",
};

const TIPO_SALARIO_LABELS: Record<string, string> = {
  fijo: "Fijo",
  comision: "Por comisión",
  mixto: "Mixto (base + comisión)",
};

const formatCurrency = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold text-[#44474f] dark:text-zinc-400 col-span-1">{label}:</span>
      <span className="text-[#0b1c30] dark:text-zinc-100 col-span-2 break-words">{value}</span>
    </div>
  );
}

/** Detalle de solo lectura: única pestaña "Información General" (Datos Personales + Información Laboral). */
export default function EmployeeGeneralInfo({ employee, schedule }: Props) {
  const scheduleSummary = formatScheduleSummary(schedule.days);
  const age = calculateAge(employee.fecha_nacimiento);
  const seniority = calculateSeniority(employee.fecha_ingreso);
  const isFiscal = isFiscalEmployee(employee);
  const stampingIssues = getStampingIssues(employee, employee.clave_estado_sat);
  // Nombre que viajaría al SAT: nombre + apellidos en mayúsculas. No se guarda aparte (spec 71).
  const fiscalName = employee.nombre_completo.toUpperCase();
  const seniorityLabel =
    seniority.years === 0 && seniority.months === 0
      ? "Menos de 1 mes"
      : [
          seniority.years > 0 ? `${seniority.years} año${seniority.years === 1 ? "" : "s"}` : null,
          seniority.months > 0 ? `${seniority.months} mes${seniority.months === 1 ? "" : "es"}` : null,
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 shadow-sm flex flex-col gap-8">
      {/* Datos Personales */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#0b1c30] dark:text-zinc-100 mb-4 pb-2 border-b border-[#c4c6d0]/50 dark:border-zinc-700/50">
          Datos Personales
          <ManualHelpLink
            moduleSlug="nomina"
            topicSlug={PAYROLL_MANUAL_TOPICS.employeeSetup}
            anchor={EMPLOYEE_SETUP_ANCHORS.personalData}
          />
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <div className="flex flex-col gap-3">
            <InfoRow
              label="Fecha de nacimiento"
              value={employee.fecha_nacimiento ? dayFirst(employee.fecha_nacimiento + "T00:00:00") : "—"}
            />
            <InfoRow label="Edad" value={age !== null ? `${age} años` : "—"} />
            <InfoRow label="Género" value={employee.genero ? GENERO_LABELS[employee.genero] ?? employee.genero : "—"} />
            <InfoRow
              label="Estado civil"
              value={employee.estado_civil ? ESTADO_CIVIL_LABELS[employee.estado_civil] ?? employee.estado_civil : "—"}
            />
            <InfoRow label="Dirección" value={employee.direccion || "—"} />
          </div>
          <div className="flex flex-col gap-3">
            <InfoRow label="Contacto de emergencia" value={employee.contacto_emergencia || "—"} />
            <InfoRow label="WhatsApp de emergencia" value={employee.whatsapp_emergencia || "—"} />
            <InfoRow label="Contacto de emergencia 2" value={employee.contacto_emergencia_2 || "—"} />
            <InfoRow label="WhatsApp de emergencia 2" value={employee.whatsapp_emergencia_2 || "—"} />
          </div>
        </div>
      </div>

      {/* Información Laboral */}
      <div>
        <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100 mb-4 pb-2 border-b border-[#c4c6d0]/50 dark:border-zinc-700/50">
          Información Laboral
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <div className="flex flex-col gap-3">
            <InfoRow label="Puesto" value={employee.nombre_puesto} />
            <InfoRow label="Departamento" value={employee.nombre_departamento} />
            <InfoRow label="Turno" value={employee.nombre_turno || "—"} />
            <InfoRow
              label="Horario"
              value={
                <>
                  {scheduleSummary ?? "Sin horario definido"}{" "}
                  <Link
                    href={`/dashboard/empleados/${employee.id_empleado}/horario`}
                    className="font-semibold text-[#0051d5] dark:text-blue-400 hover:underline whitespace-nowrap"
                  >
                    Ver horario
                  </Link>
                </>
              }
            />
            <InfoRow label="Antigüedad" value={seniorityLabel} />
          </div>
          <div className="flex flex-col gap-3">
            <InfoRow label="Salario diario" value={formatCurrency(employee.salario_diario)} />
            <InfoRow label="Salario diario fiscal" value={formatCurrency(employee.salario_diario_fiscal)} />
            <InfoRow
              label="Tipo de salario"
              value={employee.tipo_salario ? TIPO_SALARIO_LABELS[employee.tipo_salario] ?? employee.tipo_salario : "—"}
            />
            <InfoRow label="Periodo de pago" value={employee.nombre_periodo_pago || "—"} />
            <InfoRow label="Cuenta bancaria" value={employee.cuenta_bancaria || "—"} />
          </div>
        </div>
      </div>

      {/* Datos fiscales (CFDI de nómina) */}
      <div>
        <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100 mb-4 pb-2 border-b border-[#c4c6d0]/50 dark:border-zinc-700/50">
          Datos fiscales
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <div className="flex flex-col gap-3">
            <InfoRow label="Nombre fiscal" value={fiscalName} />
            <InfoRow label="RFC" value={employee.rfc || "—"} />
            <InfoRow label="CURP" value={employee.curp || "—"} />
            <InfoRow label="NSS" value={employee.nss || "—"} />
            <InfoRow label="Código postal fiscal" value={employee.codigo_postal_fiscal || "—"} />
            <InfoRow
              label="Entidad federativa"
              value={employee.clave_estado_sat ?? "La sucursal no tiene estado"}
            />
          </div>
          <div className="flex flex-col gap-3">
            <InfoRow label="Tipo de régimen" value={describeCatalogKey(SAT_REGIME_TYPES, employee.tipo_regimen) ?? "—"} />
            <InfoRow label="Tipo de contrato" value={describeCatalogKey(SAT_CONTRACT_TYPES, employee.tipo_contrato) ?? "—"} />
            <InfoRow label="Tipo de jornada" value={describeCatalogKey(SAT_WORKDAY_TYPES, employee.tipo_jornada) ?? "—"} />
            <InfoRow label="Sindicalizado" value={employee.sindicalizado ? "Sí" : "No"} />
            <InfoRow
              label="Banco"
              value={employee.banco ? `${employee.banco} — ${employee.nombre_banco ?? "Banco no encontrado"}` : "—"}
            />
          </div>
        </div>

        <div className="mt-4 text-sm">
          {stampingIssues.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                {isFiscal ? "Pendiente para timbrar" : "Revisar antes de activar salario fiscal"}
              </p>
              <ul className="list-disc pl-5 text-amber-900 dark:text-amber-200">
                {stampingIssues.map((issue) => (
                  <li key={`${issue.field}-${issue.reason}`}>{issue.label}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[#44474f] dark:text-zinc-400">
              {isFiscal
                ? "Sin pendientes: el empleado tiene todo lo necesario para timbrar su nómina."
                : "Sin salario diario fiscal: estos datos no se exigen para la nómina."}
            </p>
          )}
        </div>
      </div>

      {/* Historial de bajas (spec 86) */}
      <EmployeeTerminationHistory employee={employee} />
    </div>
  );
}
