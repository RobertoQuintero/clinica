"use client";

import type { ILatenessFilters, ILatenessPage } from "@/interfaces/payroll_lateness";
import { LATENESS_CLASSIFICATION_URL_VALUES, LATENESS_STATUS_URL_VALUES } from "@/lib/payroll/latenessUrls";
import PayrollPeriodFilterToolbar, { type IStatusFilterOption } from "../../componentes/PayrollPeriodFilterToolbar";

interface Props {
  periodOptions: ILatenessPage["periodOptions"];
  selectedPeriodId: number;
  selectedStatus: ILatenessFilters["status"];
  selectedClassification: ILatenessFilters["classification"];
  searchText: string;
}

const STATUS_OPTIONS: IStatusFilterOption[] = [
  { value: "all", label: "Todos", urlValue: null },
  { value: "unjustified", label: "Injustificados", urlValue: LATENESS_STATUS_URL_VALUES.unjustified },
  { value: "justified", label: "Justificados", urlValue: LATENESS_STATUS_URL_VALUES.justified },
  { value: "not_applicable", label: "No aplica", urlValue: LATENESS_STATUS_URL_VALUES.not_applicable },
];

const CLASSIFICATION_OPTIONS: IStatusFilterOption[] = [
  { value: "all", label: "Todos", urlValue: null },
  { value: "severe", label: "Graves", urlValue: LATENESS_CLASSIFICATION_URL_VALUES.severe },
  { value: "accumulable", label: "Acumulables", urlValue: LATENESS_CLASSIFICATION_URL_VALUES.accumulable },
];

export default function LatenessToolbar({
  periodOptions,
  selectedPeriodId,
  selectedStatus,
  selectedClassification,
  searchText,
}: Props) {
  return (
    <PayrollPeriodFilterToolbar
      periodOptions={periodOptions}
      selectedPeriodId={selectedPeriodId}
      statusGroupLabel="Estado del retardo"
      statusOptions={STATUS_OPTIONS}
      selectedStatus={selectedStatus}
      searchText={searchText}
      extraFilter={{
        groupLabel: "Tipo de retardo",
        urlKey: "tipo",
        options: CLASSIFICATION_OPTIONS,
        selected: selectedClassification,
      }}
    />
  );
}
