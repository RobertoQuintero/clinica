import Link from "next/link";
import { ArrowLeft, Info, Contact, MapPin, ExternalLink } from "lucide-react";
import { getSupplierById, getSupplierProducts } from "../actions";
import { getPhoneCodes } from "@/app/dashboard/pacientes/actions";
import EditSupplierButton from "./componentes/EditSupplierButton";
import AssociatedProductsTable from "./componentes/AssociatedProductsTable";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params;
  const id_proveedor = Number(id);

  const [supplier, phoneCodes, associatedProducts] = await Promise.all([
    getSupplierById(id_proveedor),
    getPhoneCodes(),
    getSupplierProducts(id_proveedor),
  ]);

  if (!supplier) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/proveedores"
          className="inline-flex items-center gap-1 text-sm text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] dark:hover:text-blue-400"
        >
          <ArrowLeft size={16} />
          Proveedores
        </Link>
        <p className="text-[#44474f] dark:text-zinc-400">Proveedor no encontrado.</p>
      </div>
    );
  }

  const codePrincipal = phoneCodes.find((pc) => pc.id_phone_code === supplier.id_phonecode_principal);
  const codeWhatsapp  = phoneCodes.find((pc) => pc.id_phone_code === supplier.id_whatsappcode_principal);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#44474f] dark:text-zinc-400 mb-1 text-xs">
            <Link href="/dashboard/proveedores" className="flex items-center gap-1 hover:text-[#0051d5] dark:hover:text-blue-400">
              <ArrowLeft size={14} />
              Proveedores
            </Link>
            <span>/</span>
            <span>{supplier.nombre_corto}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{supplier.nombre_corto}</h1>
        </div>
        <div className="flex items-center gap-3">
          <EditSupplierButton supplier={supplier} phoneCodes={phoneCodes} />
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Información general */}
        <div className="bg-[#eff4ff] dark:bg-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 mb-4 flex items-center gap-2">
            <Info size={18} className="text-[#0051d5] dark:text-blue-400" />
            Información General
          </h3>
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Nombre Corto</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.nombre_corto}</p>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Nombre Legal</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.nombre_legal || "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">RFC</p>
                <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.rfc || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Estatus</p>
                {supplier.activo ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#009c6b]/10 text-[#009c6b] border border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#d3e4fe] text-[#44474f] border border-[#c4c6d0] dark:bg-zinc-700 dark:text-zinc-400 dark:border-zinc-600">
                    Inactivo
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Sitio Web</p>
              {supplier.web ? (
                <a
                  href={supplier.web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0051d5] dark:text-blue-400 hover:underline flex items-center gap-1 w-fit"
                >
                  {supplier.web}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-[#eff4ff] dark:bg-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 mb-4 flex items-center gap-2">
            <Contact size={18} className="text-[#0051d5] dark:text-blue-400" />
            Contacto
          </h3>
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Teléfono Principal</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                {supplier.telefono_principal ? `${codePrincipal?.codigo ?? ""} ${supplier.telefono_principal}`.trim() : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">WhatsApp Principal</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                {supplier.whatsapp_principal ? `${codeWhatsapp?.codigo ?? ""} ${supplier.whatsapp_principal}`.trim() : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Teléfono Secundario</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.telefono_secundario || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">WhatsApp Secundario</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.whatsapp_secundario || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Email Principal</p>
              {supplier.email_principal ? (
                <a
                  href={`mailto:${supplier.email_principal}`}
                  className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100 hover:text-[#0051d5] dark:hover:text-blue-400"
                >
                  {supplier.email_principal}
                </a>
              ) : (
                <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Email Secundario</p>
              {supplier.email_secundario ? (
                <a
                  href={`mailto:${supplier.email_secundario}`}
                  className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100 hover:text-[#0051d5] dark:hover:text-blue-400"
                >
                  {supplier.email_secundario}
                </a>
              ) : (
                <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-[#eff4ff] dark:bg-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-[#0051d5] dark:text-blue-400" />
            Ubicación
          </h3>
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Dirección Completa</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.direccion || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 mb-1">Código Postal</p>
              <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.codigo_postal || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Productos asociados */}
      <AssociatedProductsTable products={associatedProducts} />
    </div>
  );
}
