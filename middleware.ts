import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

export const middleware = async (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value;

  // Verificar validez del token
  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Ruta raíz: redirigir según estado de autenticación
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/dashboard" : "/login", req.url)
    );
  }

  // Rutas /login y /register: si ya está autenticado, redirigir al dashboard
  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Rutas /dashboard/*: si no está autenticado, redirigir al login
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/register"],
};
