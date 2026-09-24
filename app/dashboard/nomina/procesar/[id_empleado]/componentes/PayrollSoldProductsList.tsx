import { Package } from "lucide-react";
import type { IPayrollSoldProduct } from "@/interfaces/payroll_product_sales_commission";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { describeProductSalesCommission } from "@/lib/payroll/productSalesCommission";

interface Props {
  soldProducts: IPayrollSoldProduct[];
}

/** Piezas con hasta 4 decimales (productos split), sin ceros de más. */
function formatPieces(pieces: number): string {
  return String(Math.round(pieces * 10000) / 10000);
}

export default function PayrollSoldProductsList({ soldProducts }: Props) {
  if (soldProducts.length === 0) return null;

  const totalPieces = soldProducts.reduce((sum, soldProduct) => sum + soldProduct.piezas, 0);
  const totalCommission =
    Math.round(soldProducts.reduce((sum, soldProduct) => sum + soldProduct.importe_comision, 0) * 100) / 100;

  return (
    <section
      aria-labelledby="payroll-sold-products-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
          <Package size={18} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h3 id="payroll-sold-products-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            Productos vendidos en este periodo
          </h3>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">
            {describeProductSalesCommission(totalPieces)} · bono por pieza al momento de calcular
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Comisión por venta de productos, agrupada por producto</caption>
          <thead className="text-[11px] uppercase tracking-wider text-[#44474f] dark:text-zinc-400 border-b border-[#e5e8f0] dark:border-zinc-800">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold">Producto</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Piezas</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Bono</th>
              <th scope="col" className="px-5 py-2.5 font-semibold text-right">Comisión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e8f0] dark:divide-zinc-800">
            {soldProducts.map((soldProduct) => (
              <tr key={`${soldProduct.id_producto}-${soldProduct.bono_venta}`}>
                <td className="px-5 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                  {soldProduct.nombre_producto || `Producto #${soldProduct.id_producto}`}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                  {formatPieces(soldProduct.piezas)}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#44474f] dark:text-zinc-300">
                  {formatPayrollCurrency(soldProduct.bono_venta)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                  {formatPayrollCurrency(soldProduct.importe_comision)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#dce9ff]/70 dark:bg-zinc-800 border-t-2 border-[#d3e4fe] dark:border-zinc-700">
              <th scope="row" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100">
                Total
              </th>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatPieces(totalPieces)}
              </td>
              <td aria-hidden />
              <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-[#0051d5] dark:text-blue-300">
                {formatPayrollCurrency(totalCommission)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
