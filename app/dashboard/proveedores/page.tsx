"use client";

import { ISupplier } from "@/interfaces/supplier";
import { IPhoneCode } from "@/interfaces/phone_code";
import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { getSuppliers, saveSupplier } from "./actions";
import { getPhoneCodes } from "@/app/dashboard/pacientes/actions";
import SupplierRow from "./componentes/SupplierRow";
import SupplierModal from "./componentes/SupplierModal";

const EMPTY: ISupplier = {
  id_proveedor: 0,
  id_empresa: 0,
  nombre_corto: "",
  nombre_legal: "",
  rfc: "",
  codigo_postal: "",
  direccion: "",
  web: "",
  telefono_principal: "",
  id_phonecode_principal: 52,
  telefono_secundario: "",
  whatsapp_principal: "",
  id_whatsappcode_principal: 52,
  whatsapp_secundario: "",
  email_principal: "",
  email_secundario: "",
  activo: true,
  status: true,
  created_at: "",
};

export default function ProveedoresPage() {
  const [suppliers, setSuppliers]   = useState<ISupplier[]>([]);
  const [phoneCodes, setPhoneCodes] = useState<IPhoneCode[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState<ISupplier>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    getPhoneCodes().then(setPhoneCodes);
  }, []);

  const openNew = () => {
    setForm(EMPTY);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (supplier: ISupplier) => {
    setForm(supplier);
    setError(null);
    setShowModal(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : name === "id_phonecode_principal" || name === "id_whatsappcode_principal"
          ? value === "" ? null : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveSupplier(form);
      if (!res.ok) throw new Error(res.message ?? "Error al guardar");
      setShowModal(false);
      await fetchSuppliers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const suppliersFiltrados = suppliers.filter((s) => {
    const query = search.toLowerCase();
    return (
      s.nombre_corto.toLowerCase().includes(query) ||
      (s.rfc ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Proveedores</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Gestiona y administra el directorio de proveedores.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
        >
          {/* <Plus size={18} /> */}
          Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-t-xl p-4">
        <div className="relative w-72 max-w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar proveedor por nombre o RFC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 pl-10 pr-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border-x border-b border-[#c4c6d0] dark:border-zinc-700 rounded-b-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Nombre</th>
                <th className="px-6 py-4 font-semibold">RFC</th>
                <th className="px-6 py-4 font-semibold">Teléfono</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliersFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                    Sin registros
                  </td>
                </tr>
              ) : (
                suppliersFiltrados.map((s) => (
                  <SupplierRow
                    key={s.id_proveedor}
                    supplier={s}
                    onEdit={openEdit}
                    onDeleted={fetchSuppliers}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <SupplierModal
          form={form}
          saving={saving}
          error={error}
          phoneCodes={phoneCodes}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
