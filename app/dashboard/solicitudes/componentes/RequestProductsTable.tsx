"use client";

import { IRequestProduct } from "@/interfaces/purchase_request";
import QuantityStepper from "@/app/dashboard/componentes/QuantityStepper";

interface Props {
  products:         IRequestProduct[];
  categoryNameById: Map<number, string>;
  unitNameById:     Map<number, string>;
  quantities:       Record<number, number>;
  onQuantityChange: (id_product: number, quantity: number) => void;
}

/**
 * Tabla de captura de una pre-solicitud: solo nombre/código/marca/categoría/unidad,
 * stock actual como referencia y cantidad a solicitar. Deliberadamente sin precio,
 * proveedor, IVA ni totales (el rol 2 no debe verlos, ver spec 48).
 */
export default function RequestProductsTable({
  products,
  categoryNameById,
  unitNameById,
  quantities,
  onQuantityChange,
}: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold min-w-55">Producto</th>
              <th className="px-6 py-4 font-semibold">Categoría</th>
              <th className="px-4 py-4 font-semibold">Unidad</th>
              <th className="px-4 py-4 font-semibold text-right">Stock actual</th>
              <th className="px-6 py-4 font-semibold text-center">Cantidad</th>
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
              products.map((product) => {
                const quantity = quantities[product.id_product] ?? 0;
                const selected = quantity > 0;

                return (
                  <tr
                    key={product.id_product}
                    className={`border-b border-[#c4c6d0] dark:border-zinc-700 transition-colors ${
                      selected
                        ? "bg-[#eff4ff]/40 dark:bg-blue-900/10"
                        : "hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0b1c30] dark:text-zinc-100">{product.name}</p>
                      <p className="text-xs text-[#44474f] dark:text-zinc-400">
                        {product.product_code || "—"}
                        {product.brand ? ` · ${product.brand}` : ""}
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
                    <td className="px-4 py-4 text-[#44474f] dark:text-zinc-400">
                      {product.id_unit_measurement
                        ? unitNameById.get(product.id_unit_measurement) ?? "—"
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-[#0b1c30] dark:text-zinc-100">
                      {product.current_stock}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <QuantityStepper
                          value={quantity}
                          onChange={(value) => onQuantityChange(product.id_product, value)}
                          min={0}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
