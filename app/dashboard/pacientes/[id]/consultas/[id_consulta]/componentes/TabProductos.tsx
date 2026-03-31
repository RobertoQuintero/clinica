import { IConsultaProducto } from "@/interfaces/consulta_producto";

export interface ConsultaProductoExtended extends IConsultaProducto {
  nombre_producto?: string;
}

interface Props {
  productos: ConsultaProductoExtended[];
}

export default function TabProductos({ productos }: Props) {
  if (productos.length === 0) {
    return <p className="text-zinc-400 text-sm">Sin productos registrados.</p>;
  }

  const total = productos.reduce((s, p) => s + Number(p.precio) * Number(p.cantidad), 0);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              {["Producto", "Cantidad", "Precio unit.", "Subtotal", "Estatus"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
            {productos.map((p) => (
              <tr key={p.id_consulta_producto} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre_producto || `#${p.id_producto}`}</td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.cantidad}</td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">${Number(p.precio).toFixed(2)}</td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">${(Number(p.precio) * Number(p.cantidad)).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "activo"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Total productos: ${total.toFixed(2)}
      </p>
    </div>
  );
}
