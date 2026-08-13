"use client";

import { useRouter } from "next/navigation";
import { usePurchaseCart } from "@/contexts/PurchaseCartContext";
import { addZeroToday } from "@/utils/date_helpper";

const TAX_RATE = 16;

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export default function PurchaseCartSummary() {
  const router = useRouter();
  const { lines, estimatedDate, notes, setEstimatedDate, setNotes } = usePurchaseCart();

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  const tax = subtotal * (TAX_RATE / 100);
  const total = subtotal + tax;
  const minDate = addZeroToday(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5">
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
            Fecha estimada de entrega
          </label>
          <input
            type="date"
            min={minDate}
            value={estimatedDate}
            onChange={(e) => setEstimatedDate(e.target.value)}
            className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
            Notas del pedido (opcional)
          </label>
          <textarea
            rows={2}
            placeholder="Ej. Entregar en horario matutino."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100 mb-4">Resumen del pedido</h3>
        <div className="flex justify-between items-center mb-3 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Productos seleccionados</span>
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">{lines.length}</span>
        </div>
        <div className="flex justify-between items-center mb-3 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Subtotal</span>
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">
            {currencyFormatter.format(subtotal)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
          <span>IVA ({TAX_RATE}%)</span>
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">
            {currencyFormatter.format(tax)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">Total estimado</span>
          <span className="text-lg font-bold text-[#0051d5] dark:text-blue-400">
            {currencyFormatter.format(total)} MXN
          </span>
        </div>
        <button
          disabled={lines.length === 0}
          onClick={() => router.push("/dashboard/pedidos/nuevo/revision")}
          className="w-full bg-[#0051d5] text-white py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Revisar y generar orden
        </button>
        {lines.length === 0 && (
          <p className="text-xs text-[#747780] dark:text-zinc-500 mt-2 text-center">
            Selecciona al menos un producto para continuar.
          </p>
        )}
      </div>
    </div>
  );
}
