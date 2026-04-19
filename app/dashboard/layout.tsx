import { ReactNode } from "react";
import Navbar from "@/app/dashboard/componentes/Navbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Navbar />
      <main className="p-6">{children}</main>
    </div>
  );
}


