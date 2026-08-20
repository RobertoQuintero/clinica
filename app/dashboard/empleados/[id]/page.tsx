import { notFound } from "next/navigation";
import { getEmployeeById } from "../actions";
import EmployeeGeneralInfo from "./componentes/EmployeeGeneralInfo";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);

  const employee = await getEmployeeById(id_empleado);
  if (!employee) notFound();

  return <EmployeeGeneralInfo employee={employee} />;
}
