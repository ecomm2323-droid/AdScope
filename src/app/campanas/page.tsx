import Link from "next/link";
import { getProject } from "@/lib/db";
import { activeDashboard } from "@/lib/active-dashboard";
import { asBasis, asModel, asPeriod, byLevel, lastSync, range, type Level } from "@/lib/stats";
import { Card, Filters, money, td, th } from "@/components/ui";
import { SyncMeta } from "@/components/sync-meta";
import { DashboardNotice } from "@/components/dashboard-notice";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/confirm-button";
import { setBudget, setStatus } from "./actions";

export const metadata = { title: "Meta" };
export const dynamic = "force-dynamic";

const LEVELS: Record<Level, string> = { campaign: "Campañas", adset: "Conjuntos", ad: "Anuncios" };

// [header, tooltip]; a tooltip adds the ⓘ marker.
const COLUMNS: [string, string?][] = [
  ["Estado"], ["Campaña"], ["Presupuesto", "Presupuesto diario. En campañas sin presupuesto propio, suma el de sus conjuntos activos."],
  ["Últ. actualización", "Última modificación en Meta"], ["Ventas"], ["CPA", "Gasto ÷ ventas aprobadas"], ["Gastos"],
  ["Ingresos", "Ventas aprobadas atribuidas (USD, bruta o neta según el filtro)"], ["Ganancia", "Ingresos − gasto (USD)"],
  ["ROAS", "Ingresos ÷ gasto"], ["Margen", "Ganancia ÷ ingresos"], ["ROI", "Ganancia ÷ gasto"],
  ["IC", "Inicios de checkout (pixel de Meta)"], ["CPI", "Gasto ÷ inicios de checkout"], ["CPC", "Gasto ÷ clics"],
  ["CTR", "Clics ÷ impresiones"], ["CPM", "Costo por mil impresiones"], ["Impresiones"], ["Clics", "Todos los clics (Meta)"],
  ["Límite de oferta", "Bid cap del conjunto"], ["Gasto mín.", "Gasto mínimo diario del conjunto"], ["Gasto máx.", "Gasto máximo diario del conjunto"],
];

// One sort key per COLUMNS entry, same order.
const KEYS = ["status", "name", "budget", "updated", "sales", "cpa", "spend", "revenue", "profit", "roas", "margin", "roi", "ic", "cpi", "cpc", "ctr", "cpm", "imp", "clicks", "bid", "min", "max"] as const;
type SortKey = (typeof KEYS)[number];

const usd = (n: number | null) => (n == null ? "—" : money(n));
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(2)}%`);
const STATUS = (s: string | null): [string, string] =>
  !s ? ["—", "text-muted"] : s === "ACTIVE" ? ["Activo", "text-good"] : /PAUSED/.test(s) ? ["Pausado", "text-muted"] : [s.toLowerCase().replace(/_/g, " "), "text-yellow-400"];

export default async function Campanas({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; m?: string; l?: string; f?: string; t?: string; c?: string; s?: string; v?: string; o?: string; d?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const p = asPeriod(sp.p);
  const m = asModel(sp.m);
  const v = asBasis(sp.v);
  const level: Level = sp.l === "adset" || sp.l === "ad" ? sp.l : "campaign";
  const { from, to } = range(p, sp.f, sp.t);
  // Picked campaigns (c) and adsets (s): comma-separated ids in the URL, they carry across the level tabs.
  const ids = (v?: string) => (v ?? "").split(",").filter((x) => /^\d{1,32}$/.test(x)).slice(0, 100);
  const c = ids(sp.c);
  const s = level === "campaign" ? [] : ids(sp.s);
  const date = p === "custom" && sp.f ? `&f=${sp.f}&t=${sp.t ?? sp.f}` : "";
  const o: SortKey = (KEYS as readonly string[]).includes(sp.o ?? "") ? (sp.o as SortKey) : "spend";
  const d = sp.d === "asc" ? "asc" : "desc";
  const url = (l: Level, nc: string[], ns: string[], no: SortKey = o, nd = d) =>
    `/campanas?p=${p}&m=${m}&v=${v}&o=${no}&d=${nd}&l=${l}${date}${nc.length ? `&c=${nc.join(",")}` : ""}${ns.length ? `&s=${ns.join(",")}` : ""}`;
  const toggle = (id: string) => {
    const on = (level === "campaign" ? c : s).includes(id);
    const flip = (a: string[]) => (on ? a.filter((x) => x !== id) : [...a, id]);
    return level === "campaign" ? url(level, flip(c), []) : url(level, c, flip(s));
  };
  const pid = getProject().id;
  const dash = await activeDashboard();
  const rows = byLevel(pid, from, to, m, level, dash?.ad_account_id ?? "", c, s);
  const revOf = (r: (typeof rows)[number]) => (v === "neta" ? r.net : r.revenue);
  const ratio = (n: number, den: number) => (den ? n / den : null);
  const metric: Record<SortKey, (r: (typeof rows)[number]) => number | string | null> = {
    status: (r) => STATUS(r.status)[0], name: (r) => r.name, budget: (r) => r.budget, updated: (r) => r.updated, sales: (r) => r.sales,
    cpa: (r) => ratio(r.spend, r.sales), spend: (r) => r.spend, revenue: revOf, profit: (r) => revOf(r) - r.spend,
    roas: (r) => ratio(revOf(r), r.spend), margin: (r) => ratio(revOf(r) - r.spend, revOf(r)), roi: (r) => ratio(revOf(r) - r.spend, r.spend),
    ic: (r) => r.ic, cpi: (r) => ratio(r.spend, r.ic), cpc: (r) => ratio(r.spend, r.clicks), ctr: (r) => ratio(r.clicks, r.impressions),
    cpm: (r) => { const x = ratio(r.spend, r.impressions); return x == null ? null : x * 1000; }, imp: (r) => r.impressions, clicks: (r) => r.clicks,
    bid: (r) => r.bid, min: (r) => r.minSpend, max: (r) => r.maxSpend,
  };
  // Empty values go last in both directions.
  rows.sort((a, b) => {
    const x = metric[o](a), y = metric[o](b);
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    const c = typeof x === "string" ? x.localeCompare(String(y), "es") : x - (y as number);
    return d === "asc" ? c : -c;
  });
  const tot = rows.reduce(
    (t, r) => ({ sales: t.sales + r.sales, spend: t.spend + r.spend, rev: t.rev + revOf(r), clicks: t.clicks + r.clicks, imp: t.imp + r.impressions, ic: t.ic + r.ic }),
    { sales: 0, spend: 0, rev: 0, clicks: 0, imp: 0, ic: 0 },
  );
  const totProfit = tot.rev - tot.spend;

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Meta</h1>
      <DashboardNotice name={dash?.name} account={dash?.ad_account_id} />
      <AutoRefresh />
      {sp.err && <div className="mb-3 rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 text-bad">{sp.err.slice(0, 300)}</div>}
      <SyncMeta last={lastSync(pid)} />
      <div className="flex gap-2 mb-3">
        {(Object.keys(LEVELS) as Level[]).map((l) => (
          <Link
            key={l}
            href={url(l, c, l === "ad" ? s : [])}
            aria-current={l === level ? "page" : undefined}
            className={`px-4 py-2.5 rounded-lg border ${l === level ? "border-accent text-white bg-panel" : "border-line text-muted"}`}
          >
            {LEVELS[l]}
          </Link>
        ))}
      </div>
      <Filters base="/campanas" p={p} m={m} v={v} f={sp.f} t={sp.t} extra={`&o=${o}&d=${d}&l=${level}${c.length ? `&c=${c.join(",")}` : ""}${s.length ? `&s=${s.join(",")}` : ""}`} />
      {(c.length > 0 || s.length > 0) && (
        <p className="text-xs text-muted mb-2">
          Filtrando por {c.length ? `${c.length} campaña(s)` : ""}{c.length && s.length ? " y " : ""}{s.length ? `${s.length} conjunto(s)` : ""} ·{" "}
          <Link href={url(level, [], [])} className="underline text-white">Quitar filtro</Link>
        </p>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full meta-table">
          <thead>
            <tr>
              <th className={th} />
              {COLUMNS.map(([h, tip], i) => {
                const key = KEYS[i];
                return (
                  <th
                    key={h}
                    title={tip}
                    aria-sort={key === o ? (d === "asc" ? "ascending" : "descending") : undefined}
                    className={`${th} ${i === 1 ? "sticky left-0 bg-[#12141f]" : ""}`}
                  >
                    <Link
                      href={url(level, c, s, key, key === o ? (d === "desc" ? "asc" : "desc") : key === "name" || key === "status" ? "asc" : "desc")}
                      className={`underline decoration-dotted ${key === o ? "text-white" : ""}`}
                    >
                      {h === "Campaña" ? LEVELS[level].slice(0, -1) : h}{key === o ? (d === "asc" ? " ↑" : " ↓") : ""}
                    </Link>
                    {tip ? " ⓘ" : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rev = v === "neta" ? r.net : r.revenue;
              const profit = rev - r.spend;
              const st = STATUS(r.status);
              return (
                <tr key={r.id} className={(level === "campaign" ? c : s).includes(r.id) ? "bg-accent/10" : ""}>
                  <td className={td}>
                    {level !== "ad" && (
                      <Link
                        href={toggle(r.id)}
                        aria-label={`${(level === "campaign" ? c : s).includes(r.id) ? "Quitar filtro de" : level === "campaign" ? "Filtrar conjuntos y anuncios por la campaña" : "Filtrar anuncios por el conjunto"} ${r.name}`}
                        className="inline-flex p-3 -m-3"
                      >
                        <span className={`block h-4 w-8 rounded-full border ${(level === "campaign" ? c : s).includes(r.id) ? "bg-accent border-accent neon" : "border-line bg-white/5"}`}>
                          <span className={`block h-3 w-3 mt-px rounded-full bg-white transition-transform ${(level === "campaign" ? c : s).includes(r.id) ? "translate-x-[17px]" : "translate-x-px"}`} />
                        </span>
                      </Link>
                    )}
                  </td>
                  <td className={`${td} ${st[1]}`}>
                    {st[0]}
                    {(r.status === "ACTIVE" || r.status === "PAUSED") && (
                      <form action={setStatus} className="mt-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="back" value={url(level, c, s)} />
                        <input type="hidden" name="status" value={r.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
                        <ConfirmButton message={`¿${r.status === "ACTIVE" ? "Pausar" : "Activar"} «${r.name}» en Meta?`} className="text-[11px] underline text-muted hover:text-white">
                          {r.status === "ACTIVE" ? "Pausar" : "Activar"}
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                  <td className={`${td} sticky left-0 bg-[#12141f] max-w-[8.5rem] md:max-w-xs`}>
                    <div className="truncate">{r.name}</div>
                    <div className="font-mono text-[11px] text-muted">{r.id}</div>
                  </td>
                  <td className={td}>
                    {usd(r.budget)}
                    {r.ownBudget && (
                      <form action={setBudget} className="mt-1 flex gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="back" value={url(level, c, s)} />
                        <input name="budget" type="number" step="0.01" min="0.01" placeholder="nuevo" aria-label={`Nuevo presupuesto diario de ${r.name}`} className="w-20 rounded border border-line bg-white/5 px-1 text-xs" />
                        <ConfirmButton message={`¿Cambiar el presupuesto diario de «${r.name}» en Meta?`} className="text-[11px] underline text-muted hover:text-white">OK</ConfirmButton>
                      </form>
                    )}
                  </td>
                  <td className={td}>{r.updated ? new Date(r.updated).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                  <td className={td}>{r.sales}</td>
                  <td className={td}>{usd(r.sales ? r.spend / r.sales : null)}</td>
                  <td className={td}>{usd(r.spend || null)}</td>
                  <td className={td}>{usd(rev || null)}</td>
                  <td className={`${td} ${profit < 0 ? "text-bad" : profit > 0 ? "text-good" : ""}`}>{r.spend || rev ? money(profit) : "—"}</td>
                  <td className={td}>{r.spend ? `${(rev / r.spend).toFixed(2)}x` : "—"}</td>
                  <td className={td}>{pct(rev ? profit / rev : null)}</td>
                  <td className={td}>{pct(r.spend ? profit / r.spend : null)}</td>
                  <td className={td}>{r.ic}</td>
                  <td className={td}>{usd(r.ic ? r.spend / r.ic : null)}</td>
                  <td className={td}>{usd(r.clicks ? r.spend / r.clicks : null)}</td>
                  <td className={td}>{pct(r.impressions ? r.clicks / r.impressions : null)}</td>
                  <td className={td}>{usd(r.impressions ? (r.spend / r.impressions) * 1000 : null)}</td>
                  <td className={td}>{r.impressions.toLocaleString("en-US")}</td>
                  <td className={td}>{r.clicks.toLocaleString("en-US")}</td>
                  <td className={td}>{usd(r.bid)}</td>
                  <td className={td}>{usd(r.minSpend)}</td>
                  <td className={td}>{usd(r.maxSpend)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td className={`${td} text-muted`} colSpan={COLUMNS.length + 1}>Sin datos de esta cuenta en el período. Sincronizá Meta.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold bg-white/5">
                <td className={td} />
                <td className={td} />
                <td className={`${td} sticky left-0 bg-[#12141f]`}>Total ({rows.length})</td>
                <td className={td} />
                <td className={td} />
                <td className={td}>{tot.sales}</td>
                <td className={td}>{usd(tot.sales ? tot.spend / tot.sales : null)}</td>
                <td className={td}>{usd(tot.spend || null)}</td>
                <td className={td}>{usd(tot.rev || null)}</td>
                <td className={`${td} ${totProfit < 0 ? "text-bad" : totProfit > 0 ? "text-good" : ""}`}>{tot.spend || tot.rev ? money(totProfit) : "—"}</td>
                <td className={td}>{tot.spend ? `${(tot.rev / tot.spend).toFixed(2)}x` : "—"}</td>
                <td className={td}>{pct(tot.rev ? totProfit / tot.rev : null)}</td>
                <td className={td}>{pct(tot.spend ? totProfit / tot.spend : null)}</td>
                <td className={td}>{tot.ic}</td>
                <td className={td}>{usd(tot.ic ? tot.spend / tot.ic : null)}</td>
                <td className={td}>{usd(tot.clicks ? tot.spend / tot.clicks : null)}</td>
                <td className={td}>{pct(tot.imp ? tot.clicks / tot.imp : null)}</td>
                <td className={td}>{usd(tot.imp ? (tot.spend / tot.imp) * 1000 : null)}</td>
                <td className={td}>{tot.imp.toLocaleString("en-US")}</td>
                <td className={td}>{tot.clicks.toLocaleString("en-US")}</td>
                <td className={td} colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
      <p className="text-xs text-muted mt-3 md:hidden">En el celular se ven las columnas principales; abrí en una pantalla grande para ver las 22.</p>
      <p className="text-xs text-muted mt-3">Gasto, clics, impresiones, estado y presupuesto vienen de Meta; ventas e ingresos, de tus webhooks atribuidos.</p>
    </>
  );
}
