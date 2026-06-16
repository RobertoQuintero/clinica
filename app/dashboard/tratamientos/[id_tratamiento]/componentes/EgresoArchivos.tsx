"use client";

import React, { useRef, useState } from "react";
import { buildDate } from "@/utils/date_helpper";
import {
  updateEgreso,
  getArchivosByEgreso,
  saveEgresoArchivo,
  IEgresoRow,
  IEgresoArchivoRow,
} from "@/app/dashboard/tratamientos/actions";
import { useAuth } from "@/contexts/AuthContext";

const MAX_SIZE_BYTES = 1 * 1024 * 1024;

const resizeImage = (file: File, maxWidth = 700, quality = 0.82): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas no disponible")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Error al comprimir imagen"))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });

const sanitize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export interface EgresoArchivosProps {
  egreso:          IEgresoRow;
  onStageUpdated?: (newStage: number) => void;
}

export default function EgresoArchivos({ egreso, onStageUpdated }: EgresoArchivosProps) {
  const { user } = useAuth();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [open,      setOpen]      = useState(false);
  const [archivos,  setArchivos]  = useState<IEgresoArchivoRow[]>([]);
  const [loaded,    setLoaded]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const rows = await getArchivosByEgreso(egreso.id_egreso);
    setArchivos(rows);
    setLoaded(true);
    setLoading(false);
  };

  const toggle = () => {
    if (!open && !loaded) load();
    setOpen((v) => !v);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf   = file.type === "application/pdf";
      if (!isImage && !isPdf) throw new Error("Solo se permiten imágenes o archivos PDF");

      let fileToSend: Blob;
      if (isImage) {
        fileToSend = await resizeImage(file);
        if (fileToSend.size > MAX_SIZE_BYTES)
          throw new Error("La imagen supera 1 MB incluso después de comprimir. Use una imagen de menor resolución.");
      } else {
        if (file.size > MAX_SIZE_BYTES) throw new Error("El PDF supera el tamaño máximo de 1 MB.");
        fileToSend = file;
      }

      const num       = archivos.length + 1;
      const ext       = isImage ? ".jpg" : ".pdf";
      const fileName  = `egreso_${egreso.id_egreso}_archivo_${num}${ext}`;
      const sanitized = sanitize(fileName);

      const uploadRes  = await fetch(
        `/api/upload?name=${encodeURIComponent(sanitized)}&folder=${encodeURIComponent("clinica/egresos")}`,
        {
          method:  "POST",
          headers: { "Content-Type": isImage ? "image/jpeg" : "application/pdf" },
          body:    fileToSend,
        },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error(uploadData.data ?? "Error al subir el archivo");

      const saved = await saveEgresoArchivo({
        id_egreso:  egreso.id_egreso,
        url:        String(uploadData.data),
        id_user:    user?.id_user ?? 0,
        created_at: buildDate(new Date()),
      });
      if (!saved.ok) throw new Error(saved.message ?? "Error al registrar el archivo");

      if (saved.data) setArchivos((prev) => [saved.data!, ...prev]);

      // auto-progress stage on upload
      const role  = user?.id_role;
      const stage = egreso.id_egreso_stage;
      let newStage: number | null = null;
      if ((role === 1 || role === 4) && stage === 1) newStage = 2;
      else if (role === 5 && stage === 2) newStage = 3;

      if (newStage !== null) {
        const stageResult = await updateEgreso({
          id_egreso:       egreso.id_egreso,
          id_egreso_tipo:  egreso.id_egreso_tipo,
          idMetodoPago:    egreso.idMetodoPago,
          iva_bit:         egreso.iva_bit ?? 0,
          iva:             egreso.iva,
          monto:           Number(egreso.monto),
          referencia:      egreso.referencia,
          id_egreso_stage: newStage,
        });
        if (stageResult.ok) onStageUpdated?.(newStage);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current)   fileInputRef.current.value   = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* file inputs: visually hidden but NOT display:none — Chrome freezes on display:none inputs */}
      <input
        id={`egreso-file-${egreso.id_egreso}`}
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}
        onChange={handleUpload}
      />
      <input
        id={`egreso-camera-${egreso.id_egreso}`}
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}
        onChange={handleUpload}
      />

      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Archivos
        </span>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 space-y-3">
          <div className="flex justify-end gap-2">

            {/* Foto — label triggers the camera input natively, no scripted .click() needed */}
            <label
              htmlFor={uploading ? undefined : `egreso-camera-${egreso.id_egreso}`}
              aria-disabled={uploading}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 ${uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Foto
            </label>

            {/* Subir — label triggers the file input natively */}
            <label
              htmlFor={uploading ? undefined : `egreso-file-${egreso.id_egreso}`}
              aria-disabled={uploading}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 ${uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              {uploading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Subiendo…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                  </svg>
                  Subir
                </>
              )}
            </label>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</p>
          )}

          {loading ? (
            <p className="text-xs text-zinc-400">Cargando…</p>
          ) : archivos.length === 0 ? (
            <p className="text-xs text-zinc-400">Sin archivos registrados.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    {["#", "Fecha", "Usuario", "Enlace"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                  {archivos.map((a, idx) => (
                    <tr key={a.id_egreso_archivo} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{archivos.length - idx}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{fmtDatetime(a.created_at)}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{a.user || "—"}</td>
                      <td className="px-3 py-2">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                          Ver archivo
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
