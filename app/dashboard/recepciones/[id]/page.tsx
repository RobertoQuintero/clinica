"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getReceptionDetail,
  confirmReception,
  IReceptionDetail,
} from "../actions";
import OrderStatusBadge from "@/app/dashboard/componentes/OrderStatusBadge";
import ReceptionLineRow from "./componentes/ReceptionLineRow";
import ReceptionSummary from "./componentes/ReceptionSummary";

export default function ReceptionCapturePage() {
  const params = useParams();
  const router = useRouter();
  const id_purchase_order = Number(params.id);

  const [detail, setDetail]   = useState<IReceptionDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id_purchase_order) return;
    setLoading(true);
    setLoadError(null);
    getReceptionDetail(id_purchase_order)
      .then((result) => {
        if (result.ok) {
          setDetail(result.data);
          // Por defecto se propone recibir todo lo pendiente; el usuario ajusta si llegó parcial.
          const initialQuantities: Record<number, number> = {};
          for (const item of result.data.items) {
            initialQuantities[item.id_purchase_order_item] = item.quantity_pending;
          }
          setQuantities(initialQuantities);
        } else {
          setLoadError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [id_purchase_order]);

  const summary = useMemo(() => {
    if (!detail) return { total: 0, completed: 0, withDifference: 0 };
    let completed = 0;
    let withDifference = 0;
    for (const item of detail.items) {
      const now = quantities[item.id_purchase_order_item] ?? 0;
      const isComplete = item.quantity_pending === 0 || now === item.quantity_pending;
      if (isComplete) completed += 1;
      else withDifference += 1;
    }
    return { total: detail.items.length, completed, withDifference };
  }, [detail, quantities]);

  const hasAnyQuantity = Object.values(quantities).some((qty) => qty > 0);

  const handleConfirm = async () => {
    if (!detail) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await confirmReception(
        id_purchase_order,
        Object.entries(quantities).map(([id_purchase_order_item, quantity_received_now]) => ({
          id_purchase_order_item: Number(id_purchase_order_item),
          quantity_received_now: quantity_received_now,
        })),
        notes || null
      );
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      router.push(`/dashboard/pedidos/${id_purchase_order}`);
    } catch {
      setSubmitError("Error inesperado al confirmar la recepción");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (loadError || !detail) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#ba1a1a] dark:text-red-400">
          {loadError ?? "No se encontró la orden de compra"}
        </p>
        <button
          onClick={() => router.push("/dashboard/recepciones")}
          className="self-start text-sm font-semibold text-[#0051d5] hover:underline"
        >
          Volver a recepciones pendientes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-[#44474f] dark:text-zinc-400 mb-2">
          <Link href="/dashboard/recepciones" className="hover:text-[#0051d5] transition-colors">
            Recepciones
          </Link>
          <ChevronRight size={14} />
          <span className="text-[#0b1c30] dark:text-zinc-100">{detail.folio}</span>
        </nav>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Recepción de Mercancía</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
          Verifica y registra los productos recibidos contra la orden de compra.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-3/4 flex flex-col gap-6">
          <div className="bg-[#eff4ff] dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-8">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">
                  Orden de compra
                </p>
                <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{detail.folio}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">
                  Proveedor
                </p>
                <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">
                  {detail.supplier_name}
                </p>
              </div>
            </div>
            <OrderStatusBadge id_status={detail.id_status} />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
                    <th className="p-4 w-1/3">Producto</th>
                    <th className="p-4 text-center">Cant. pedida</th>
                    <th className="p-4 text-center">Recibiendo ahora</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
                  {detail.items.map((item) => (
                    <ReceptionLineRow
                      key={item.id_purchase_order_item}
                      line={item}
                      quantityNow={quantities[item.id_purchase_order_item] ?? 0}
                      onChange={(quantity) =>
                        setQuantities((prev) => ({ ...prev, [item.id_purchase_order_item]: quantity }))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/4 lg:sticky lg:top-6">
          <ReceptionSummary
            linesTotal={summary.total}
            linesCompleted={summary.completed}
            linesWithDifference={summary.withDifference}
            notes={notes}
            onNotesChange={setNotes}
            onConfirm={handleConfirm}
            submitting={submitting}
            disabled={!hasAnyQuantity}
            error={submitError}
          />
        </div>
      </div>
    </div>
  );
}
