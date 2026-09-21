import { IEmployeeRecord } from "@/interfaces/employee";
import { dayFirst } from "@/utils/date_helpper";
import { IEmployeeCatalogs } from "../../actions";
import EmployeeAvatar from "../../componentes/EmployeeAvatar";
import EmployeeStatusBadge from "../../componentes/EmployeeStatusBadge";
import EmployeeActions from "./EmployeeActions";

interface Props {
  employee: IEmployeeRecord;
  catalogs: IEmployeeCatalogs;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold text-[#44474f] dark:text-zinc-400 col-span-1">{label}:</span>
      <span className="text-[#0b1c30] dark:text-zinc-100 col-span-2 break-words">{value}</span>
    </div>
  );
}

export default function EmployeeHeader({ employee, catalogs }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8">
        <EmployeeAvatar
          fotoUrl={employee.foto_url}
          nombreCompleto={employee.nombre_completo}
          sizeClassName="w-40 h-40 text-3xl mx-auto lg:mx-0"
        />

        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">
                  {employee.nombre_completo}
                </h1>
                <EmployeeStatusBadge activo={employee.activo} />
              </div>
              <p className="text-sm font-semibold text-[#0051d5] dark:text-blue-400">
                {employee.nombre_puesto}
              </p>
            </div>
            <EmployeeActions employee={employee} catalogs={catalogs} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="ID Empleado" value={employee.codigo_empleado} />
            <InfoRow label="WhatsApp" value={employee.whatsapp || "—"} />
            <InfoRow label="Fecha de ingreso" value={dayFirst(employee.fecha_ingreso + "T00:00:00")} />
            <InfoRow label="Correo" value={employee.email || "—"} />
            <InfoRow label="Sucursal" value={employee.nombre_sucursal} />
            <InfoRow label="RFC" value={employee.rfc || "—"} />
            <InfoRow label="CURP" value={employee.curp || "—"} />
            <InfoRow label="NSS" value={employee.nss || "—"} />
            <InfoRow label="Supervisor" value={employee.nombre_supervisor || "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}
