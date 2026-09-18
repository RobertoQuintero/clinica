import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { IAuthUser } from "@/interfaces/auth";
import { PAYROLL_ALLOWED_ROLE_IDS } from "@/lib/payroll/constants";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

export const proxy = async (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value;

  // Verificar validez del token y extraer payload
  let isAuthenticated = false;
  let userPayload: IAuthUser | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
      userPayload = payload as unknown as IAuthUser;
    } catch {
      isAuthenticated = false;
    }
  }

  const isPending = isAuthenticated && userPayload && !userPayload.status;

  // Ruta raíz: redirigir según estado de autenticación
  if (pathname === "/") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.redirect(new URL(isPending ? "/pending" : "/dashboard", req.url));
  }

  // Rutas /login y /register: si ya está autenticado, redirigir según estado
  if (pathname === "/login" || pathname === "/register") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(isPending ? "/pending" : "/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Ruta /pending: debe estar autenticado; si ya fue aprobado, ir al dashboard
  if (pathname === "/pending") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", req.url));
    if (!isPending) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // Rutas /dashboard/*: si no está autenticado, redirigir al login
  if (pathname.startsWith("/dashboard")) {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", req.url));
    // Usuarios pendientes deben ir a /pending
    if (isPending) return NextResponse.redirect(new URL("/pending", req.url));
    // id_role=5 solo puede acceder a /dashboard/tratamientos
    if (userPayload?.id_role === 5 && !pathname.startsWith("/dashboard/tratamientos")) {
      return NextResponse.redirect(new URL("/dashboard/tratamientos", req.url));
    }
    const INVENTORY_PATH_PREFIXES = [
      "/dashboard/inventario",
      "/dashboard/productos",
      "/dashboard/proveedores",
      "/dashboard/pedidos",
      "/dashboard/recepciones",
      "/dashboard/movimientos",
      "/dashboard/conteos",
    ];
    // id_role=6 (Compras) solo puede acceder al módulo de Inventario
    if (
      userPayload?.id_role === 6 &&
      !INVENTORY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      return NextResponse.redirect(new URL("/dashboard/inventario", req.url));
    }
    // id_role=2 (Podólogo) dentro de Inventario solo puede acceder a "Solicitudes"
    // y "Conteos" (spec 48 y 50); el resto del sistema (Pacientes, Citas,
    // Tratamientos, Ventas, etc.) sigue intacto para este rol.
    const ROLE_2_BLOCKED_INVENTORY_PREFIXES = INVENTORY_PATH_PREFIXES.filter(
      (prefix) => prefix !== "/dashboard/conteos"
    );
    if (
      userPayload?.id_role === 2 &&
      ROLE_2_BLOCKED_INVENTORY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      return NextResponse.redirect(new URL("/dashboard/solicitudes", req.url));
    }
    // Solo id_role=1 e id_role=4 pueden acceder a /dashboard/usuarios
    if (pathname.startsWith("/dashboard/usuarios") && userPayload?.id_role !== 1 && userPayload?.id_role !== 4) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Solo id_role=1 e id_role=4 pueden acceder a /dashboard/empleados
    if (pathname.startsWith("/dashboard/empleados") && userPayload?.id_role !== 1 && userPayload?.id_role !== 4) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Solo id_role=1 e id_role=4 pueden acceder a /dashboard/facturacion
    if (pathname.startsWith("/dashboard/facturacion") && userPayload?.id_role !== 1 && userPayload?.id_role !== 4) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Solo los roles de PAYROLL_ALLOWED_ROLE_IDS (1 y 4) pueden acceder a /dashboard/nomina
    if (
      pathname.startsWith("/dashboard/nomina") &&
      !PAYROLL_ALLOWED_ROLE_IDS.includes(userPayload?.id_role ?? -1)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Solo id_role=1 e id_role=4 pueden revisar/cerrar un conteo físico de inventario
    if (
      /^\/dashboard\/conteos\/[^/]+\/revision/.test(pathname) &&
      userPayload?.id_role !== 1 &&
      userPayload?.id_role !== 4
    ) {
      return NextResponse.redirect(new URL("/dashboard/conteos", req.url));
    }
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/register", "/pending"],
};
