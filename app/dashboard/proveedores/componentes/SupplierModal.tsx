"use client";

import { ISupplier } from "@/interfaces/supplier";
import { IPhoneCode } from "@/interfaces/phone_code";

interface Props {
  form: ISupplier;
  saving: boolean;
  error: string | null;
  phoneCodes: IPhoneCode[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const inputClass =
  "rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5] dark:focus:ring-zinc-400";
const labelClass = "text-xs font-medium text-[#44474f] dark:text-zinc-400";

export default function SupplierModal({ form, saving, error, phoneCodes, onChange, onSubmit, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
            {form.id_proveedor === 0 ? "Nuevo proveedor" : "Editar proveedor"}
          </h3>
          <button onClick={onClose} className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200 text-xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-6">
          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Información general */}
          <section className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Información general</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Nombre corto *</span>
                <input
                  type="text"
                  name="nombre_corto"
                  value={form.nombre_corto ?? ""}
                  onChange={onChange}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Nombre legal</span>
                <input
                  type="text"
                  name="nombre_legal"
                  value={form.nombre_legal ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>RFC</span>
                <input
                  type="text"
                  name="rfc"
                  value={form.rfc ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Sitio web</span>
                <input
                  type="text"
                  name="web"
                  value={form.web ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  name="activo"
                  checked={!!form.activo}
                  onChange={onChange}
                  className="h-4 w-4 rounded border-[#c4c6d0] dark:border-zinc-600 text-[#0051d5] focus:ring-[#0051d5]"
                />
                <span className={labelClass}>Proveedor activo</span>
              </label>
            </div>
          </section>

          {/* Contacto */}
          <section className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Contacto</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex gap-2">
                <label className="flex flex-col gap-1 w-28 shrink-0">
                  <span className={labelClass}>Código</span>
                  <select
                    name="id_phonecode_principal"
                    value={form.id_phonecode_principal ?? ""}
                    onChange={onChange}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {phoneCodes.map((pc) => (
                      <option key={pc.id_phone_code} value={pc.id_phone_code}>
                        {pc.bandera} {pc.codigo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className={labelClass}>Teléfono principal</span>
                  <input
                    type="text"
                    name="telefono_principal"
                    value={form.telefono_principal ?? ""}
                    onChange={onChange}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className={labelClass}>Teléfono secundario</span>
                <input
                  type="text"
                  name="telefono_secundario"
                  value={form.telefono_secundario ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>

              <div className="flex gap-2">
                <label className="flex flex-col gap-1 w-28 shrink-0">
                  <span className={labelClass}>Código</span>
                  <select
                    name="id_whatsappcode_principal"
                    value={form.id_whatsappcode_principal ?? ""}
                    onChange={onChange}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {phoneCodes.map((pc) => (
                      <option key={pc.id_phone_code} value={pc.id_phone_code}>
                        {pc.bandera} {pc.codigo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className={labelClass}>WhatsApp principal</span>
                  <input
                    type="text"
                    name="whatsapp_principal"
                    value={form.whatsapp_principal ?? ""}
                    onChange={onChange}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className={labelClass}>WhatsApp secundario</span>
                <input
                  type="text"
                  name="whatsapp_secundario"
                  value={form.whatsapp_secundario ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className={labelClass}>Email principal</span>
                <input
                  type="email"
                  name="email_principal"
                  value={form.email_principal ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Email secundario</span>
                <input
                  type="email"
                  name="email_secundario"
                  value={form.email_secundario ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          {/* Ubicación */}
          <section className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Ubicación</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Código postal</span>
                <input
                  type="text"
                  name="codigo_postal"
                  value={form.codigo_postal ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClass}>Dirección</span>
                <input
                  type="text"
                  name="direccion"
                  value={form.direccion ?? ""}
                  onChange={onChange}
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#c4c6d0] dark:border-zinc-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0051d5]/90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
