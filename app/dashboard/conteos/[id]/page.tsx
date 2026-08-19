"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getStockCountHeader,
  getCountEntryLines,
  saveCountProgress,
  finishFirstCount,
  finishSecondCount,
  cancelStockCount,
  IStockCountHeader,
  ICountEntryLine,
} from "../actions";
import StockCountStatusBadge from "../componentes/StockCountStatusBadge";
import CountEntryTable from "./componentes/CountEntryTable";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";

const READ_ONLY_STATUSES = ["pendiente_revision", "cerrado", "cancelado"];

export default function CountEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id_stock_count = Number(params.id);

  const [header, setHeader] = useState<IStockCountHeader | null>(null);
  const [lines, setLines] = useState<ICountEntryLine[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadData = () => {
    if (!id_stock_count) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([getStockCountHeader(id_stock_count), getCountEntryLines(id_stock_count)]).then(
      ([headerResult, linesResult]) => {
        if (!headerResult.ok) {
          setLoadError(headerResult.message);
          setLoading(false);
          return;
        }
        if (!linesResult.ok) {
          setLoadError(linesResult.message);
          setLoading(false);
          return;
        }
        setHeader(headerResult.data);
        setLines(linesResult.data);
        const initialValues: Record<number, string> = {};
        for (const line of linesResult.data) {
          if (line.counted_quantity !== null) {
            initialValues[line.id_stock_count_item] = String(line.counted_quantity);
          }
        }
        setValues(initialValues);
        setLoading(false);
      }
    );
  };

  useEffect(loadData, [id_stock_count]);

  const readOnly = header ? READ_ONLY_STATUSES.includes(header.status) : true;
  const allFilled = lines.every((line) => (values[line.id_stock_count_item] ?? "").trim() !== "");

  const handleChange = (id_stock_count_item: number, value: string) => {
    setValues((prev) => ({ ...prev, [id_stock_count_item]: value }));
    setSaveMessage(null);
  };

  const handleSaveProgress = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const payload = lines
      .filter((line) => (values[line.id_stock_count_item] ?? "").trim() !== "")
      .map((line) => ({
        id_stock_count_item: line.id_stock_count_item,
        counted_quantity: Number(values[line.id_stock_count_item]),
      }));
    const result = await saveCountProgress(id_stock_count, payload);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaveMessage("Avance guardado");
  };

  const handleFinish = async () => {
    setFinishing(true);
    setFinishError(null);
    const finishAction = header?.status === "segundo_conteo" ? finishSecondCount : finishFirstCount;
    const result = await finishAction(id_stock_count);
    setFinishing(false);
    if (!result.ok) {
      setFinishError(result.message);
      return;
    }
    setShowFinishConfirm(false);
    loadData();
  };

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    const result = await cancelStockCount(id_stock_count);
    setCancelling(false);
    if (!result.ok) {
      setCancelError(result.message);
      return;
    }
    router.push("/dashboard/conteos");
  };

  if (loading) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (loadError || !header) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#ba1a1a] dark:text-red-400">{loadError ?? "No se encontró el conteo"}</p>
        <Link href="/dashboard/conteos" className="self-start text-sm font-semibold text-[#0051d5] hover:underline">
          Volver a conteos
        </Link>
      </div>
    );
  }

  const typeLabel =
    header.count_type === "general" ? "General" : `Categoría · ${header.category_name ?? "—"}`;
  const canCancel = header.status === "en_captura" || header.status === "segundo_conteo";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-[#44474f] dark:text-zinc-400 mb-2">
          <Link href="/dashboard/conteos" className="hover:text-[#0051d5] transition-colors">
            Conteos
          </Link>
          <ChevronRight size={14} />
          <span className="text-[#0b1c30] dark:text-zinc-100">{header.folio}</span>
        </nav>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Conteo físico de inventario</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
          Captura la cantidad contada de cada producto. No se muestra el stock del sistema.
        </p>
      </div>

      <div className="bg-[#eff4ff] dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">Folio</p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{header.folio}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">Tipo</p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{typeLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400 mb-1">
              Capturado por
            </p>
            <p className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">{header.counter_name}</p>
          </div>
        </div>
        <StockCountStatusBadge status={header.status} />
      </div>

      {header.status === "segundo_conteo" && (
        <div className="rounded-lg bg-[#fff8f6] dark:bg-orange-900/20 border border-[#ffd8cc] dark:border-orange-800 px-4 py-3 text-sm text-[#c2410c] dark:text-orange-300">
          Se detectaron diferencias en {lines.length} producto{lines.length === 1 ? "" : "s"}. Realice un
          segundo conteo.
        </div>
      )}

      <CountEntryTable lines={lines} values={values} readOnly={readOnly} onChange={handleChange} />

      {!readOnly && (
        <div className="flex flex-col gap-3">
          {saveError && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{saveError}</p>}
          {saveMessage && <p className="text-sm text-[#009c6b] dark:text-emerald-400">{saveMessage}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveProgress}
                disabled={saving}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-6 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                {saving ? "Guardando…" : "Guardar avance"}
              </button>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(true)}
                disabled={!allFilled}
                className="rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Finalizar conteo
              </button>
            </div>
            {canCancel && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-sm font-semibold text-[#ba1a1a] dark:text-red-400 hover:underline"
              >
                Cancelar conteo
              </button>
            )}
          </div>
        </div>
      )}

      {showFinishConfirm && (
        <ConfirmModal
          message={
            header.status === "segundo_conteo"
              ? "¿Finalizar el segundo conteo? Esta captura es definitiva y pasará a revisión del supervisor."
              : "¿Finalizar el primer conteo? Si hay diferencias, se te pedirá recontar solo esos productos."
          }
          confirmLabel="Finalizar"
          loading={finishing}
          error={finishError}
          onConfirm={handleFinish}
          onCancel={() => {
            setShowFinishConfirm(false);
            setFinishError(null);
          }}
        />
      )}

      {showCancelConfirm && (
        <ConfirmModal
          message="¿Cancelar este conteo? La captura se perderá y no se aplicará ningún ajuste de stock."
          confirmLabel="Cancelar conteo"
          loading={cancelling}
          error={cancelError}
          onConfirm={handleCancel}
          onCancel={() => {
            setShowCancelConfirm(false);
            setCancelError(null);
          }}
        />
      )}
    </div>
  );
}
