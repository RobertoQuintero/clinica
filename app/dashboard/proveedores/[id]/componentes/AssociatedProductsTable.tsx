"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ISupplierProduct } from "@/interfaces/supplier_product";

interface Props {
  products: ISupplierProduct[];
}

const fmtPrice = (val: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val ?? 0);

const fmtLastPurchase = (val: string | null) => {
  if (!val) return "—";
  return new Date(val.includes("T") ? val : val + "T00:00:00").toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export default function AssociatedProductsTable({ products }: Props) {
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.product_code.toLowerCase().includes(query)
    );
  }, [products, search]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-[#c4c6d0] dark:border-zinc-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-[#c4c6d0] dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-100">Productos Asociados</h3>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">Catálogo de insumos suministrados por este proveedor.</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-zinc-800 border border-[#c4c6d0] dark:border-zinc-700 rounded-lg text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:border-[#0051d5] focus:ring-1 focus:ring-[#0051d5] transition-colors"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800">
              <th className="px-6 py-3 text-xs font-semibold text-[#44474f] dark:text-zinc-400">Producto</th>
              <th className="px-6 py-3 text-xs font-semibold text-[#44474f] dark:text-zinc-400">Categoría</th>
              <th className="px-6 py-3 text-xs font-semibold text-[#44474f] dark:text-zinc-400">Unidad</th>
              <th className="px-6 py-3 text-xs font-semibold text-[#44474f] dark:text-zinc-400 text-right">Precio Unitario</th>
              <th className="px-6 py-3 text-xs font-semibold text-[#44474f] dark:text-zinc-400 text-center">Última Compra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {filteredProducts.map((product) => (
              <tr
                key={product.id_product}
                className="hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-6 py-3">
                  <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">{product.name}</p>
                  <p className="text-xs text-[#44474f] dark:text-zinc-400">{product.product_code}</p>
                </td>
                <td className="px-6 py-3">
                  {product.category_name ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dce9ff] text-[#44474f] border border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                      {product.category_name}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-[#44474f] dark:text-zinc-400">{product.unit_name || "—"}</td>
                <td className="px-6 py-3 text-sm font-medium text-[#0b1c30] dark:text-zinc-100 text-right">
                  {fmtPrice(product.price)}
                </td>
                <td className="px-6 py-3 text-sm text-[#44474f] dark:text-zinc-400 text-center">
                  {fmtLastPurchase(product.last_purchase)}
                </td>
              </tr>
            ))}

            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#44474f] dark:text-zinc-400">
                  {products.length === 0
                    ? "Este proveedor no tiene productos asociados."
                    : "No se encontraron productos que coincidan con la búsqueda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
