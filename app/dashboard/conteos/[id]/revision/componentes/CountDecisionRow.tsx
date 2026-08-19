import { ICountReviewLine } from "../../../actions";
import { StockCountDecision } from "@/interfaces/stock_count";

const DECISION_OPTIONS: { value: StockCountDecision; label: string }[] = [
  { value: "aumentar", label: "Aumentar" },
  { value: "disminuir", label: "Disminuir" },
  { value: "dejar_igual", label: "Dejar igual" },
];

interface Props {
  line:            ICountReviewLine;
  decision:        StockCountDecision | null;
  reviewerNotes:   string;
  readOnly:        boolean;
  onDecisionChange: (decision: StockCountDecision) => void;
  onNotesChange:    (notes: string) => void;
}

export default function CountDecisionRow({
  line,
  decision,
  reviewerNotes,
  readOnly,
  onDecisionChange,
  onNotesChange,
}: Props) {
  const differenceClass =
    line.difference > 0
      ? "text-[#009c6b] dark:text-emerald-400"
      : line.difference < 0
        ? "text-[#ba1a1a] dark:text-red-400"
        : "text-[#44474f] dark:text-zinc-400";

  return (
    <tr className="border-b border-[#c4c6d0] dark:border-zinc-700 last:border-b-0 align-top">
      <td className="px-6 py-4">
        <p className="font-semibold text-[#0b1c30] dark:text-zinc-100">{line.product_name}</p>
        <p className="text-xs text-[#44474f] dark:text-zinc-400">{line.product_code}</p>
      </td>
      <td className="px-6 py-4 text-right text-[#0b1c30] dark:text-zinc-100">
        {line.counted_quantity} {line.unit_code ?? ""}
      </td>
      <td className="px-6 py-4 text-right text-[#44474f] dark:text-zinc-400">{line.system_quantity}</td>
      <td className="px-6 py-4 text-right text-[#44474f] dark:text-zinc-400">{line.current_stock}</td>
      <td className={`px-6 py-4 text-right font-semibold ${differenceClass}`}>
        {line.difference > 0 ? "+" : ""}
        {line.difference}
      </td>
      <td className="px-6 py-4">
        {readOnly ? (
          <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            {DECISION_OPTIONS.find((o) => o.value === decision)?.label ?? "Sin decisión"}
          </span>
        ) : (
          <div className="flex gap-1.5">
            {DECISION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onDecisionChange(option.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  decision === option.value
                    ? "border-[#0051d5] bg-[#eff4ff] dark:bg-blue-900/20 text-[#0051d5] dark:text-blue-300"
                    : "border-[#c4c6d0] dark:border-zinc-600 text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff]/60 dark:hover:bg-zinc-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </td>
      <td className="px-6 py-4 min-w-[200px]">
        {readOnly ? (
          <span className="text-sm text-[#44474f] dark:text-zinc-400">{reviewerNotes || "—"}</span>
        ) : (
          <input
            type="text"
            value={reviewerNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Nota opcional…"
            className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-1.5 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder:text-[#747780] dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
          />
        )}
      </td>
    </tr>
  );
}
