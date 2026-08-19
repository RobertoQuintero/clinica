"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PackageSearch, TriangleAlert } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { StockCountType } from "@/interfaces/stock_count";
import {
  createStockCount,
  getCountableCategories,
  getCountableProductCount,
  getOpenStockCount,
  ICountableCategory,
  IOpenStockCount,
} from "../../actions";

export default function NewCountForm() {
  const { selectedId } = useSucursal();
  const router = useRouter();

  const [openCount, setOpenCount] = useState<IOpenStockCount | null>(null);
  const [checkingOpenCount, setCheckingOpenCount] = useState(true);

  const [categories, setCategories] = useState<ICountableCategory[]>([]);
  const [countType, setCountType] = useState<StockCountType>("general");
  const [categoryId, setCategoryId] = useState("");

  const [productCount, setProductCount] = useState<number | null>(null);
  const [countingProducts, setCountingProducts] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    setCheckingOpenCount(true);
    getOpenStockCount(selectedId)
      .then((result) => {
        if (result.ok) setOpenCount(result.data);
      })
      .finally(() => setCheckingOpenCount(false));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || openCount) return;
    getCountableCategories(selectedId).then((result) => {
      if (result.ok) setCategories(result.data);
    });
  }, [selectedId, openCount]);

  useEffect(() => {
    if (!selectedId || openCount) return;
    if (countType === "category" && !categoryId) {
      setProductCount(null);
      return;
    }
    setCountingProducts(true);
    getCountableProductCount(selectedId, countType, countType === "category" ? Number(categoryId) : null)
      .then((result) => {
        if (result.ok) setProductCount(result.data.product_count);
      })
      .finally(() => setCountingProducts(false));
  }, [selectedId, openCount, countType, categoryId]);

  const handleSubmit = async () => {
    if (countType === "category" && !categoryId) {
      setError("Selecciona una categoría");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createStockCount(countType, countType === "category" ? Number(categoryId) : null);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`/dashboard/conteos/${result.data.id_stock_count}`);
  };

  if (checkingOpenCount) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (openCount) {
    return (
      <div className="bg-[#fff8f6] dark:bg-zinc-900 border border-[#ffd8cc] dark:border-orange-800 rounded-xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[#ffede6] dark:bg-orange-900/30 flex items-center justify-center text-[#d94f27] dark:text-orange-400 shrink-0">
          <TriangleAlert size={20} />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-[#0b1c30] dark:text-zinc-50">
            Ya hay un conteo abierto en esta sucursal
          </h3>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Solo puede haber un conteo activo a la vez. Termina o cancela {openCount.folio} antes de generar uno nuevo.
          </p>
          <Link
            href={`/dashboard/conteos/${openCount.id_stock_count}`}
            className="self-start mt-2 rounded-lg bg-[#0051d5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
          >
            Ir al conteo {openCount.folio}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col gap-6 max-w-xl">
      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">Tipo de conteo</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCountType("general")}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold text-left transition-colors ${
              countType === "general"
                ? "border-[#0051d5] bg-[#eff4ff] dark:bg-blue-900/20 text-[#0051d5] dark:text-blue-300"
                : "border-[#c4c6d0] dark:border-zinc-600 text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff]/60 dark:hover:bg-zinc-800"
            }`}
          >
            General
            <span className="block font-normal text-xs mt-1">Todos los productos con stock en la sucursal</span>
          </button>
          <button
            type="button"
            onClick={() => setCountType("category")}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold text-left transition-colors ${
              countType === "category"
                ? "border-[#0051d5] bg-[#eff4ff] dark:bg-blue-900/20 text-[#0051d5] dark:text-blue-300"
                : "border-[#c4c6d0] dark:border-zinc-600 text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff]/60 dark:hover:bg-zinc-800"
            }`}
          >
            Por categoría
            <span className="block font-normal text-xs mt-1">Solo los productos de una categoría</span>
          </button>
        </div>
      </div>

      {countType === "category" && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option key={category.id_category} value={category.id_category}>
                {category.name}
              </option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="text-xs text-[#44474f] dark:text-zinc-400">
              No hay categorías con productos activos en esta sucursal
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg bg-[#eff4ff] dark:bg-zinc-800 px-4 py-3">
        <PackageSearch size={18} className="text-[#0051d5] dark:text-blue-400 shrink-0" />
        <p className="text-sm text-[#0b1c30] dark:text-zinc-100">
          {countingProducts ? (
            "Calculando…"
          ) : productCount === null ? (
            "Selecciona una categoría para ver cuántos productos incluirá"
          ) : (
            <>
              Este conteo incluirá <span className="font-semibold">{productCount}</span> producto
              {productCount === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>

      {error && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || (countType === "category" && !categoryId) || productCount === 0}
        className="self-start rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Generando…" : "Generar conteo"}
      </button>
    </div>
  );
}
