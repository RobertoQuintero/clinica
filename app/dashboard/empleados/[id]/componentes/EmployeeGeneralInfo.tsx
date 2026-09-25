import type { ReactNode } from "react";
import Link from "next/link";
import { IEmployeeRecord } from "@/interfaces/employee";
import { IEmployeeSchedule } from "@/interfaces/employee_schedule";
import { formatScheduleSummary } from "../horario/scheduleFormatting";
import { dayFirst } from "@/utils/date_helpper";
import { calculateAge, calculateSeniority } from "@/utils/employee_helpers";

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
        <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100 mb-4 pb-2 border-b border-[#c4c6d0]/50 dark:border-zinc-700/50">
          Datos Personales
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
    </div>
  );
}
