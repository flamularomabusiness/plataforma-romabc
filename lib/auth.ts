import { useEffect, useState } from "react";

/**
 * Autenticação simplificada da Fase 1: role fica em localStorage (sem
 * backend/sessão ainda). Quando entrar login de verdade, troque apenas
 * getUserRole/setUserRole por leitura de JWT/sessão — o resto do app
 * continua funcionando sem mudanças.
 */

export const USER_ROLES = ["comercial", "gerente", "financeiro"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const USER_ROLE_STORAGE_KEY = "userRole";

export const ROLE_LABELS: Record<UserRole, string> = {
  comercial: "Comercial",
  gerente: "Gerente",
  financeiro: "Financeiro",
};

/**
 * Permissões por funcionalidade em vez de uma hierarquia numérica: com 3
 * roles, comercial e financeiro têm acessos que não são um subconjunto um
 * do outro (comercial cria contrato mas não vê dashboard; financeiro vê
 * dashboard mas não cria contrato), então "gerente >= financeiro >= comercial"
 * não é uma modelagem válida. gerente é o único que acumula tudo.
 */
export type Funcionalidade = "dashboard" | "clientes" | "formulario";

const PERMISSOES: Record<UserRole, Record<Funcionalidade, boolean>> = {
  comercial: { dashboard: false, clientes: true, formulario: true },
  gerente: { dashboard: true, clientes: true, formulario: true },
  financeiro: { dashboard: true, clientes: true, formulario: false },
};

export function getUserRole(): UserRole {
  if (typeof window === "undefined") return "comercial";
  const stored = window.localStorage.getItem(USER_ROLE_STORAGE_KEY);
  return (USER_ROLES as readonly string[]).includes(stored ?? "")
    ? (stored as UserRole)
    : "comercial";
}

export function setUserRole(role: UserRole) {
  window.localStorage.setItem(USER_ROLE_STORAGE_KEY, role);
}

export function clearUserRole() {
  window.localStorage.removeItem(USER_ROLE_STORAGE_KEY);
}

/** Variante pura, sem tocar localStorage — use com uma role já conhecida (ex.: vinda de useUserRole). */
export function podeAcessar(userRole: UserRole, funcionalidade: Funcionalidade): boolean {
  return PERMISSOES[userRole][funcionalidade];
}

export function hasAccess(funcionalidade: Funcionalidade): boolean {
  return podeAcessar(getUserRole(), funcionalidade);
}

export function redirectPathAfterFormulario(): string {
  return hasAccess("dashboard") ? "/painel/dashboard" : "/painel/clientes";
}

/**
 * Lê a role apenas após montar no client, para não gerar hydration mismatch
 * (no SSR, getUserRole() sempre retorna "comercial" por não haver
 * localStorage; ler direto no corpo do componente faria o HTML do servidor
 * divergir do primeiro render do client quando a role real for outra).
 */
export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>("comercial");

  useEffect(() => {
    setRole(getUserRole());
  }, []);

  return role;
}
