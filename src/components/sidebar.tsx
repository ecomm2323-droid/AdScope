"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Dash = { id: number; name: string; ad_account_id: string };

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Resumen", icon: "◧" },
  { href: "/campanas", label: "Meta", icon: "◎" },
  { href: "/ventas", label: "Ventas", icon: "$" },
  { href: "/utms", label: "UTMs", icon: "⌗" },
  { href: "/integraciones", label: "Integraciones", icon: "⇄" },
  { href: "/dashboards", label: "Dashboards", icon: "▦" },
  { href: "/credenciales", label: "Credenciales", icon: "🔑" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
  { href: "/tutorial", label: "Tutorial", icon: "?" },
];

// Desktop: top bar with a pill nav. Phones: fixed header + slide-in drawer with the same links.
export function Sidebar({ dashes, active }: { dashes: Dash[]; active?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  useEffect(() => setOpen(false), [path]);
  if (path === "/login") return null;
  const cur = dashes.find((d) => d.id === active);
  const isOn = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const switcher = (
    <details className="relative group">
      <summary className="glass rounded-full px-4 min-h-11 md:min-h-10 cursor-pointer list-none flex items-center gap-2 hover:border-accent/50">
        <span className="truncate max-w-40">{cur?.name ?? "Sin dashboards"}</span>
        <span className="text-muted group-open:rotate-180 transition-transform">⌄</span>
      </summary>
      <div className="glass absolute z-50 mt-2 min-w-full w-56 rounded-2xl p-1.5 right-0 md:right-0">
        {dashes.map((d) => (
          <a key={d.id} href={`/dashboards/activate?id=${d.id}`} className={`block rounded-xl px-3 py-2.5 hover:bg-white/10 ${d.id === active ? "text-accent" : ""}`}>
            {d.name}
          </a>
        ))}
        <Link href="/dashboards" className="block rounded-xl px-3 py-2.5 text-muted hover:text-white hover:bg-white/10">+ Gestionar</Link>
      </div>
    </details>
  );

  return (
    <>
      <header className="hidden md:flex sticky top-0 z-30 items-center gap-4 px-6 py-4 bg-bg/80 backdrop-blur">
        <span className="text-base font-semibold tracking-tight shrink-0"><span className="text-accent">✦</span> Adscope</span>
        <nav className="glass rounded-full p-1.5 flex gap-1 mx-auto overflow-x-auto no-scrollbar" aria-label="Principal">
          {NAV.map((n) => {
            const on = isOn(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 whitespace-nowrap ${on ? "bg-accent text-on-accent font-medium" : "text-muted hover:text-white hover:bg-white/5"}`}
              >
                <span aria-hidden>{n.icon}</span>
                <span className={on ? "" : "hidden xl:inline"}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          {switcher}
          <a href="/logout" className="text-sm text-muted hover:text-white">Salir</a>
        </div>
      </header>

      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 px-4 flex items-center gap-3 glass rounded-none border-x-0 border-t-0">
        <button
          type="button"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="h-11 w-11 -ml-2 grid place-items-center rounded-full text-xl hover:bg-white/10"
        >
          ☰
        </button>
        <span className="font-semibold"><span className="text-accent">✦</span> Adscope</span>
        <span className="ml-auto text-xs text-muted truncate max-w-[40%]">{cur?.name}</span>
      </header>
      {open && <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={`md:hidden glass w-64 shrink-0 p-3 flex flex-col rounded-none border-y-0 border-l-0 fixed inset-y-0 left-0 z-40 h-screen
          transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-2 py-3 mb-1 text-base font-semibold tracking-tight flex items-center">
          <span><span className="text-accent">✦</span> Adscope</span>
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="ml-auto h-11 w-11 -mr-2 grid place-items-center rounded-full hover:bg-white/10">✕</button>
        </div>
        <div className="mb-3">{switcher}</div>
        <nav className="flex flex-col gap-1" aria-label="Principal">
          {NAV.map((n) => {
            const on = isOn(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full px-4 py-2.5 ${on ? "bg-accent text-on-accent font-medium" : "text-muted hover:text-white hover:bg-white/5"}`}
              >
                <span aria-hidden className="w-4 text-center">{n.icon}</span>{n.label}
              </Link>
            );
          })}
        </nav>
        <a href="/logout" className="mt-auto px-3 py-3 text-sm text-muted hover:text-white">Salir</a>
      </aside>
    </>
  );
}
