"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, X } from "lucide-react";
import { markOrderAsShipped } from "../../actions";

interface Props {
  id_purchase_order: number;
  onClose:   () => void;
  onUploaded: () => void;
}

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, "_");

export default function UploadInvoiceModal({ id_purchase_order, onClose, onUploaded }: Props) {
  const [mounted, setMounted]             = useState(false);
  const [file, setFile]                   = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate]     = useState("");
  const [uploading, setUploading]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (selected && selected.type !== "application/pdf") {
      setError("Solo se aceptan archivos PDF");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Selecciona el archivo de la factura");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fileName = sanitize(`factura_orden_${id_purchase_order}_${Date.now()}.pdf`);
      const uploadRes = await fetch(
        `/api/upload?name=${encodeURIComponent(fileName)}&folder=${encodeURIComponent("clinica/facturas")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        }
      );
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        throw new Error(uploadData.data ?? "Error al subir el archivo");
      }

      const result = await markOrderAsShipped(id_purchase_order, {
        invoice_url: String(uploadData.data),
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate || null,
      });
      if (!result.ok) {
        throw new Error(result.message);
      }

      onUploaded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado al cargar la factura");
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">Cargar factura</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Archivo PDF *
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full text-sm text-[#0b1c30] dark:text-zinc-100 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0051d5] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Número de factura (opcional)
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Fecha de factura (opcional)
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !file}
            className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0051d5]/90 transition-colors disabled:opacity-50"
          >
            <FileUp size={16} />
            {uploading ? "Subiendo…" : "Cargar y marcar como enviada"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
