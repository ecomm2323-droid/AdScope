import { getProject, q } from "@/lib/db";
import { activeDashboard } from "@/lib/active-dashboard";
import { asBasis, asModel, asPeriod, range, sales } from "@/lib/stats";
import { Card, Filters, money, srcLabel, td, th } from "@/components/ui";
import { DashboardNotice } from "@/components/dashboard-notice";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/confirm-button";
import { forceAttribution, markApproved } from "./actions";

export const metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

const LIMIT = 2000;

const TONE: Record<string, string> = {
  approved: "text-good",
  pending: "text-yellow-400",
  refunded: "text-bad",
  chargeback: "text-bad",
  rejected: "text-muted",
};

export default async function Ventas({ searchParams }: { searchParams: Promise<{ p?: string; m?: string; v?: string; f?: string; t?: string; o?: string; err?: string }> }) {
  const sp = await searchParams;
  const p = asPeriod(sp.p);
  const m = asModel(sp.m);
  const v = asBasis(sp.v);
  const { from, to } = range(p, sp.f, sp.t);
  const dash = await activeDashboard();
  const pid = getProject().id;
  const rows = sales(pid, from, to, m, dash?.ad_account_id ?? "", LIMIT);
  const ads = q<{ ad_id: string; ad_name: string | null; campaign_name: string | null }>(
    "select ad_id, max(ad_name) ad_name, max(campaign_name) campaign_name from meta_ad_day where project_id=? and ad_account_id=? group by ad_id order by max(date) desc, ad_id limit 500",
    pid, dash?.ad_account_id ?? "",
  );
  const here = `/ventas?p=${p}&m=${m}&v=${v}${p === "custom" && sp.f ? `&f=${sp.f}&t=${sp.t ?? sp.f}` : ""}`;

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Ventas</h1>
      <DashboardNotice name={dash?.name} account={dash?.ad_account_id} />
      <AutoRefresh />
      <Filters base="/ventas" p={p} m={m} v={v} f={sp.f} t={sp.t} />
      {sp.err && <div className="mb-3 rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 text-bad">{sp.err.slice(0, 200)}</div>}
      <Card title="Forzar una venta a un anuncio" className="mb-3">
        <form action={forceAttribution} className="flex flex-wrap gap-2 items-center">
          <input type="hidden" name="back" value={here} />
          <input name="order" defaultValue={sp.o ?? ""} placeholder="Nº de pedido (o tocá «Asignar» en la fila)" aria-label="Número de pedido" className="bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent w-72" required />
          <select name="ad" aria-label="Anuncio" defaultValue="" className="bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent max-w-full" required>
            <option value="" disabled>Elegí el anuncio…</option>
            {ads.map((a) => <option key={a.ad_id} value={a.ad_id}>{a.ad_name ?? a.ad_id} · {a.campaign_name ?? "—"}</option>)}
          </select>
          <ConfirmButton message="¿Asignar esta venta a ese anuncio? Reemplaza la atribución actual." className="px-4 py-2 rounded-lg bg-accent text-on-accent font-medium neon">Asignar</ConfirmButton>
        </form>
        <p className="text-xs text-muted mt-2">Solo anuncios de esta cuenta con gasto sincronizado. Queda marcada «manual» y no se pisa sola.</p>
      </Card>
      {rows.length >= LIMIT && <p className="text-xs text-muted mb-2">Mostrando las {LIMIT} ventas más recientes del período.</p>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              {["Fecha", "Pedido", "Estado", "Valor", "Neto USD", "Plataforma", "Producto", "Pago", "Fuente", "Campaña", "Anuncio", "Confianza", ""].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>{new Date(r.ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className={`${td} font-mono text-xs`}>{r.order_id.slice(0, 18)}</td>
                <td className={`${td} ${TONE[r.status] ?? ""}`}>{r.status}</td>
                <td className={td}>{money(r.value)} <span className="text-muted text-[10px]">{r.currency ?? ""}</span></td>
                <td className={td}>{money(r.net)}</td>
                <td className={td}>{r.platform ?? "—"}</td>
                <td className={td}>
                  {r.items
                    ? r.items.split("\n").map((l) => {
                        const [name, type, price] = l.split("\t");
                        return <div key={l}>{name}{type === "upsell" && <span className="text-muted"> (upsell)</span>} <span className="text-muted">{money(Number(price))}</span></div>;
                      })
                    : r.product ?? "—"}
                </td>
                <td className={td}>{r.payment_method ?? "—"}</td>
                <td className={td}>{srcLabel(r.channel)}</td>
                <td className={td}>{r.campaign ?? "—"}</td>
                <td className={td}>{r.ad_name ?? r.ad_id ?? "—"}</td>
                <td className={`${td} text-muted`}>{r.confidence ?? "—"}</td>
                <td className={td}><a href={`${here}&o=${encodeURIComponent(r.order_id)}`} className="text-xs underline text-muted hover:text-white">Asignar</a>
                  {r.status === "pending" && (
                    <form action={markApproved} className="mt-1">
                      <input type="hidden" name="order" value={r.order_id} />
                      <input type="hidden" name="back" value={here} />
                      <ConfirmButton message="¿Confirmás que este pedido ya figura aprobado en la plataforma? Pasa a approved y cuenta en las métricas." className="text-xs underline text-muted hover:text-white">Marcar aprobada</ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td className={`${td} text-muted`} colSpan={13}>Sin ventas de esta cuenta en el período.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
