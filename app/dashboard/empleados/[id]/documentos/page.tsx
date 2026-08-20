import { getEmployeeDocuments } from "./actions";
import EmployeeDocumentCard from "./componentes/EmployeeDocumentCard";
import EmployeeDocumentUploader, {
  EmployeeDocumentUploadProvider,
} from "./componentes/EmployeeDocumentUploader";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDocumentsPage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);

  const { slots, completados, total } = await getEmployeeDocuments(id_empleado);
  const documentTypes = slots
    .map((slot) => slot.tipo)
    .filter((tipo) => tipo !== null);

  return (
    <EmployeeDocumentUploadProvider>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex justify-between items-end flex-wrap gap-2">
            <div>
              <h3 className="text-xl font-bold text-[#0b1c30] dark:text-zinc-50">
                Documentos Requeridos
              </h3>
              <p className="text-sm text-[#44474f] dark:text-zinc-400">
                Gestiona y revisa la documentación obligatoria del empleado.
              </p>
            </div>
            <span className="bg-[#eff4ff] dark:bg-blue-950 text-[#0051d5] dark:text-blue-400 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
              {completados}/{total} Completados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {slots.map((slot) => (
              <EmployeeDocumentCard
                key={
                  slot.tipo
                    ? `tipo-${slot.tipo.id_tipo_documento}`
                    : `libre-${slot.documento!.id_empleado_documento}`
                }
                slot={slot}
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <EmployeeDocumentUploader id_empleado={id_empleado} documentTypes={documentTypes} />
        </div>
      </div>
    </EmployeeDocumentUploadProvider>
  );
}
