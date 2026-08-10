"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { ISupplier } from "@/interfaces/supplier";
import { IPhoneCode } from "@/interfaces/phone_code";
import { saveSupplier } from "../../actions";
import SupplierModal from "../../componentes/SupplierModal";

interface Props {
  supplier: ISupplier;
  phoneCodes: IPhoneCode[];
}

export default function EditSupplierButton({ supplier, phoneCodes }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<ISupplier>(supplier);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const openEdit = () => {
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
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={openEdit}
        className="px-4 py-2 bg-[#0051d5] text-white rounded-lg text-sm font-semibold hover:bg-[#0051d5]/90 flex items-center gap-2 transition-colors"
      >
        <Pencil size={18} />
        Editar Datos
      </button>

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
    </>
  );
}
