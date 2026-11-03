import { getProject, q, q1 } from "@/lib/db";
import { usdRate, ACC_SALES } from "@/lib/stats";
import { activeDashboard } from "@/lib/active-dashboard";
import { Card, money, td, th } from "@/components/ui";
import { lastBackups } from "@/lib/backup";
import { tokenDaysLeft, checkAccount } from "@/lib/meta";
import { dashboards } from "@/lib/dashboards";
import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { mcpKey } from "@/lib/mcp-key";
import { savePricing } from "./actions";

export const metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

const field = "bg-black/30 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent text-white";

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; check?: string }> }) {
  const sp = await searchParams;
  const saved = sp.ok === "1";
  const pid = getProject().id;
  const checks: { ok: boolean; text: string }[] = [];
  if (sp.check === "1") {
    for (const d of dashboards(pid)) {
      try {
        checks.push({ ok: true, text: `Meta · ${d.name}: conectado (cuenta «${await checkAccount(d.ad_account_id, pid)}»).` });
      } catch (e) {
        checks.push({ ok: false, text: `Meta · ${d.name}: ${(e as Error).message}` });
      }
    }
    if (!checks.length) checks.push({ ok: false, text: "Meta: no hay dashboards creados." });
    const hook = q1<{ n: number }>("select count(*) n from webhook where project_id=? and platform='impultienda'", pid);
    const last = q1<{ ts: number; ok: number; note: string }>(
      "select ts, ok, note from webhook_log where project_id=? and platform='impultienda' order by id desc limit 1", pid,
    );
    const when = last && new Date(last.ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    checks.push(
      !hook?.n ? { ok: false, text: "Impultienda: no creaste el webhook (Integraciones → Webhooks)." }
      : !last ? { ok: false, text: "Impultienda: webhook creado, pero todavía no llegó ninguna venta." }
      : last.ok ? { ok: true, text: `Impultienda: último aviso recibido OK el ${when}.` }
      : { ok: false, text: `Impultienda: el último aviso (${when}) dio error: ${last.note}` },
    );
  }
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const mcpUrl = `${base}/api/mcp?key=${mcpKey()}`;
  const mcpCmd = `claude mcp add --transport http attribution "${mcpUrl}"`;
  const rate = usdRate(pid);
  const set = q("select 1 from setting where project_id=? and key='usd_rate'", pid).length > 0;
  const active = await activeDashboard();
  const since = Number(q1<{ value: string }>("select value from setting where project_id=? and key='sales_since'", pid)?.value) || 0;
  const tax = Number(q1<{ value: string }>("select value from setting where project_id=? and key='tax_pct'", pid)?.value) || 0;
  const sinceDay = since ? new Date(since).toLocaleDateString("sv-SE") : "";
  const saved$ = (product: string) => q1<{ value: string }>("select value from setting where project_id=? and key=?", pid, `price:${product}`)?.value;
  type Row = { product: string; type: string | null; n: number; avg: number; net: number | null };
  const accArgs = active ? ["last_touch", pid, active.ad_account_id] : [];
  const net = `(select net_ars from product_net n where n.project_id=c.project_id and n.product=`;
  // Per line item (main + upsells) for orders that carry items; older orders only know their first product.
  const sold = [
    ...q<Row>(
      `select i.name product, i.type, count(*) n, avg(i.price) avg, ${net}i.name) net
         from conversion_item i join conversion c on c.id=i.conversion_id
        where c.project_id=? and ${active ? ACC_SALES : "1=0"} group by i.name, i.type`,
      pid, ...accArgs,
    ),
    ...q<Row>(
      `select c.product, null type, count(*) n, avg(c.value) avg, ${net}c.product) net
         from conversion c where c.project_id=? and c.product is not null
          and not exists (select 1 from conversion_item i where i.conversion_id=c.id) and ${active ? ACC_SALES : "1=0"} group by c.product`,
      pid, ...accArgs,
    ),
  ];
  // Products the store's webhooks have mentioned (type|price from Impultienda), sold or not.
  const seen = !active ? [] : q<{ product: string; info: string; net: number | null }>(
    `select substr(s.key, instr(s.key,'|')+1) product, s.value info,
            (select net_ars from product_net n where n.project_id=s.project_id and n.product=substr(s.key, instr(s.key,'|')+1)) net
       from setting s
      where s.project_id=? and s.key like 'store_prod:%'
        and exists (select 1 from setting m where m.project_id=s.project_id
                     and m.key='store_dash:'||substr(s.key,12,instr(s.key,'|')-12) and m.value=?)`,
    pid, active.ad_account_id,
  );
  const info = new Map(seen.map((s) => { const [t, p] = s.info.split("|"); return [s.product, { type: t === "upsell" || t === "main" ? t : null, price: Number(p) || 0 }]; }));
  const products = [
    ...sold.map((p) => ({ ...p, type: p.type ?? info.get(p.product)?.type ?? null })),
    ...seen.filter((s) => !sold.some((p) => p.product === s.product)).map((s) => ({ product: s.product, net: s.net, n: 0, avg: 0, type: info.get(s.product)?.type ?? null })),
  ].sort((a, b) => (a.type === "upsell" ? 1 : 0) - (b.type === "upsell" ? 1 : 0) || b.n - a.n);

  return (
    <>
      <h1 className="text-lg font-semibold mb-4">Ajustes de precios</h1>
      {saved && <p role="status" className="mb-3 rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-good">Guardado.</p>}
      <form action={savePricing} className="space-y-3">
        <Card title="Valor del dólar">
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="rate" className="text-muted">1 USD =</label>
            <input id="rate" name="rate" defaultValue={set ? rate : ""} placeholder="1200" inputMode="decimal" className={`${field} w-32`} />
            <span className="text-muted">ARS</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <label htmlFor="tax" className="text-muted">Impuestos y comisiones</label>
            <input id="tax" name="tax" defaultValue={tax || ""} placeholder="ej. 21" inputMode="decimal" className={`${field} w-24`} />
            <span className="text-muted">% del precio bruto</span>
          </div>
          <p className="text-xs text-muted mt-2">
            Sumá todos los porcentajes (IVA, pasarela, etc.). El neto de cada producto sin monto cargado a mano será precio × (1 − %).
          </p>
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <label htmlFor="since" className="text-muted">Contar ventas desde</label>
            <input id="since" name="since" type="date" defaultValue={sinceDay} className={`${field} w-44`} />
          </div>
          <p className="text-xs text-muted mt-2">
            Ignora ventas anteriores a esa fecha (útil si la cuenta publicitaria se reciclaba de otro producto). Vacío = todas.
          </p>
          <p className="text-xs text-muted mt-2">
            Las ventas de Impultienda llegan en pesos y el gasto de Meta en dólares. Con este valor todo el panel se muestra en USD.
            {!set && " Sin cargarlo, los pesos se muestran como si fueran dólares."}
          </p>
        </Card>

        <Card className="overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>{["Producto", "Ventas", "Precio de venta (ARS)", "Te queda tras impuestos (ARS)", "Neto en USD"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.product}>
                  <td className={td}>
                    <input type="hidden" name={`product_${i}`} value={p.product} />
                    {p.product}
                    {p.type && <span className="text-muted text-xs"> · {p.type === "upsell" ? "upsell" : "principal"}</span>}
                  </td>
                  <td className={td}>{p.n}</td>
                  <td className={td}>
                    <input aria-label={`Precio de venta de ${p.product}`} name={`price_${i}`} defaultValue={saved$(p.product) ?? (info.get(p.product)?.price || (p.n ? Math.round(p.avg) : ""))} placeholder="ej. 16990" inputMode="decimal" className={`${field} w-32`} />
                  </td>
                  <td className={td}>
                    <input aria-label={`Neto en ARS de ${p.product}`} name={`net_${i}`} defaultValue={p.net ?? ""} placeholder="auto" inputMode="decimal" className={`${field} w-36`} />
                  </td>
                  <td className={`${td} text-good`}>{money((p.net ?? Number(saved$(p.product) ?? info.get(p.product)?.price ?? 0) * (1 - tax / 100)) / rate)}</td>
                </tr>
              ))}
              {!products.length && <tr><td className={`${td} text-muted`} colSpan={5}>Todavía no hay ventas con producto en el dashboard «{active?.name ?? "—"}». Aparecerán acá cuando entre la primera.</td></tr>}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted">
          Ganancia neta = (lo que te queda por producto ÷ dólar) − gasto en anuncios. Producto sin monto cargado: se usa el precio de venta menos el % de impuestos de arriba.
        </p>
        <button className="px-4 py-2 rounded-lg bg-accent text-on-accent font-medium neon">Guardar</button>
      </form>

      <div className="mt-6">
        <Card title="Probar conexiones">
          <p className="text-muted">Revisa que Meta responda con tu token y que Impultienda esté mandando ventas.</p>
          <a href="/ajustes?check=1" className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Probar conexiones</a>
          {checks.length > 0 && (
            <ul role="status" className="mt-3 space-y-1">
              {checks.map((c, i) => (
                <li key={i} className={c.ok ? "text-good" : "text-bad"}>{c.ok ? "✓" : "✕"} {c.text}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted mt-2">Impultienda no se puede consultar directo: se confía en el último aviso (webhook) recibido.</p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Conectar con Claude Code (MCP, solo lectura)">
          <p className="text-muted">
            Te deja preguntarle a Claude Code por tus campañas, ventas y ROAS. Solo lee: no puede cambiar nada. Pegá esto en una terminal:
          </p>
          <div className="flex gap-2 items-start my-2">
            <pre className="flex-1 bg-bg border border-line rounded p-3 font-mono text-xs whitespace-pre-wrap break-all">{mcpCmd}</pre>
            <CopyButton text={mcpCmd} />
          </div>
          <p className="text-xs text-muted">
            El link lleva tu clave: quien lo tenga puede leer tus números. No lo compartas. Para que funcione con Claude Code en tu PC, esta página tiene que estar abierta desde la dirección de Railway (no localhost).
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Copias de seguridad y conexión">
          <p className="text-muted">
            Copia automática diaria en el servidor (últimas 7): {lastBackups().length ? lastBackups()[0].replace("utmify-", "").replace(".db", "") : "todavía ninguna"}.
            {" "}Meta: {tokenDaysLeft() === undefined ? "sin conexión guardada" : `token vigente, ${tokenDaysLeft()} día(s) (se renueva solo)`}.
          </p>
          <a href="/api/meta/connect" className="inline-block mt-3 mr-2 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Conectar / reconectar con Meta</a>
          <a href="/api/backup" className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Descargar copia ahora</a>
          <p className="text-xs text-muted mt-2">Guardá una copia en tu PC de vez en cuando: las automáticas viven en el mismo disco que los datos.</p>
        </Card>
      </div>
    </>
  );
}
