"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileUp, Ban, PackageCheck } from "lucide-react";
import { getPurchaseOrderById, cancelPurchaseOrder, IPurchaseOrderDetailView } from "../actions";
import { useSucursal } from "@/contexts/SucursalContext";
import OrderStatusBadge from "@/app/dashboard/componentes/OrderStatusBadge";
import UploadInvoiceModal from "./componentes/UploadInvoiceModal";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import { dayFirst } from "@/utils/date_helpper";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const toLocalDate = (value: string | null) => (value ? dayFirst(value.replace(" ", "T")) : "—");
const toLocalDateOnly = (value: string | null) => (value ? dayFirst(value + "T00:00:00") : "—");

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { sucursales } = useSucursal();
  const id_purchase_order = Number(params.id);

  const [order, setOrder]   = useState<IPurchaseOrderDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [showUploadInvoice, setShowUploadInvoice] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchOrder = () => {
    setLoading(true);
    setError(null);
    return getPurchaseOrderById(id_purchase_order)
      .then((result) => {
        if (result.ok) {
          setOrder(result.data);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id_purchase_order) return;
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_purchase_order]);

  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError(null);
    const result = await cancelPurchaseOrder(id_purchase_order);
    if (result.ok) {
      setShowCancelConfirm(false);
      await fetchOrder();
    } else {
      setCancelError(result.message);
    }
    setCancelling(false);
  };

  if (loading) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (error || !order) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#ba1a1a] dark:text-red-400">
          {error ?? "No se encontró la orden de compra"}
        </p>
        <button
          onClick={() => router.push("/dashboard/pedidos")}
          className="self-start text-sm font-semibold text-[#0051d5] hover:underline"
        >
          Volver al historial
        </button>
      </div>
    );
  }

  const sucursalName = sucursales.find((s) => s.id_sucursal === order.id_sucursal)?.nombre ?? "—";
  const hasReceptions = order.receptions.length > 0;
  const canUploadInvoice = order.id_status === 1;
  const canCancel = (order.id_status === 1 || order.id_status === 2) && !hasReceptions;
  const canReceive = order.id_status === 2 || order.id_status === 4;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/pedidos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Volver al historial
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{order.folio}</h2>
          <OrderStatusBadge id_status={order.id_status} />
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">{order.supplier_name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InfoTile label="Sucursal" value={sucursalName} />
        <InfoTile label="Fecha de pedido" value={toLocalDate(String(order.created_at ?? ""))} />
        <InfoTile label="Entrega estimada" value={toLocalDateOnly(order.estimated_date)} />
        <InfoTile label="Fecha de entrega" value={toLocalDateOnly(order.delivery_date)} />
        <InfoTile label="Método de pago" value={order.metodo_pago_descripcion ?? "—"} />
      </div>

      {order.notes && (
        <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4">
          <p className="text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">Notas del pedido</p>
          <p className="text-sm text-[#0b1c30] dark:text-zinc-100">{order.notes}</p>
        </div>
      )}

      {(canUploadInvoice || canCancel || canReceive) && (
        <div className="flex flex-wrap gap-3">
          {canUploadInvoice && (
            <button
              onClick={() => setShowUploadInvoice(true)}
              className="flex items-center gap-2 rounded-lg border border-[#0051d5] text-[#0051d5] px-4 py-2 text-sm font-semibold hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
            >
              <FileUp size={16} />
              Cargar factura
            </button>
          )}
          {canReceive && (
            <button
              onClick={() => router.push(`/dashboard/recepciones/${id_purchase_order}`)}
              className="flex items-center gap-2 rounded-lg bg-[#0051d5] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0051d5]/90 transition-colors"
            >
              <PackageCheck size={16} />
              Registrar recepción
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => { setCancelError(null); setShowCancelConfirm(true); }}
              className="flex items-center gap-2 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] px-4 py-2 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Ban size={16} />
              Cancelar orden
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800">
          <h3 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Productos pedidos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3 font-semibold">Producto</th>
                <th className="px-6 py-3 font-semibold text-right">Cantidad</th>
                <th className="px-6 py-3 font-semibold text-right">Recibido</th>
                <th className="px-6 py-3 font-semibold text-right">Precio unit.</th>
                <th className="px-6 py-3 font-semibold text-center">IVA</th>
                <th className="px-6 py-3 font-semibold text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr
                  key={item.id_purchase_order_item}
                  className="border-b border-[#c4c6d0] dark:border-zinc-700"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#0b1c30] dark:text-zinc-100">{item.product_name}</p>
                    <p className="text-xs text-[#44474f] dark:text-zinc-400">{item.product_code || "—"}</p>
                  </td>
                  <td className="px-6 py-4 text-right text-[#0b1c30] dark:text-zinc-100">{item.quantity}</td>
                  <td className="px-6 py-4 text-right text-[#44474f] dark:text-zinc-400">
                    {item.quantity_received}
                  </td>
                  <td className="px-6 py-4 text-right text-[#44474f] dark:text-zinc-400">
                    {currencyFormatter.format(item.unit_price)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.applies_iva ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e1f7e8] text-[#009c6b] border border-[#c6f0d5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                        IVA
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dce9ff] text-[#44474f] border border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                        Exento
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-[#0b1c30] dark:text-zinc-100">
                    {currencyFormatter.format(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#c4c6d0] dark:border-zinc-700 p-6 flex flex-col items-end gap-2 text-sm">
          <div className="flex justify-between w-64">
            <span className="text-[#44474f] dark:text-zinc-400">Subtotal</span>
            <span className="text-[#0b1c30] dark:text-zinc-100">{currencyFormatter.format(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between w-64">
              <span className="text-[#44474f] dark:text-zinc-400">Descuento</span>
              <span className="text-[#0b1c30] dark:text-zinc-100">
                -{currencyFormatter.format(order.discount)}
              </span>
            </div>
          )}
          <div className="flex justify-between w-64">
            <span className="text-[#44474f] dark:text-zinc-400">IVA ({order.tax_rate}%)</span>
            <span className="text-[#0b1c30] dark:text-zinc-100">{currencyFormatter.format(order.tax)}</span>
          </div>
          {order.shipping_cost > 0 && (
            <div className="flex justify-between w-64">
              <span className="text-[#44474f] dark:text-zinc-400">Envío</span>
              <span className="text-[#0b1c30] dark:text-zinc-100">
                {currencyFormatter.format(order.shipping_cost)}
              </span>
            </div>
          )}
          <div className="flex justify-between w-64 pt-2 border-t border-[#c4c6d0] dark:border-zinc-700">
            <span className="font-bold text-[#0b1c30] dark:text-zinc-100">Total</span>
            <span className="font-bold text-[#0051d5] dark:text-blue-400">
              {currencyFormatter.format(order.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800">
          <h3 className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Bitácora de recepciones</h3>
        </div>
        {order.receptions.length === 0 ? (
          <p className="px-6 py-6 text-sm text-[#747780] dark:text-zinc-500">
            Todavía no se ha registrado ninguna recepción para esta orden.
          </p>
        ) : (
          <div className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
            {order.receptions.map((reception) => (
              <div key={reception.id_reception} className="px-6 py-4 flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                    {toLocalDate(String(reception.created_at ?? ""))} — {reception.user_name}
                  </p>
                  {reception.notes && (
                    <p className="text-xs text-[#44474f] dark:text-zinc-400 mt-1">{reception.notes}</p>
                  )}
                </div>
                {reception.is_final && (
                  <span className="text-xs font-semibold text-[#009c6b] dark:text-emerald-400 whitespace-nowrap">
                    Recepción final
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showUploadInvoice && (
        <UploadInvoiceModal
          id_purchase_order={id_purchase_order}
          onClose={() => setShowUploadInvoice(false)}
          onUploaded={fetchOrder}
        />
      )}

      {showCancelConfirm && (
        <ConfirmModal
          message={`¿Deseas cancelar la orden "${order.folio}"? Esta acción no se puede deshacer.`}
          onConfirm={handleCancelOrder}
          onCancel={() => setShowCancelConfirm(false)}
          loading={cancelling}
          error={cancelError}
          confirmLabel="Cancelar orden"
        />
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4">
      <p className="text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">{label}</p>
      <p className="text-sm text-[#0b1c30] dark:text-zinc-100">{value}</p>
    </div>
  );
}
