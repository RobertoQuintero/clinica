"use client";

import type { AbsenceStatusFilter, IAbsencePage } from "@/interfaces/payroll_absence";
import { ABSENCE_STATUS_URL_VALUES } from "@/lib/payroll/absenceUrls";
import PayrollPeriodFilterToolbar, { type IStatusFilterOption } from "../../componentes/PayrollPeriodFilterToolbar";

interface Props {
  periodOptions: IAbsencePage["periodOptions"];
  selectedPeriodId: number;
  selectedStatus: AbsenceStatusFilter;
  searchText: string;
}

const STATUS_OPTIONS: IStatusFilterOption[] = [
  { value: "all", label: "Todas", urlValue: null },
  { value: "unjustified", label: "Injustificadas", urlValue: ABSENCE_STATUS_URL_VALUES.unjustified },
  { value: "justified", label: "Justificadas", urlValue: ABSENCE_STATUS_URL_VALUES.justified },
  { value: "not_applicable", label: "No aplica", urlValue: ABSENCE_STATUS_URL_VALUES.not_applicable },
];

export default function AbsenceToolbar({ periodOptions, selectedPeriodId, selectedStatus, searchText }: Props) {
  return (
    <PayrollPeriodFilterToolbar
      periodOptions={periodOptions}
      selectedPeriodId={selectedPeriodId}
      statusGroupLabel="Estado de la falta"
      statusOptions={STATUS_OPTIONS}
      selectedStatus={selectedStatus}
      searchText={searchText}
    />
  );
}
