import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileSignature,
  FileText,
  Fingerprint,
  HeartPulse,
  Home,
  LucideIcon,
  PackageCheck,
  ReceiptText,
  Stethoscope,
} from "lucide-react";
import { IEmployeeDocumentSlot } from "@/interfaces/employee_document";
import { dayFirst } from "@/utils/date_helpper";
import { EmployeeDocumentUploadButton } from "./EmployeeDocumentUploader";

interface Props {
  slot: IEmployeeDocumentSlot;
}

const DOCUMENT_TYPE_ICONS: Record<string, LucideIcon> = {
  BadgeCheck,
  Home,
  ReceiptText,
  Fingerprint,
  HeartPulse,
  FileSignature,
  PackageCheck,
  Stethoscope,
};

const MIME_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

/** Convierte bytes a la unidad más legible (KB o MB, 1 decimal). */
function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Inserta la transformación fl_attachment de Cloudinary para forzar la descarga con nombre. */
function buildDownloadUrl(url: string): string {
  return url.replace("/upload/", "/upload/fl_attachment/");
}

export default function EmployeeDocumentCard({ slot }: Props) {
  const { tipo, documento } = slot;
  const nombre = tipo?.nombre ?? documento?.nombre_personalizado ?? "Documento";
  const Icon = (tipo?.icono && DOCUMENT_TYPE_ICONS[tipo.icono]) || FileText;

  if (!documento) {
    return (
      <div className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-[#ba1a1a]/30 dark:border-red-800 rounded-xl p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow">
        <span className="absolute top-0 left-0 w-1 h-full bg-[#ba1a1a] dark:bg-red-500" />
        <div className="flex justify-between items-start pl-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-[#f3f3f4] dark:bg-zinc-800 flex items-center justify-center text-[#44474f] dark:text-zinc-400">
              <Icon size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[#0b1c30] dark:text-zinc-50">{nombre}</h4>
              <p className="text-xs text-[#ba1a1a] dark:text-red-400">Requerido</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 shrink-0 bg-[#ba1a1a]/10 text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap">
            <Clock3 size={12} /> Pendiente
          </span>
        </div>
        <div className="flex justify-end mt-auto pt-2">
          <EmployeeDocumentUploadButton
            id_tipo_documento={tipo?.id_tipo_documento ?? null}
            variant="upload"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-[#eff4ff] dark:bg-blue-950 flex items-center justify-center text-[#0051d5] dark:text-blue-400">
            <Icon size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#0b1c30] dark:text-zinc-50">{nombre}</h4>
            <p className="text-xs text-[#44474f] dark:text-zinc-400">
              {MIME_TYPE_LABELS[documento.mime_type ?? ""] ?? "Archivo"} • {formatFileSize(documento.size_bytes)}
            </p>
            <p className="text-xs text-[#44474f] dark:text-zinc-500 mt-0.5">
              {dayFirst(documento.created_at.replace(" ", "T"))}
              {documento.nombre_usuario_carga ? ` · ${documento.nombre_usuario_carga}` : ""}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 shrink-0 bg-[#009c6b]/10 text-[#009c6b] dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap">
          <CheckCircle2 size={12} /> Cargado
        </span>
      </div>
      <div className="flex justify-end items-center gap-1 mt-auto pt-2 flex-wrap">
        <a
          href={documento.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-400 hover:bg-[#eff4ff] dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1"
        >
          <Eye size={14} /> Ver
        </a>
        <a
          href={buildDownloadUrl(documento.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-400 hover:bg-[#eff4ff] dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1"
        >
          <Download size={14} /> Descargar
        </a>
        <EmployeeDocumentUploadButton
          id_tipo_documento={tipo?.id_tipo_documento ?? null}
          variant="replace"
        />
      </div>
    </div>
  );
}
