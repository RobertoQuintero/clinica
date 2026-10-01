"use client";

import type { BonusResult } from "@/interfaces/payroll_bonus";
import type { IPayrollPeriod } from "@/interfaces/payroll_period";
import { BONUS_RESULT_URL_VALUES } from "@/lib/payroll/bonusUrls";
import PayrollPeriodFilterToolbar, { type IStatusFilterOption } from "../../componentes/PayrollPeriodFilterToolbar";

interface Props {
  periodOptions: PeriodOption[];
  selectedPeriodId: number;
  selectedResult: "all" | BonusResult;
  searchText: string;
}

type PeriodOption = Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">;

const RESULT_OPTIONS: IStatusFilterOption[] = [
  { value: "all", label: "Todos", urlValue: null },
  { value: "keeps", label: "Conservan", urlValue: BONUS_RESULT_URL_VALUES.keeps },
  { value: "loses", label: "Pierden", urlValue: BONUS_RESULT_URL_VALUES.loses },
  { value: "not_evaluated", label: "No evaluados", urlValue: BONUS_RESULT_URL_VALUES.not_evaluated },
];

export default function BonusResultToolbar({ periodOptions, selectedPeriodId, selectedResult, searchText }: Props) {
  return (
    <PayrollPeriodFilterToolbar
      periodOptions={periodOptions}
      selectedPeriodId={selectedPeriodId}
      searchText={searchText}
      extraFilter={{
        groupLabel: "Resultado del bono",
        urlKey: "resultado",
        options: RESULT_OPTIONS,
        selected: selectedResult,
      }}
    />
  );
}
