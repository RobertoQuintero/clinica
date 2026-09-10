"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  IPurchaseRequestDetail,
  IRequestProduct,
  PURCHASE_REQUEST_STATUS,
} from "@/interfaces/purchase_request";
import { IProductCategory } from "@/interfaces/product_category";
import { IUnitMeasurement } from "@/interfaces/unit_measurement";
import { getCategories, getUnitsMeasurement } from "@/app/dashboard/productos/actions";
import {
  getPurchaseRequestDetail,
  getProductsForRequest,
  updatePurchaseRequest,
  cancelPurchaseRequest,
} from "../actions";
import RequestProductsTable from "../componentes/RequestProductsTable";
import RequestStatusBadge from "../componentes/RequestStatusBadge";
import RejectRequestModal from "../componentes/RejectRequestModal";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import { dayFirst } from "@/utils/date_helpper";

/** Roles con permiso para confirmar/rechazar, igual que en `actions.ts`. */
const REVIEWER_ROLE_IDS = [1, 4, 6];

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id_purchase_request = Number(params.id);

  const [request, setRequest] = useState<IPurchaseRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Estado de edición (solo aplica si el rol 2 dueño ve la solicitud en Pendiente).
  const [products, setProducts]     = useState<IRequestProduct[]>([]);
  const [categories, setCategories] = useState<IProductCategory[]>([]);
  const [units, setUnits]           = useState<IUnitMeasurement[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes]           = useState("");
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling]               = useState(false);
  const [cancelError, setCancelError]             = useState<string | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchRequest = () => {
    setLoading(true);
    setError(null);
    return getPurchaseRequestDetail(id_purchase_request)
      .then((result) => {
        if (result.ok) {
          setRequest(result.data);
          setNotes(result.data.notes ?? "");
          setQuantities(
            Object.fromEntries(result.data.items.map((item) => [item.id_product, item.quantity]))
          );
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id_purchase_request) return;
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_purchase_request]);

  useEffect(() => {
    getUnitsMeasurement().then(setUnits);
  }, []);

  const isOwnerPending =
    !!user &&
    !!request &&
    user.id_role === 2 &&
    request.id_user_created === user.id_user &&
    request.id_status_request === PURCHASE_REQUEST_STATUS.PENDING;

  const canReview =
    !!user &&
    REVIEWER_ROLE_IDS.includes(user.id_role) &&
    request?.id_status_request === PURCHASE_REQUEST_STATUS.PENDING;

  useEffect(() => {
    if (!isOwnerPending || !request) return;
    getCategories().then(setCategories);
    getProductsForRequest(request.id_sucursal).then((result) => {
      if (result.ok) setProducts(result.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerPending, request?.id_sucursal]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id_category, c.name])),
    [categories]
  );
  const unitNameById = useMemo(
    () => new Map(units.map((u) => [u.id_unit_measurement, u.name])),
    [units]
  );

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.product_code ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || String(product.id_category) === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    return [...filtered].sort((a, b) => {
      const aSelected = (quantities[a.id_product] ?? 0) > 0;
      const bSelected = (quantities[b.id_product] ?? 0) > 0;
      if (aSelected === bSelected) return 0;
      return aSelected ? -1 : 1;
    });
  }, [products, search, categoryFilter, quantities]);

  const handleQuantityChange = (id_product: number, quantity: number) => {
    setQuantities((current) => ({ ...current, [id_product]: quantity }));
  };

  const handleSave = async () => {
    const lines = Object.entries(quantities)
      .map(([id, quantity]) => ({ id_product: Number(id), quantity }))
      .filter((line) => line.quantity > 0);

    if (lines.length === 0) {
      setSaveError("La solicitud debe tener al menos un producto con cantidad mayor a cero");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await updatePurchaseRequest({
      id_purchase_request,
      notes: notes.trim() || null,
      lines,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    await fetchRequest();
  };

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    const result = await cancelPurchaseRequest(id_purchase_request);
    if (result.ok) {
      setShowCancelConfirm(false);
      await fetchRequest();
    } else {
      setCancelError(result.message);
    }
    setCancelling(false);
  };

  if (loading) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (error || !request) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#ba1a1a] dark:text-red-400">
          {error ?? "No se encontró la solicitud"}
        </p>
        <button
          onClick={() => router.push("/dashboard/solicitudes")}
          className="self-start text-sm font-semibold text-[#0051d5] hover:underline"
        >
          Volver a solicitudes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/solicitudes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Volver a solicitudes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{request.folio}</h2>
          <RequestStatusBadge id_status_request={request.id_status_request} />
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
          Creada por {request.created_by_name}
          {request.created_at ? ` · ${dayFirst(String(request.created_at).replace(" ", "T"))}` : ""}
        </p>
      </div>

      {request.id_status_request === PURCHASE_REQUEST_STATUS.REJECTED && request.rejection_reason && (
        <div className="bg-[#ffdad6]/40 dark:bg-red-900/20 border border-[#ffb4ab] dark:border-red-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-[#ba1a1a] dark:text-red-400 mb-1">Motivo de rechazo</p>
          <p className="text-sm text-[#0b1c30] dark:text-zinc-100">{request.rejection_reason}</p>
        </div>
      )}

      {canReview && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/dashboard/pedidos/nuevo?solicitud=${id_purchase_request}`)}
            className="flex items-center gap-2 rounded-lg bg-[#0051d5] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0051d5]/90 transition-colors"
          >
            <CheckCircle2 size={16} />
            Confirmar y pasar al carrito
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            className="flex items-center gap-2 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] px-4 py-2 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <XCircle size={16} />
            Rechazar
          </button>
        </div>
      )}

      {isOwnerPending ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 items-center">
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[220px] rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[160px]"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id_category} value={c.id_category}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <RequestProductsTable
              products={filteredProducts}
              categoryNameById={categoryNameById}
              unitNameById={unitNameById}
              quantities={quantities}
              onQuantityChange={handleQuantityChange}
            />
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 flex flex-col gap-4 sticky top-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas para compras (opcional)"
                  className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] resize-none"
                />
              </div>

              {saveError && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{saveError}</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => { setCancelError(null); setShowCancelConfirm(true); }}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] px-4 py-2 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Ban size={16} />
                Cancelar solicitud
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Productos solicitados</h3>
            <span className="text-xs text-[#44474f] dark:text-zinc-400">
              {request.items.length} producto{request.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Unidad</th>
                  <th className="px-6 py-3 font-semibold text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr key={item.id_purchase_request_item} className="border-b border-[#c4c6d0] dark:border-zinc-700">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0b1c30] dark:text-zinc-100">{item.product_name}</p>
                      <p className="text-xs text-[#44474f] dark:text-zinc-400">
                        {item.product_code || "—"}
                        {item.brand ? ` · ${item.brand}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-[#44474f] dark:text-zinc-400">
                      {item.id_unit_measurement ? unitNameById.get(item.id_unit_measurement) ?? "—" : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-[#0b1c30] dark:text-zinc-100">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {request.notes && (
            <div className="px-6 py-4 border-t border-[#c4c6d0] dark:border-zinc-700">
              <p className="text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">Notas</p>
              <p className="text-sm text-[#0b1c30] dark:text-zinc-100">{request.notes}</p>
            </div>
          )}
        </div>
      )}

      {showCancelConfirm && (
        <ConfirmModal
          message={`¿Deseas cancelar la solicitud "${request.folio}"? Esta acción no se puede deshacer.`}
          onConfirm={handleCancel}
          onCancel={() => setShowCancelConfirm(false)}
          loading={cancelling}
          error={cancelError}
          confirmLabel="Cancelar solicitud"
        />
      )}

      {showRejectModal && (
        <RejectRequestModal
          id_purchase_request={id_purchase_request}
          onClose={() => setShowRejectModal(false)}
          onRejected={fetchRequest}
        />
      )}
    </div>
  );
}
