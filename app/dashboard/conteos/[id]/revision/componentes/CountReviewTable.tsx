import { ICountReviewLine } from "../../../actions";
import { StockCountDecision } from "@/interfaces/stock_count";
import CountDecisionRow from "./CountDecisionRow";

interface Props {
  lines:     ICountReviewLine[];
  decisions: Record<number, { decision: StockCountDecision | null; reviewer_notes: string }>;
  readOnly:  boolean;
  onDecisionChange: (id_stock_count_item: number, decision: StockCountDecision) => void;
  onNotesChange:    (id_stock_count_item: number, notes: string) => void;
}

export default function CountReviewTable({
  lines,
  decisions,
  readOnly,
  onDecisionChange,
  onNotesChange,
}: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Producto</th>
              <th className="px-6 py-4 font-semibold text-right">Conteo físico</th>
              <th className="px-6 py-4 font-semibold text-right">Stock sistema</th>
              <th className="px-6 py-4 font-semibold text-right">Stock actual</th>
              <th className="px-6 py-4 font-semibold text-right">Diferencia</th>
              <th className="px-6 py-4 font-semibold">Decisión</th>
              <th className="px-6 py-4 font-semibold">Nota</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <CountDecisionRow
                key={line.id_stock_count_item}
                line={line}
                decision={decisions[line.id_stock_count_item]?.decision ?? null}
                reviewerNotes={decisions[line.id_stock_count_item]?.reviewer_notes ?? ""}
                readOnly={readOnly}
                onDecisionChange={(decision) => onDecisionChange(line.id_stock_count_item, decision)}
                onNotesChange={(notes) => onNotesChange(line.id_stock_count_item, notes)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
