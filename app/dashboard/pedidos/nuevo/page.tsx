"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, PackageSearch, TriangleAlert, CheckCircle2 } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { ISuggestedProduct } from "@/interfaces/suggested_product";
import {
  getSuggestedProducts,
  getPurchaseOrdersSummary,
  IPurchaseOrdersSummary,
} from "../actions";
import { getCategories, getUnitsMeasurement } from "@/app/dashboard/productos/actions";
import { getSuppliers } from "@/app/dashboard/proveedores/actions";
import { IProductCategory } from "@/interfaces/product_category";
import { IUnitMeasurement } from "@/interfaces/unit_measurement";
import { ISupplier } from "@/interfaces/supplier";
import SuggestedProductsTable from "./componentes/SuggestedProductsTable";
import PurchaseCartSummary from "./componentes/PurchaseCartSummary";
import { dayFirst } from "@/utils/date_helpper";

type TabKey = "sugeridos" | "todos" | "plantillas";

export default function NuevoPedidoPage() {
  const { selectedId } = useSucursal();

  const [products, setProducts]     = useState<ISuggestedProduct[]>([]);
  const [summary, setSummary]       = useState<IPurchaseOrdersSummary | null>(null);
  const [categories, setCategories] = useState<IProductCategory[]>([]);
  const [units, setUnits]           = useState<IUnitMeasurement[]>([]);
  const [suppliers, setSuppliers]   = useState<ISupplier[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [activeTab, setActiveTab]         = useState<TabKey>("sugeridos");
  const [search, setSearch]               = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  useEffect(() => {
    getCategories().then(setCategories);
    getUnitsMeasurement().then(setUnits);
    getSuppliers().then(setSuppliers);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getSuggestedProducts(selectedId),
      getPurchaseOrdersSummary(selectedId),
    ])
      .then(([suggestedResult, summaryResult]) => {
        if (suggestedResult.ok) {
          setProducts(suggestedResult.data);
        } else {
          setError(suggestedResult.message);
        }
        if (summaryResult.ok) {
          setSummary(summaryResult.data);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id_category, c.name])),
    [categories]
  );
  const unitNameById = useMemo(
    () => new Map(units.map((u) => [u.id_unit_measurement, u.name])),
    [units]
  );

  const filteredProducts = useMemo(() => {
    const base = activeTab === "sugeridos" ? products.filter((p) => p.below_minimum) : products;
    return base.filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.product_code ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || String(product.id_category) === categoryFilter;
      const matchesSupplier = !supplierFilter || String(product.id_supplier) === supplierFilter;
      return matchesSearch && matchesCategory && matchesSupplier;
    });
  }, [products, activeTab, search, categoryFilter, supplierFilter]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
          Pedidos de inventario
        </h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Crea pedidos a tus proveedores para reabastecer los productos que necesitas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#eff4ff] dark:bg-zinc-900 p-5 rounded-xl border border-[#c4c6d0] dark:border-zinc-700 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#0051d5]/10 flex items-center justify-center text-[#0051d5] shrink-0">
            <PackageSearch size={20} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Productos con stock bajo
            </h3>
            <p className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
              {summary?.products_below_minimum ?? "—"}
            </p>
            <p className="text-xs text-[#44474f] dark:text-zinc-400">requieren pedido</p>
          </div>
        </div>
        <div className="bg-[#fff8f6] dark:bg-zinc-900 p-5 rounded-xl border border-[#ffd8cc] dark:border-zinc-700 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#ffede6] dark:bg-orange-900/30 flex items-center justify-center text-[#d94f27] dark:text-orange-400 shrink-0">
            <TriangleAlert size={20} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Sugeridos para pedir
            </h3>
            <p className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
              {summary ? `${summary.suggested_count} productos` : "—"}
            </p>
          </div>
        </div>
        <div className="bg-[#f2fcf5] dark:bg-zinc-900 p-5 rounded-xl border border-[#c6f0d5] dark:border-zinc-700 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#e1f7e8] dark:bg-emerald-900/30 flex items-center justify-center text-[#009c6b] dark:text-emerald-400 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Último pedido realizado
            </h3>
            <p className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
              {summary?.last_order_date ? dayFirst(summary.last_order_date + "T00:00:00") : "Sin pedidos"}
            </p>
            {summary?.last_order_supplier && (
              <p className="text-xs text-[#44474f] dark:text-zinc-400">A {summary.last_order_supplier}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-9 flex flex-col gap-4">
          <div className="border-b border-[#c4c6d0] dark:border-zinc-700 flex gap-6">
            <button
              onClick={() => setActiveTab("sugeridos")}
              className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "sugeridos"
                  ? "text-[#0051d5] border-[#0051d5]"
                  : "text-[#44474f] dark:text-zinc-400 border-transparent hover:text-[#0b1c30] dark:hover:text-zinc-100"
              }`}
            >
              Sugeridos para pedir
            </button>
            <button
              onClick={() => setActiveTab("todos")}
              className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "todos"
                  ? "text-[#0051d5] border-[#0051d5]"
                  : "text-[#44474f] dark:text-zinc-400 border-transparent hover:text-[#0b1c30] dark:hover:text-zinc-100"
              }`}
            >
              Todos los productos
            </button>
            <button
              disabled
              title="Próximamente"
              className="pb-3 px-2 text-sm font-semibold border-b-2 border-transparent text-[#c4c6d0] dark:text-zinc-600 cursor-not-allowed"
            >
              Plantillas de pedido
            </button>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 pl-10 pr-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
              />
            </div>
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
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[160px]"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id_proveedor} value={s.id_proveedor}>
                  {s.nombre_corto}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-[#ba1a1a] dark:text-red-400">{error}</p>
          )}

          {loading ? (
            <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>
          ) : (
            <SuggestedProductsTable
              products={filteredProducts}
              categoryNameById={categoryNameById}
              unitNameById={unitNameById}
            />
          )}
        </div>

        <div className="lg:col-span-3">
          <PurchaseCartSummary />
        </div>
      </div>
    </div>
  );
}
