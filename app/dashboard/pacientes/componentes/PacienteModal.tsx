"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IPaciente } from "@/interfaces/paciente";
import { IPhoneCode } from "@/interfaces/phone_code";
import { ISucursal } from "@/interfaces/sucursal";
import { buildDateReverse } from "@/utils/date_helpper";

interface Props {
  form: IPaciente;
  saving: boolean;
  error: string | null;
  phoneCodes: IPhoneCode[];
  sucursales: ISucursal[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}


export default function PacienteModal({ form, saving, error, phoneCodes, sucursales, onChange, onSubmit, onClose }: Props) {
  const {user}= useAuth()
  const date=new Date(form.created_at)
  date.setHours(date.getHours()+24)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    if (["whatsapp", "telefono", "contacto_emergencia_whatsapp"].includes(name)) {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    } else if (["nombre", "apellido_paterno", "apellido_materno"].includes(name)) {
      e.target.value = e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    onChange(e);
  };
 

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_paciente === 0 ? "Nuevo paciente" : "Editar paciente"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {(
            [
              { name: "nombre",           label: "Nombre",              type: "text" },
              { name: "apellido_paterno", label: "Apellido paterno",    type: "text" },
              { name: "apellido_materno", label: "Apellido materno",    type: "text" },
              { name: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
            ] as { name: keyof IPaciente; label: string; type: string }[]
          ).map(({ name, label, type }) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
              <input
                type={type}
                name={name}
                value={String(form[name] ?? "")}
                onChange={handleChange}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
          ))}
          
          {
            ((new Date()< date)||!form.id_paciente ||( user?.id_role===1||user?.id_role===4))&&
            <>
            <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Código telefónico (WhatsApp)</span>
            <select
              name="id_phone_code"
              value={form.id_phone_code ?? ""}
              onChange={handleChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Seleccionar</option>
              {phoneCodes.map((pc) => (
                <option key={pc.id_phone_code} value={pc.id_phone_code}>
                  {pc.bandera} {pc.pais} ({pc.codigo})
                </option>
              ))}
            </select>
          </label>
            <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">WhatsApp</span>
            <input
              type="text"
              name="whatsapp"
              value={String(form.whatsapp ?? "")}
              onChange={handleChange}
              minLength={10}
              maxLength={10}
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>
            </>
          }
          
          {(
            [
              { name: "telefono",                     label: "Teléfono",                     type: "text", minLength: 10, maxLength: 10 },
              { name: "ciudad_preferida",             label: "Ciudad preferida",             type: "text" },
              { name: "direccion",                    label: "Dirección",                    type: "text" },
              { name: "contacto_emergencia_nombre",   label: "Nombre(Contacto emergencia)",   type: "text" },
              { name: "contacto_emergencia_whatsapp", label: "WhatsApp(Contacto emergencia)", type: "text", minLength: 10, maxLength: 10 },
            ] as { name: keyof IPaciente; label: string; type: string; minLength?: number; maxLength?: number }[]
          ).map(({ name, label, type, minLength, maxLength }) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
              <input
                type={type}
                name={name}
                value={String(form[name] ?? "")}
                onChange={handleChange}
                {...(minLength !== undefined && { minLength })}
                {...(maxLength !== undefined && { maxLength })}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sucursal</span>
            <select
              name="id_sucursal"
              value={form.id_sucursal ?? ""}
              onChange={handleChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Seleccionar</option>
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sexo</span>
            <select
              name="sexo"
              value={form.sexo}
              onChange={handleChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Seleccionar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </label>
          <label className="col-span-1 sm:col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Observaciones generales</span>
            <textarea
              name="observaciones_generales"
              value={form.observaciones_generales ?? ""}
              onChange={handleChange}
              rows={3}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
            />
          </label>
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
