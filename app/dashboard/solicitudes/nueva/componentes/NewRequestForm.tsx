"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { IRequestProduct } from "@/interfaces/purchase_request";
import { IProductCategory } from "@/interfaces/product_category";
import { IUnitMeasurement } from "@/interfaces/unit_measurement";
import { getCategories, getUnitsMeasurement } from "@/app/dashboard/productos/actions";
import { getProductsForRequest, createPurchaseRequest } from "../../actions";
import RequestProductsTable from "../../componentes/RequestProductsTable";

export default function NewRequestForm() {
  const { selectedId } = useSucursal();
  const router = useRouter();

  const [products, setProducts]     = useState<IRequestProduct[]>([]);
  const [categories, setCategories] = useState<IProductCategory[]>([]);
  const [units, setUnits]           = useState<IUnitMeasurement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);

  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [quantities, setQuantities]         = useState<Record<number, number>>({});
  const [notes, setNotes]                   = useState("");

  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories);
    getUnitsMeasurement().then(setUnits);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setLoadError(null);
    getProductsForRequest(selectedId)
      .then((result) => {
        if (result.ok) {
          setProducts(result.data);
        } else {
          setLoadError(result.message);
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
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id_product, p])),
    [products]
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

  const selectedLines = useMemo(
    () =>
      Object.entries(quantities)
        .map(([id, quantity]) => ({ id_product: Number(id), quantity }))
        .filter((line) => line.quantity > 0),
    [quantities]
  );

  const handleQuantityChange = (id_product: number, quantity: number) => {
    setQuantities((current) => ({ ...current, [id_product]: quantity }));
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    if (selectedLines.length === 0) {
      setSubmitError("Agrega al menos un producto con cantidad mayor a cero");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await createPurchaseRequest({
      id_sucursal: selectedId,
      notes: notes.trim() || null,
      lines: selectedLines,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }
    router.push("/dashboard/solicitudes");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 flex flex-col gap-4">
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
        </div>

        {loadError && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{loadError}</p>}

        {loading ? (
          <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>
        ) : (
          <RequestProductsTable
            products={filteredProducts}
            categoryNameById={categoryNameById}
            unitNameById={unitNameById}
            quantities={quantities}
            onQuantityChange={handleQuantityChange}
          />
        )}
      </div>

      <div className="lg:col-span-4">
        <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 flex flex-col gap-4 sticky top-5">
          <div>
            <h3 className="font-semibold text-[#0b1c30] dark:text-zinc-50">Resumen</h3>
            <p className="text-xs text-[#44474f] dark:text-zinc-400">
              {selectedLines.length === 0
                ? "Sin productos seleccionados"
                : `${selectedLines.length} producto${selectedLines.length === 1 ? "" : "s"} seleccionado${selectedLines.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {selectedLines.length > 0 && (
            <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {selectedLines.map((line) => {
                const product = productById.get(line.id_product);
                return (
                  <li
                    key={line.id_product}
                    className="flex items-center justify-between gap-2 text-sm border-b border-[#c4c6d0] dark:border-zinc-700 pb-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#0b1c30] dark:text-zinc-100 truncate">
                        {product?.name ?? `Producto ${line.id_product}`}
                      </p>
                      <p className="text-xs text-[#44474f] dark:text-zinc-400">Cantidad: {line.quantity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(line.id_product, 0)}
                      className="shrink-0 text-[#747780] hover:text-[#ba1a1a] dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
                      aria-label="Quitar producto"
                    >
                      <X size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

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

          {submitError && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{submitError}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedLines.length === 0}
            className="rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
