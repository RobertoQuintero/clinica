"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { IDocumentType, EmployeeDocumentInput } from "@/interfaces/employee_document";
import { saveEmployeeDocument } from "../actions";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const OTHER_VALUE = "otro";

interface UploadContextValue {
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

const UploadContext = createContext<UploadContextValue | null>(null);

function useUploadContext(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("Este componente debe usarse dentro de EmployeeDocumentUploadProvider");
  }
  return ctx;
}

/**
 * Comparte la selección de tipo entre las tarjetas y el panel "Cargar Documento" del lado
 * derecho, para que "Subir"/"Reemplazar" preseleccionen el tipo sin duplicar la lógica de subida.
 */
export function EmployeeDocumentUploadProvider({ children }: { children: React.ReactNode }) {
  const [selectedValue, setSelectedValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <UploadContext.Provider value={{ selectedValue, setSelectedValue, panelRef }}>
      {children}
    </UploadContext.Provider>
  );
}

interface UploadButtonProps {
  id_tipo_documento: number | null;
  variant: "upload" | "replace";
}

/** Botón de las tarjetas: preselecciona su tipo en el panel de carga y lo trae a la vista. */
export function EmployeeDocumentUploadButton({ id_tipo_documento, variant }: UploadButtonProps) {
  const { setSelectedValue, panelRef } = useUploadContext();

  const handleClick = () => {
    setSelectedValue(id_tipo_documento === null ? OTHER_VALUE : String(id_tipo_documento));
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  if (variant === "upload") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="px-4 py-2 bg-[#0051d5] text-white text-xs font-semibold rounded-lg hover:bg-[#0043b0] transition-colors flex items-center gap-1.5"
      >
        <UploadCloud size={14} /> Subir
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-3 py-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-400 hover:bg-[#f3f3f4] dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
    >
      <RefreshCw size={14} /> Reemplazar
    </button>
  );
}

interface Props {
  id_empleado: number;
  documentTypes: IDocumentType[];
}

/** Panel "Cargar Documento": drag & drop, selector de tipo y la única llamada a /api/upload + saveEmployeeDocument. */
export default function EmployeeDocumentUploader({ id_empleado, documentTypes }: Props) {
  const { selectedValue, setSelectedValue, panelRef } = useUploadContext();
  const [nombrePersonalizado, setNombrePersonalizado] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isOtro = selectedValue === OTHER_VALUE;

  async function uploadFile(file: File) {
    setError(null);

    const extension = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Formato no permitido. Solo se aceptan PDF, JPG y PNG.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("El archivo supera el tamaño máximo de 5 MB.");
      return;
    }
    if (!selectedValue) {
      setError("Selecciona a qué documento pertenece el archivo.");
      return;
    }
    if (isOtro && !nombrePersonalizado.trim()) {
      setError("Escribe un nombre para el documento.");
      return;
    }

    setUploading(true);
    try {
      const fileName = `empleado_${id_empleado}_${Date.now()}_${file.name}`;
      const uploadRes = await fetch(
        `/api/upload?folder=clinica/empleados/documentos&name=${encodeURIComponent(fileName)}`,
        { method: "POST", headers: { "Content-Type": file.type }, body: file }
      );
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error(uploadData.data ?? "Error al subir el archivo");

      const input: EmployeeDocumentInput = {
        id_empleado,
        id_tipo_documento: isOtro ? null : Number(selectedValue),
        nombre_personalizado: isOtro ? nombrePersonalizado.trim() : null,
        url: uploadData.data,
        mime_type: file.type,
        size_bytes: file.size,
      };
      const result = await saveEmployeeDocument(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSelectedValue("");
      setNombrePersonalizado("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div
      ref={panelRef}
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col gap-6"
    >
      <div>
        <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Cargar Documento</h3>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Sube archivos adicionales o reemplaza existentes.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) fileInputRef.current?.click();
        }}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-[#0051d5] bg-[#eff4ff] dark:bg-blue-950"
            : "border-[#c4c6d0] dark:border-zinc-700 bg-[#f8f9fb] dark:bg-zinc-800/50 hover:bg-[#f3f3f4] dark:hover:bg-zinc-800"
        }`}
      >
        {uploading ? (
          <Loader2 className="animate-spin text-[#0051d5] dark:text-blue-400 mb-3" size={32} />
        ) : (
          <div className="w-14 h-14 bg-[#eff4ff] dark:bg-blue-950 rounded-full flex items-center justify-center mb-3">
            <UploadCloud className="text-[#0051d5] dark:text-blue-400" size={26} />
          </div>
        )}
        <p className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 mb-1">
          {uploading ? "Subiendo…" : "Arrastra y suelta tu archivo aquí"}
        </p>
        {!uploading && (
          <>
            <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-3">o</p>
            <span className="px-4 py-2 bg-[#0051d5] text-white text-xs font-semibold rounded-lg">
              Explorar Archivos
            </span>
          </>
        )}
        <p className="text-[11px] text-[#44474f] dark:text-zinc-500 mt-4">
          Formatos soportados: PDF, JPG, PNG (máx. 5 MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">Asignar a:</label>
        <select
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          disabled={uploading}
          className="w-full bg-white dark:bg-zinc-800 border border-[#c4c6d0] dark:border-zinc-700 rounded-lg py-2 px-3 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:border-[#0051d5]"
        >
          <option value="">Selecciona un tipo de documento…</option>
          {documentTypes.map((tipo) => (
            <option key={tipo.id_tipo_documento} value={tipo.id_tipo_documento}>
              {tipo.nombre}
            </option>
          ))}
          <option value={OTHER_VALUE}>Otro documento…</option>
        </select>
        {isOtro && (
          <input
            type="text"
            value={nombrePersonalizado}
            onChange={(e) => setNombrePersonalizado(e.target.value)}
            placeholder="Nombre del documento"
            disabled={uploading}
            className="w-full bg-white dark:bg-zinc-800 border border-[#c4c6d0] dark:border-zinc-700 rounded-lg py-2 px-3 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:border-[#0051d5]"
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-[#ba1a1a] dark:text-red-400 bg-[#ba1a1a]/5 dark:bg-red-900/20 border border-[#ba1a1a]/20 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
