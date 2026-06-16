"use client";

import { useEffect, useRef, useState } from "react";
import { buildDate } from "@/utils/date_helpper";
import {
  getRecetasByTratamiento,
  saveRecetaTratamiento,
  IRecetaTratamiento,
  updateTratamientoStage,
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

const buildWhatsAppUrl = (
  receta:             { ruta: string; created_at: string },
  whatsapp:           string | null,
  phone_code:         string | null,
  nombre_paciente:    string,
  nombre_podologo:    string,
  nombre_especialista: string,
): string | null => {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  const code   = phone_code ?? "52";
  const phone  = digits.startsWith(code) ? digits : `${code}${digits}`;

  const fecha = fmtDatetime(receta.created_at);

  const lines = [
    "*TRATAMIENTO ONICOMICOSIS*",
    "",
    `*Fecha receta:* ${fecha}`,
    `*Paciente:* ${nombre_paciente}`,
    `*Podólogo:* ${nombre_podologo}`,
    `*Especialista:* ${nombre_especialista}`,
    `*Enlace receta:* ${receta.ruta}`,
  ];

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
};

interface Props {
  id_tratamiento:     number;
  nombre_paciente:    string;
  nombre_podologo:    string;
  nombre_especialista: string;
  whatsapp:           string | null;
  phone_code:         string | null;
  id_stage:           number;
  id_role:            number;
}

export default function AccordionRecetas({ id_tratamiento, nombre_paciente, nombre_podologo, nombre_especialista, whatsapp, phone_code, id_stage, id_role }: Props) {
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
      if((id_stage === 2 || id_stage === 1) && id_role === 5) {
        await updateTratamientoStage(id_tratamiento, 3);
      }
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
          {
            (id_role === 5 ||id_role === 1 ||id_role === 4) &&
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
          }

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
                    {["#", "Tipo", "Fecha", "Enlace", ""].map((h) => (
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
                  {recetas.map((r, idx) => {
                    const waUrl = buildWhatsAppUrl(r, whatsapp, phone_code, nombre_paciente, nombre_podologo, nombre_especialista);
                    return (
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
                      <td className="px-4 py-3">
                        {id_role!==5? waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Enviar receta por WhatsApp"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors whitespace-nowrap"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-400">Sin WhatsApp</span>
                        )
                        :<></>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
