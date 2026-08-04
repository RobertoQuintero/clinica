import { ReactNode } from "react";
import { cookies } from "next/headers";
import Sidebar from "@/app/dashboard/componentes/Sidebar";
import { SucursalProvider } from "@/contexts/SucursalContext";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialSucursalId = Number(cookieStore.get("sel_sucursal")?.value ?? 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <SucursalProvider initialSucursalId={initialSucursalId}>
        <Sidebar>
          <div className="p-6">{children}</div>
        </Sidebar>
      </SucursalProvider>
    </div>
  );
}



