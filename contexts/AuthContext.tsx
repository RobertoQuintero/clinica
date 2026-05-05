"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { IAuthUser, IAuthContext } from "@/interfaces/auth";
import {
  loginAction,
  logoutAction,
  registerAction,
  getMeAction,
} from "@/app/actions/auth";

const AuthContext = createContext<IAuthContext | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]           = useState<IAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router                    = useRouter();

  // Restaurar sesión desde la cookie al cargar la app
  useEffect(() => {
    getMeAction()
      .then((u) => { if (u) setUser(u); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await loginAction(email, password);
    if (!result.ok) throw new Error(result.message);
    setUser(result.data);
    router.push("/dashboard");
  };

  const logout = async () => {
    await logoutAction();
    setUser(null);
    window.location.href = "/login";
  };

  const register = async (
    nombre:   string,
    email:    string,
    password: string,
    telefono: string
  ) => {
    const result = await registerAction(nombre, email, password, telefono);
    if (!result.ok) throw new Error(result.message);
    setUser(result.data);
    router.push("/pending");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): IAuthContext => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
};
