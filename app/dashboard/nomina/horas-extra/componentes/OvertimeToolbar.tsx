"use client";

import type { IOvertimePage, OvertimeStatusFilter } from "@/interfaces/payroll_overtime";
import { OVERTIME_STATUS_URL_VALUES } from "@/lib/payroll/overtimeUrls";
import PayrollPeriodFilterToolbar, { type IStatusFilterOption } from "../../componentes/PayrollPeriodFilterToolbar";

interface Props {
  periodOptions: IOvertimePage["periodOptions"];
  selectedPeriodId: number;
  selectedStatus: OvertimeStatusFilter;
  searchText: string;
}

const STATUS_OPTIONS: IStatusFilterOption[] = [
  { value: "all", label: "Todas", urlValue: null },
  { value: "pending", label: "Pendientes", urlValue: OVERTIME_STATUS_URL_VALUES.pending },
  { value: "authorized", label: "Autorizadas", urlValue: OVERTIME_STATUS_URL_VALUES.authorized },
  { value: "rejected", label: "Rechazadas", urlValue: OVERTIME_STATUS_URL_VALUES.rejected },
];

export default function OvertimeToolbar({ periodOptions, selectedPeriodId, selectedStatus, searchText }: Props) {
  return (
    <PayrollPeriodFilterToolbar
      periodOptions={periodOptions}
      selectedPeriodId={selectedPeriodId}
      statusGroupLabel="Estado de la decisión"
      statusOptions={STATUS_OPTIONS}
      selectedStatus={selectedStatus}
      searchText={searchText}
    />
  );
}
