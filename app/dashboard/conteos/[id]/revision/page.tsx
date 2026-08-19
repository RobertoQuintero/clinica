"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getCountReview,
  saveReviewDecisions,
  closeStockCount,
  IStockCountReview,
} from "../../actions";
import { StockCountDecision } from "@/interfaces/stock_count";
import StockCountStatusBadge from "../../componentes/StockCountStatusBadge";
import CountReviewTable from "./componentes/CountReviewTable";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";

type DecisionState = Record<number, { decision: StockCountDecision | null; reviewer_notes: string }>;

export default function CountReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id_stock_count = Number(params.id);

  const [review, setReview] = useState<IStockCountReview | null>(null);
  const [decisions, setDecisions] = useState<DecisionState>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const loadData = () => {
    if (!id_stock_count) return;
    setLoading(true);
    setLoadError(null);
    getCountReview(id_stock_count).then((result) => {
      if (!result.ok) {
        setLoadError(result.message);
        setLoading(false);
        return;
      }
      setReview(result.data);
      const initial: DecisionState = {};
      for (const line of result.data.lines) {
        initial[line.id_stock_count_item] = {
          decision: line.decision,
          reviewer_notes: line.reviewer_notes ?? "",
        };
      }
      setDecisions(initial);
      setLoading(false);
    });
  };

  useEffect(loadData, [id_stock_count]);

  const readOnly = review ? review.header.status !== "pendiente_revision" : true;
  const allDecided =
    review !== null && review.lines.every((line) => decisions[line.id_stock_count_item]?.decision);

  const summary = useMemo(() => {
    let increase = 0;
    let decrease = 0;
    let keep = 0;
    for (const value of Object.values(decisions)) {
      if (value.decision === "aumentar") increase += 1;
      else if (value.decision === "disminuir") decrease += 1;
      else if (value.decision === "dejar_igual") keep += 1;
    }
    return { increase, decrease, keep };
  }, [decisions]);

  const buildDecisionPayload = () =>
    Object.entries(decisions)
      .filter(([, value]) => value.decision !== null)
      .map(([id_stock_count_item, value]) => ({
        id_stock_count_item: Number(id_stock_count_item),
        decision: value.decision as StockCountDecision,
        reviewer_notes: value.reviewer_notes.trim() || null,
      }));

  const handleSaveDecisions = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const result = await saveReviewDecisions(id_stock_count, buildDecisionPayload());
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaveMessage("Decisiones guardadas");
  };

  const handleClose = async () => {
    setClosing(true);
    setCloseError(null);
    if (review && review.lines.length > 0) {
      const saveResult = await saveReviewDecisions(id_stock_count, buildDecisionPayload());
      if (!saveResult.ok) {
        setClosing(false);
        setCloseError(saveResult.message);
        return;
      }
    }
    const result = await closeStockCount(id_stock_count);
    setClosing(false);
    if (!result.ok) {
      setCloseError(result.message);
      return;
    }
    setShowCloseConfirm(false);
    loadData();
  };

  if (loading) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (loadError || !review) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#ba1a1a] dark:text-red-400">{loadError ?? "No se encontró el conteo"}</p>
        <Link href="/dashboard/conteos" className="self-start text-sm font-semibold text-[#0051d5] hover:underline">
          Volver a conteos
        </Link>
      </div>
    );
  }

  const { header, lines } = review;
  const typeLabel = header.count_type === "general" ? "General" : `Categoría · ${header.category_name ?? "—"}`;
  const [datePart, timePart] = header.created_at.split(" ");
  const hasNoDifferences = lines.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-[#44474f] dark:text-zinc-400 mb-2">
          <Link href="/dashboard/conteos" className="hover:text-[#0051d5] transition-colors">
            Conteos
          </Link>
          <ChevronRight size={14} />
          <span className="text-[#0b1c30] dark:text-zinc-100">{header.folio} · Revisión</span>
        </nav>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Revisión de conteo físico</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
          Decide línea por línea si el stock del sistema debe ajustarse.
        </p>
      </div>

      <div className="bg-[#eff4ff] dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">Folio</p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{header.folio}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">Sucursal</p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{header.sucursal_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">
              Capturado por
            </p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{header.counter_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">Tipo</p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{typeLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">
              Fecha y hora
            </p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">
              {datePart} {timePart}
            </p>
          </div>
        </div>
        <StockCountStatusBadge status={header.status} />
      </div>

      {hasNoDifferences ? (
        <div className="rounded-lg bg-[#f2fcf5] dark:bg-emerald-900/20 border border-[#c6f0d5] dark:border-emerald-800 px-4 py-3 text-sm text-[#009c6b] dark:text-emerald-400">
          Sin diferencias: el conteo físico coincidió con el stock del sistema en todos los productos.
        </div>
      ) : (
        <CountReviewTable
          lines={lines}
          decisions={decisions}
          readOnly={readOnly}
          onDecisionChange={(id_stock_count_item, decision) => {
            setDecisions((prev) => ({
              ...prev,
              [id_stock_count_item]: { ...prev[id_stock_count_item], decision },
            }));
            setSaveMessage(null);
          }}
          onNotesChange={(id_stock_count_item, notes) => {
            setDecisions((prev) => ({
              ...prev,
              [id_stock_count_item]: { ...prev[id_stock_count_item], reviewer_notes: notes },
            }));
            setSaveMessage(null);
          }}
        />
      )}

      {!readOnly && (
        <div className="flex flex-col gap-3">
          {saveError && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{saveError}</p>}
          {saveMessage && <p className="text-sm text-[#009c6b] dark:text-emerald-400">{saveMessage}</p>}
          <div className="flex gap-3">
            {!hasNoDifferences && (
              <button
                type="button"
                onClick={handleSaveDecisions}
                disabled={saving}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-6 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                {saving ? "Guardando…" : "Guardar decisiones"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCloseConfirm(true)}
              disabled={!hasNoDifferences && !allDecided}
              className="rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cerrar inventario
            </button>
          </div>
        </div>
      )}

      {showCloseConfirm && (
        <ConfirmModal
          message={
            hasNoDifferences
              ? "¿Cerrar el inventario? No hubo diferencias, así que no se generará ningún ajuste de stock."
              : `¿Cerrar el inventario? Se aplicarán los ajustes: ${summary.increase} suben, ${summary.decrease} bajan, ${summary.keep} quedan igual. Esta acción es definitiva.`
          }
          confirmLabel="Cerrar inventario"
          loading={closing}
          error={closeError}
          onConfirm={handleClose}
          onCancel={() => {
            setShowCloseConfirm(false);
            setCloseError(null);
          }}
        />
      )}
    </div>
  );
}
