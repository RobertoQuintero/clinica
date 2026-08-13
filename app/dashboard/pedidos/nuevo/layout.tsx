import { ReactNode } from "react";
import { PurchaseCartProvider } from "@/contexts/PurchaseCartContext";

/**
 * Acota el `PurchaseCartProvider` al flujo de armado de pedido (armado + revisión),
 * en vez de montarlo en todo `/dashboard`, para mantener el client boundary chico.
 */
export default function NuevoPedidoLayout({ children }: { children: ReactNode }) {
  return <PurchaseCartProvider>{children}</PurchaseCartProvider>;
}
