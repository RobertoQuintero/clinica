"use client";

import { ISuggestedProduct } from "@/interfaces/suggested_product";
import ProductQuickViewButton from "@/app/dashboard/componentes/ProductQuickViewButton";

interface Props {
  products:         ISuggestedProduct[];
  categoryNameById: Map<number, string>;
}

export default function CurrentInventoryTable({ products, categoryNameById }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold min-w-55">Producto</th>
              <th className="px-6 py-4 font-semibold">Categoría</th>
              <th className="px-4 py-4 font-semibold text-right">Stock</th>
              <th className="px-4 py-4 font-semibold text-right">Stock mín.</th>
              <th className="px-4 py-4 font-semibold text-right">Stock máx.</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                  Sin productos que coincidan con los filtros
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id_product}
                  className="border-b border-[#c4c6d0] dark:border-zinc-700 hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-[#0b1c30] dark:text-zinc-100">{product.name}</p>
                      <ProductQuickViewButton id_product={product.id_product} />
                    </div>
                    <p className="text-xs text-[#44474f] dark:text-zinc-400">
                      {product.product_code || "—"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {product.id_category && categoryNameById.get(product.id_category) ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dce9ff] text-[#44474f] border border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                        {categoryNameById.get(product.id_category)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`px-4 py-4 text-right font-medium ${
                      product.below_minimum
                        ? "text-[#ba1a1a] dark:text-red-400"
                        : "text-[#009c6b] dark:text-emerald-400"
                    }`}
                  >
                    {product.current_stock}
                  </td>
                  <td className="px-4 py-4 text-right text-[#44474f] dark:text-zinc-400">
                    {product.min_stock_effective ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-right text-[#44474f] dark:text-zinc-400">
                    {product.max_stock_effective ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
