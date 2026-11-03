import { Card } from "@/components/ui";
import { metaApp, tokenDaysLeft } from "@/lib/meta";
import { saveMetaApp } from "./actions";

export const metadata = { title: "Credenciales" };
export const dynamic = "force-dynamic";

const field = "bg-black/30 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent text-white";

export default async function Credenciales({ searchParams }: { searchParams: Promise<{ ok?: string; meta?: string }> }) {
  const sp = await searchParams;
  const days = tokenDaysLeft();
  return (
    <>
      <h1 className="text-lg font-semibold mb-4">Credenciales</h1>
      {sp.ok === "1" && <p role="status" className="mb-3 rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-good">Guardado.</p>}
      <form action={saveMetaApp} className="space-y-3">
        <Card title="Tu app de Meta (obligatorio)">
          {sp.meta === "falta" && <p role="alert" className="mb-2 text-bad">Primero cargá el App ID y el App Secret de tu app de Meta.</p>}
          {sp.meta === "id" && <p role="alert" className="mb-2 text-bad">El App ID son solo números (8 a 25 dígitos).</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-muted">App ID
              <input name="app_id" defaultValue={metaApp()?.id ?? ""} inputMode="numeric" autoComplete="off" className={`${field} w-full mt-1`} />
            </label>
            <label className="text-muted">App Secret
              <input name="app_secret" type="password" autoComplete="off" placeholder={metaApp() ? "•••••• (guardado; dejalo vacío para no cambiarlo)" : ""} className={`${field} w-full mt-1`} />
            </label>
          </div>
          <p className="text-xs text-muted mt-2">Los copiás de developers.facebook.com → tu app → Configuración de la aplicación → Básica. Sin esto no se puede conectar Meta.</p>
          <button className="mt-3 px-4 py-2 rounded-lg bg-accent text-on-accent font-medium neon">Guardar app de Meta</button>
        </Card>
      </form>
      <div className="mt-3">
        <Card title="Conexión con Meta">
          <p className="text-muted">{days === undefined ? "Sin conexión guardada." : `Token vigente, ${days} día(s) (se renueva solo).`}</p>
          <a href="/api/meta/connect" className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Conectar / reconectar con Meta</a>
        </Card>
      </div>
    </>
  );
}
