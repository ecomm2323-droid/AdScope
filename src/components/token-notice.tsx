"use client";

import { usePathname } from "next/navigation";

// Warns when the Meta connection is about to stop (auto-renewal failed) or already has.
export function TokenNotice({ days, needsApp, weakPass }: { days?: number; needsApp?: boolean; weakPass?: boolean }) {
  const path = usePathname();
  if (path === "/login") return null;
  if (weakPass)
    return (
      <div className="mb-4 rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 text-bad">
        Tu APP_PASSWORD es corta (menos de 12 caracteres). Cambiala en Railway → Variables por una más larga.
      </div>
    );
  if (needsApp && path !== "/credenciales" && path !== "/tutorial")
    return (
      <a href="/credenciales" className="block mb-4 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-warn">
        Falta cargar el App ID y el App Secret de tu app de Meta. Tocá acá para completarlos.
      </a>
    );
  if (days === undefined || days > 10) return null;
  return (
    <a href="/api/meta/connect" className="block mb-4 rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 text-bad">
      {days < 0 ? "La conexión con Meta venció: el gasto ya no se actualiza." : `La conexión con Meta vence en ${days} día(s) (dura 60 y no se renovó sola).`}{" "}
      Para reconectar: tocá acá (o Ajustes → «Conectar / reconectar con Meta»), iniciá sesión con Facebook y aceptá los permisos. Tarda 1 minuto y no perdés datos.
    </a>
  );
}
