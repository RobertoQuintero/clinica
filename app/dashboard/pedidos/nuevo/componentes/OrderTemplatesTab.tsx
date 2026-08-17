"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, TriangleAlert, X } from "lucide-react";
import {
  getPurchaseOrderTemplates,
  getPurchaseOrderTemplateById,
  deletePurchaseOrderTemplate,
} from "@/app/dashboard/pedidos/actions";
import { IPurchaseOrderTemplateListItem } from "@/interfaces/purchase_order_template";
import { usePurchaseCart, IPurchaseCartLine } from "@/contexts/PurchaseCartContext";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import OrderTemplateCard from "./OrderTemplateCard";
import EditOrderTemplateModal from "./EditOrderTemplateModal";

interface Props {
  onCreateNew: () => void;
}

/** Líneas de una plantilla, ya mapeadas al carrito, agrupadas con lo que se tuvo que omitir. */
interface PreparedTemplateLines {
  cartLines:     IPurchaseCartLine[];
  omittedNames:  string[];
}

export default function OrderTemplatesTab({ onCreateNew }: Props) {
  const { lines: cartLines, replaceLines } = usePurchaseCart();

  const [templates, setTemplates] = useState<IPurchaseOrderTemplateListItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");

  const [editingId, setEditingId]           = useState<number | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<IPurchaseOrderTemplateListItem | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [deleteError, setDeleteError]       = useState<string | null>(null);

  const [usingTemplateId, setUsingTemplateId] = useState<number | null>(null);
  const [pendingReplace, setPendingReplace]   = useState<PreparedTemplateLines | null>(null);
  const [notice, setNotice]                   = useState<string | null>(null);

  const loadTemplates = () => {
    setLoading(true);
    setError(null);
    getPurchaseOrderTemplates().then((result) => {
      if (result.ok) {
        setTemplates(result.data);
      } else {
        setError(result.message);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const term = search.trim().toLowerCase();
    return templates.filter((template) => template.name.toLowerCase().includes(term));
  }, [templates, search]);

  const handleDeleteConfirmed = async () => {
    if (!deletingTemplate) return;
    setDeleting(true);
    setDeleteError(null);

    const result = await deletePurchaseOrderTemplate(deletingTemplate.id_purchase_order_template);

    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }

    setDeletingTemplate(null);
    loadTemplates();
  };

  /** Resuelve las líneas de una plantilla contra el catálogo actual y separa las utilizables de las omitidas. */
  const prepareTemplateLines = async (
    template: IPurchaseOrderTemplateListItem
  ): Promise<PreparedTemplateLines | null> => {
    const result = await getPurchaseOrderTemplateById(template.id_purchase_order_template);
    if (!result.ok) {
      setNotice(result.message);
      return null;
    }

    const availableItems = result.data.items.filter((item) => item.is_available);
    const omittedNames = result.data.items
      .filter((item) => !item.is_available)
      .map((item) => item.product_name || `Producto #${item.id_product}`);

    const cartLinesFromTemplate: IPurchaseCartLine[] = availableItems.map((item) => ({
      id_product: item.id_product,
      product_name: item.product_name,
      product_code: item.product_code,
      brand: item.brand,
      id_unit_measurement: item.id_unit_measurement,
      id_supplier: item.id_supplier,
      pieces: item.pieces,
      split: item.split,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    return { cartLines: cartLinesFromTemplate, omittedNames };
  };

  const buildOmittedNotice = (omittedNames: string[]) =>
    omittedNames.length > 0
      ? `Se omitieron ${omittedNames.length} ${omittedNames.length === 1 ? "producto" : "productos"} que ya no están disponibles: ${omittedNames.join(", ")}.`
      : null;

  const handleUseTemplate = async (template: IPurchaseOrderTemplateListItem) => {
    setNotice(null);
    setUsingTemplateId(template.id_purchase_order_template);

    const prepared = await prepareTemplateLines(template);

    setUsingTemplateId(null);

    if (!prepared) return;

    if (prepared.cartLines.length === 0) {
      setNotice(
        prepared.omittedNames.length > 0
          ? `Ningún producto de "${template.name}" está disponible actualmente: ${prepared.omittedNames.join(", ")}. El carrito no se modificó.`
          : `La plantilla "${template.name}" no tiene productos. El carrito no se modificó.`
      );
      return;
    }

    if (cartLines.length > 0) {
      setPendingReplace(prepared);
      return;
    }

    replaceLines(prepared.cartLines);
    setNotice(buildOmittedNotice(prepared.omittedNames));
  };

  const confirmReplace = () => {
    if (!pendingReplace) return;
    replaceLines(pendingReplace.cartLines);
    setNotice(buildOmittedNotice(pendingReplace.omittedNames));
    setPendingReplace(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex-1 min-w-[250px]">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar plantillas por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
        />
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-[#ffd8cc] bg-[#fff8f6] dark:border-orange-900/50 dark:bg-orange-900/10 px-4 py-3">
          <TriangleAlert size={16} className="text-[#d94f27] dark:text-orange-400 shrink-0 mt-0.5" />
          <p className="text-sm text-[#44474f] dark:text-zinc-300 flex-1">{notice}</p>
          <button
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            className="text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredTemplates.map((template) => (
            <OrderTemplateCard
              key={template.id_purchase_order_template}
              template={template}
              onEdit={(t) => setEditingId(t.id_purchase_order_template)}
              onDelete={(t) => {
                setDeleteError(null);
                setDeletingTemplate(t);
              }}
              onUse={handleUseTemplate}
            />
          ))}

          <button
            onClick={onCreateNew}
            className="bg-transparent border-2 border-dashed border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col justify-center items-center text-center hover:bg-[#eff4ff] dark:hover:bg-zinc-800 hover:border-[#0051d5] transition-all min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-full bg-[#eff4ff] dark:bg-zinc-800 flex items-center justify-center mb-4 text-[#0051d5] dark:text-blue-400">
              <Plus size={22} />
            </div>
            <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100 mb-1">
              Crear Nueva Plantilla
            </h3>
            <p className="text-sm text-[#44474f] dark:text-zinc-400 max-w-xs">
              Arma el carrito en &quot;Sugeridos para pedir&quot; o &quot;Todos los productos&quot; y guárdalo como plantilla.
            </p>
          </button>
        </div>
      )}

      {usingTemplateId !== null && (
        <p className="text-sm text-[#44474f] dark:text-zinc-400">Cargando plantilla…</p>
      )}

      {editingId !== null && (
        <EditOrderTemplateModal
          id_purchase_order_template={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            loadTemplates();
          }}
        />
      )}

      {deletingTemplate && (
        <ConfirmModal
          message={`¿Eliminar la plantilla "${deletingTemplate.name}"? Esta acción no se puede deshacer desde la interfaz.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeletingTemplate(null)}
          loading={deleting}
          error={deleteError}
          confirmLabel="Eliminar"
        />
      )}

      {pendingReplace && (
        <ConfirmModal
          message={`El carrito ya tiene ${cartLines.length} ${cartLines.length === 1 ? "línea" : "líneas"}. Cargar esta plantilla reemplazará el carrito actual. ¿Continuar?`}
          onConfirm={confirmReplace}
          onCancel={() => setPendingReplace(null)}
          confirmLabel="Reemplazar carrito"
        />
      )}
    </div>
  );
}
