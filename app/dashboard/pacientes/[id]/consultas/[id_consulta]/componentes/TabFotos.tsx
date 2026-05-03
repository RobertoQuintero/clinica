"use client";

import { saveArchivo } from "../actions";
import { IArchivo } from "@/interfaces/archivos";
import { IPaciente } from "@/interfaces/paciente";
import { buildDate } from "@/utils/date_helpper";
import { useRef, useState } from "react";

interface Props {
  archivos:       IArchivo[];
  onAddArchivo:   (a: IArchivo) => void;
  paciente:       IPaciente | null;
  id_paciente:    number;
  id_consulta:    number;
  /** Fixed category assigned to every upload; only items with this category are shown. */
  categoria:      string;
  locked?:        boolean;
  onContinuar?:   () => void;
}

const resizeImage = (file: File, maxWidth = 700, quality = 0.82): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img       = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale   = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas  = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
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

export default function TabFotos({ archivos, onAddArchivo, paciente, id_paciente, id_consulta, categoria, locked, onContinuar }: Props) {
  const fileInputRef                       = useRef<HTMLInputElement>(null);
  const cameraInputRef                     = useRef<HTMLInputElement>(null);
  const [uploadingFile,  setUploadingFile] = useState(false);
  const [uploadError,    setUploadError  ] = useState<string | null>(null);

  const visibleArchivos = archivos.filter((a) => a.categoria === categoria);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setUploadError(null);
    try {
      const isImage    = file.type.startsWith("image/");
      const fileToSend = isImage ? await resizeImage(file) : file;

      const sanitize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();
      const baseName  = paciente
        ? `${sanitize(paciente.nombre)}_${sanitize(paciente.apellido_paterno)}_consulta${id_consulta}`
        : `paciente${id_paciente}_consulta${id_consulta}`;
      const seq      = visibleArchivos.length + 1;
      const ext      = isImage ? ".jpg" : ".pdf";
      const fileName = `${baseName}_${seq}${ext}`;

      const uploadRes  = await fetch(`/api/upload?name=${encodeURIComponent(fileName)}`, {
        method: "POST",
        headers: { "Content-Type": isImage ? "image/jpeg" : "application/pdf" },
        body: fileToSend,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error(uploadData.data ?? "Error al subir el archivo");

      const tipo = file.type.startsWith("image/") ? "imagen" : "pdf";

      const archivoData = await saveArchivo({
        id_consulta,
        ruta:       String(uploadData.data),
        tipo,
        created_at: buildDate(new Date()),
        categoria,
      });
      if (!archivoData.ok) throw new Error(archivoData.data ?? "Error al registrar el archivo");

      onAddArchivo(archivoData.data);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current)   fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">

      {/* upload */}
      {!locked && (
        <div className="flex justify-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            disabled={uploadingFile}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Tomar foto
          </button>
          <button
            type="button"
            disabled={uploadingFile}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500 whitespace-nowrap"
          >
            {uploadingFile ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Subiendo...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                </svg>
                Subir imagen
              </>
            )}
          </button>
        </div>
      )}
      {uploadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {uploadError}
        </p>
      )}

      {visibleArchivos.length === 0 ? (
        <p className="text-zinc-400 text-sm">Sin archivos registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["Categoría", "Tipo", "Ruta"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {visibleArchivos.map((a) => (
                <tr key={a.id_archivo} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{a.categoria || "—"}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{a.tipo || "—"}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">
                    <a href={a.ruta} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                      {a.ruta}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!locked && onContinuar && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onContinuar}
            disabled={
              // visibleArchivos.length < 2 
              false
            }
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
