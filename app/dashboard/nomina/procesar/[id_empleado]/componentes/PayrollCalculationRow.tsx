/** Una fila "concepto ... valor" de los desgloses de cálculo del Detalle (ISR ordinario y art. 174). */
export function PayrollCalculationRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        emphasized ? "mt-1 border-t border-[#e5e8f0] dark:border-zinc-700 pt-2.5" : ""
      }`}
    >
      <dt className={`text-sm ${emphasized ? "font-semibold text-[#0b1c30] dark:text-zinc-100" : "text-[#44474f] dark:text-zinc-400"}`}>
        {label}
      </dt>
      <dd
        className={`text-sm text-right tabular-nums ${
          emphasized ? "font-semibold text-[#0b1c30] dark:text-zinc-50" : "text-[#0b1c30] dark:text-zinc-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
