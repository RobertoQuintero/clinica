"use client";

import type { IPayrollPeriod } from "@/interfaces/payroll_period";
import type { ShiftExtensionAssignmentFilter } from "@/interfaces/payroll_shift_extension_bonus";
import { SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES } from "@/lib/payroll/bonusUrls";
import PayrollPeriodFilterToolbar, { type IStatusFilterOption } from "../../componentes/PayrollPeriodFilterToolbar";

type PeriodOption = Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">;

interface Props {
  periodOptions: PeriodOption[];
  selectedPeriodId: number;
  selectedAssignment: ShiftExtensionAssignmentFilter;
  searchText: string;
}

const ASSIGNMENT_OPTIONS: IStatusFilterOption[] = [
  { value: "all", label: "Todos", urlValue: null },
  { value: "assigned", label: "Asignados", urlValue: SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES.assigned },
  { value: "unassigned", label: "Sin asignar", urlValue: SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES.unassigned },
];

export default function ShiftExtensionToolbar({ periodOptions, selectedPeriodId, selectedAssignment, searchText }: Props) {
  return (
    <PayrollPeriodFilterToolbar
      periodOptions={periodOptions}
      selectedPeriodId={selectedPeriodId}
      searchText={searchText}
      extraFilter={{
        groupLabel: "Asignación del bono",
        urlKey: "asignacion",
        options: ASSIGNMENT_OPTIONS,
        selected: selectedAssignment,
      }}
    />
  );
}
