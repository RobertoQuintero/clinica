import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Package,
  Box,
  Store,
  Link2,
  ShoppingCart,
  ClipboardList,
  UsersRound,
  UserCog,
  Truck,
  ShoppingBag,
  PackageCheck,
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardPlus,
  Receipt,
  Warehouse,
  Banknote,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

export interface NavChild {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles que no deben ver este hijo del grupo (p. ej. el rol 2 fuera de "Solicitudes", spec 48). */
  excludeRoles?: number[];
}

export interface NavLink {
  href?: string;
  label: string;
  icon: LucideIcon;
  minRole: number;
  excludeRoles: number[];
  disabled?: boolean;
  children?: NavChild[];
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: 0, excludeRoles: [5, 6] },
  { href: "/dashboard/pacientes", label: "Pacientes", icon: Users, minRole: 0, excludeRoles: [5, 6] },
  { href: "/dashboard/citas", label: "Citas", icon: Calendar, minRole: 0, excludeRoles: [5, 6] },
  { href: "/dashboard/servicios", label: "Servicios", icon: Stethoscope, minRole: 0, excludeRoles: [5, 6] },
  {
    label: "Inventario",
    icon: Package,
    minRole: 0,
    excludeRoles: [5],
    children: [
      { href: "/dashboard/solicitudes", label: "Solicitudes", icon: ClipboardPlus },
      { href: "/dashboard/inventario", label: "Inventario Actual", icon: Warehouse, excludeRoles: [2] },
      { href: "/dashboard/productos", label: "Productos", icon: Box, excludeRoles: [2] },
      { href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, excludeRoles: [2] },
      { href: "/dashboard/pedidos", label: "Pedidos", icon: ShoppingBag, excludeRoles: [2] },
      { href: "/dashboard/recepciones", label: "Recepciones", icon: PackageCheck, excludeRoles: [2] },
      { href: "/dashboard/movimientos", label: "Movimientos", icon: ArrowLeftRight, excludeRoles: [2] },
      { href: "/dashboard/conteos", label: "Conteos", icon: ClipboardCheck },
    ],
  },
  { href: "/dashboard/sucursales", label: "Sucursales", icon: Store, minRole: 0, excludeRoles: [5, 6] },
  { href: "/dashboard/enlaces", label: "Enlaces", icon: Link2, minRole: 0, excludeRoles: [3, 5, 6] },
  { href: "/dashboard/ventas", label: "Ventas", icon: ShoppingCart, minRole: 0, excludeRoles: [5, 6] },
  { href: "/dashboard/tratamientos", label: "Tratamientos", icon: ClipboardList, minRole: 0, excludeRoles: [6] },
  { href: "/dashboard/empleados", label: "Empleados", icon: UsersRound, minRole: 0, excludeRoles: [2, 3, 5, 6] },
  {
    label: "Nómina",
    icon: Banknote,
    minRole: 0,
    // Complemento de PAYROLL_ALLOWED_ROLE_IDS (lib/payroll/constants.ts): solo roles 1 y 4.
    excludeRoles: [2, 3, 5, 6],
    children: [
      {
        href: "/dashboard/nomina/periodos",
        label: "Periodos",
        icon: CalendarRange,
        excludeRoles: [2, 3, 5, 6],
      },
    ],
  },
  // { href: "/dashboard/facturacion", label: "Facturación", icon: Receipt, minRole: 0, excludeRoles: [2, 3, 5] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: UserCog, minRole: 0, excludeRoles: [2, 3, 5, 6] },
];
