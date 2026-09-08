"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { ISuggestedProduct } from "@/interfaces/suggested_product";
import { IProductCategory } from "@/interfaces/product_category";
import { getSuggestedProducts } from "@/app/dashboard/pedidos/actions";
import { getCategories } from "@/app/dashboard/productos/actions";
import CurrentInventoryTable from "./componentes/CurrentInventoryTable";

export default function InventarioPage() {
  const { selectedId } = useSucursal();

  const [products, setProducts]     = useState<ISuggestedProduct[]>([]);
  const [categories, setCategories] = useState<IProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getSuggestedProducts(selectedId)
      .then((result) => {
        if (result.ok) {
          setProducts(result.data);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id_category, c.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.product_code ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || String(product.id_category) === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
          Inventario actual
        </h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Consulta las existencias del catálogo completo para la sucursal seleccionada.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar producto por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 pl-10 pr-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[160px]"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id_category} value={c.id_category}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>
      ) : (
        <CurrentInventoryTable products={filteredProducts} categoryNameById={categoryNameById} />
      )}
    </div>
  );
}
