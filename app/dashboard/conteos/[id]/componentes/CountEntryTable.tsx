import { ICountEntryLine } from "../../actions";

interface Props {
  lines:    ICountEntryLine[];
  values:   Record<number, string>;
  readOnly: boolean;
  onChange: (id_stock_count_item: number, value: string) => void;
}

export default function CountEntryTable({ lines, values, readOnly, onChange }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Producto</th>
              <th className="px-6 py-4 font-semibold">Código</th>
              <th className="px-6 py-4 font-semibold">Unidad</th>
              <th className="px-6 py-4 font-semibold text-right w-48">Cantidad contada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                  Este conteo no tiene productos
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id_stock_count_item}>
                  <td className="px-6 py-3 text-[#0b1c30] dark:text-zinc-100">{line.product_name}</td>
                  <td className="px-6 py-3 text-[#44474f] dark:text-zinc-400">{line.product_code}</td>
                  <td className="px-6 py-3 text-[#44474f] dark:text-zinc-400">{line.unit_code ?? "—"}</td>
                  <td className="px-6 py-3 text-right">
                    {readOnly ? (
                      <span className="text-[#0b1c30] dark:text-zinc-100 font-semibold">
                        {line.counted_quantity ?? "—"}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={values[line.id_stock_count_item] ?? ""}
                        onChange={(e) => onChange(line.id_stock_count_item, e.target.value)}
                        placeholder="0"
                        className="w-32 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-right text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
                      />
                    )}
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
