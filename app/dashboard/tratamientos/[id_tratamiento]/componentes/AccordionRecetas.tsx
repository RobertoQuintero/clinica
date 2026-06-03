"use client";

import { useEffect, useRef, useState } from "react";
import { buildDate } from "@/utils/date_helpper";
import {
  getRecetasByTratamiento,
  saveRecetaTratamiento,
  IRecetaTratamiento,
} from "@/app/dashboard/tratamientos/actions";

const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

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

const sanitize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

interface Props {
  id_tratamiento:  number;
  nombre_paciente: string;
}

export default function AccordionRecetas({ id_tratamiento, nombre_paciente }: Props) {
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [open,      setOpen     ] = useState(true);
  const [recetas,   setRecetas  ] = useState<IRecetaTratamiento[]>([]);
  const [loading,   setLoading  ] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error,     setError    ] = useState<string | null>(null);

  useEffect(() => {
    getRecetasByTratamiento(id_tratamiento).then((rows) => {
      setRecetas(rows);
      setLoading(false);
    });
  }, [id_tratamiento]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const isImage    = file.type.startsWith("image/");
      const isPdf      = file.type === "application/pdf";

      if (!isImage && !isPdf) {
        throw new Error("Solo se permiten imágenes o archivos PDF");
      }

      let fileToSend: Blob;

      if (isImage) {
        fileToSend = await resizeImage(file);
        if (fileToSend.size > MAX_SIZE_BYTES) {
          throw new Error("La imagen supera 1 MB incluso después de comprimir. Use una imagen de menor resolución.");
        }
      } else {
        if (file.size > MAX_SIZE_BYTES) {
          throw new Error("El PDF supera el tamaño máximo de 1 MB.");
        }
        fileToSend = file;
      }

      const num      = recetas.length + 1;
      const ext      = isImage ? ".jpg" : ".pdf";
      const fileName = `${sanitize(nombre_paciente)}_tratamiento_${id_tratamiento}_RECETA_${num}${ext}`;

      const uploadRes  = await fetch(
        `/api/upload?name=${encodeURIComponent(fileName)}&folder=${encodeURIComponent("clinica/recetas")}`,
        {
          method:  "POST",
          headers: { "Content-Type": isImage ? "image/jpeg" : "application/pdf" },
          body:    fileToSend,
        },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error(uploadData.data ?? "Error al subir el archivo");

      const saved = await saveRecetaTratamiento({
        id_tratamiento,
        ruta:       String(uploadData.data),
        tipo:       isImage ? "imagen" : "pdf",
        created_at: buildDate(new Date()),
      });
      if (!saved.ok) throw new Error(saved.message ?? "Error al registrar la receta");

      if (saved.data) {
        setRecetas((prev) => [saved.data!, ...prev]);
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      {/* header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
          Recetas
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-5 py-4 space-y-4">
          {/* upload controls */}
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
              disabled={uploading}
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
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500 whitespace-nowrap"
            >
              {uploading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Subiendo…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                  </svg>
                  Subir receta
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          )}

          {/* list */}
          {loading ? (
            <p className="text-sm text-zinc-400">Cargando…</p>
          ) : recetas.length === 0 ? (
            <p className="text-sm text-zinc-400">Sin recetas registradas.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-800">
                  <tr>
                    {["#", "Tipo", "Fecha", "Enlace"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                  {recetas.map((r, idx) => (
                    <tr key={r.id_archivo} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
                        {recetas.length - idx}
                      </td>
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 capitalize">
                        {r.tipo || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                        {fmtDatetime(r.created_at)}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        <a
                          href={r.ruta}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Ver receta
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
