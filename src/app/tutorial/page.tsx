import Link from "next/link";
import { headers } from "next/headers";
import { getProject, q1 } from "@/lib/db";
import { tokenDaysLeft, metaApp } from "@/lib/meta";
import { Card } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Tutorial" };
export const dynamic = "force-dynamic";

const UTMS =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}";

const link = "underline text-accent";

// Public Railway template (one-click deploy).
const RAILWAY_TEMPLATE = "https://railway.com/deploy/adscope";

function Code({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start my-2">
      <pre className="flex-1 bg-bg border border-line rounded p-3 font-mono text-xs whitespace-pre-wrap break-all">{text}</pre>
      <CopyButton text={text} />
    </div>
  );
}

// Which tool the step happens in. Own = this app; the rest are external sites.
const TOOLS = {
  app: ["Esta app", "bg-accent text-on-accent"],
  meta: ["developers.facebook.com", "bg-white/10 text-white"],
  ads: ["Administrador de anuncios", "bg-white/10 text-white"],
  imp: ["Impultienda", "bg-white/10 text-white"],
  web: ["Tu landing / checkout", "bg-white/10 text-white"],
  host: ["Railway", "bg-white/10 text-white"],
} as const;

function Tool({ t }: { t: keyof typeof TOOLS }) {
  const [label, cls] = TOOLS[t];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mr-2 align-middle ${cls}`}>{label}</span>;
}

// Screenshot with highlight boxes; marks are percentages of the image. tall = long capture, scrolls inside the card.
function Shot({ src, alt, marks, tall }: { src: string; alt: string; marks: { x: number; y: number; w: number; h: number; label?: string }[]; tall?: boolean }) {
  return (
    <div className={`relative mt-2 rounded-xl border border-line overflow-hidden ${tall ? "max-h-[32rem] overflow-y-auto" : ""}`}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="block w-full h-auto" />
        {marks.map((m, i) => (
          <span key={i} className="absolute rounded-md border-2 border-accent" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}>
            {m.label && <span className="absolute -top-5 left-0 rounded bg-accent px-1.5 text-[11px] font-medium text-on-accent whitespace-nowrap">{m.label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-3 [&_li]:pl-1 [&_b]:text-white">{children}</ol>;
}

// "Lo que tenés que ver" / "Si no" boxes closing each section.
function Check({ ok, fix }: { ok: string; fix: string }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
      <p className="rounded-xl border border-good/30 bg-good/5 p-3"><b className="text-good">Tenés que ver:</b> <span className="text-muted">{ok}</span></p>
      <p className="rounded-xl border border-warn/30 bg-warn/5 p-3"><b className="text-warn">Si no lo ves:</b> <span className="text-muted">{fix}</span></p>
    </div>
  );
}

const GLOSS: [string, string][] = [
  ["Pixel (script de seguimiento)", "Un pedacito de código que pegás en tu página. Anota de qué anuncio llegó cada visitante, como un portero que apunta de dónde viene cada persona."],
  ["Webhook", "Un aviso automático. Cuando Impultienda cobra una venta, le manda un mensaje a esta herramienta con el monto y el producto. Vos pegás una dirección (URL) y listo."],
  ["UTM", "Etiquetas al final del link de tu anuncio (utm_campaign=…). Dicen de qué campaña, conjunto y anuncio vino el clic."],
  ["Atribución", "Unir una venta con el anuncio que la trajo. Sin UTM ni pixel, la venta entra como “Sin atribución”."],
  ["ID de cuenta publicitaria", "El número de tu cuenta de anuncios de Meta. Empieza con act_ o es solo un número."],
  ["Token", "Una llave que Meta le da a esta herramienta para leer tus gastos. Dura unos 60 días y se renueva sola mientras la herramienta siga funcionando."],
];

const count = (sql: string, pid: number) => q1<{ n: number }>(sql, pid)?.n ?? 0;

export default async function Tutorial() {
  const project = getProject();
  const pid = project.id;
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const hook = q1<{ token: string }>("select token from webhook where project_id=? and platform='impultienda' order by id limit 1", pid);
  const hookUrl = hook ? `${base}/api/webhooks/impultienda?token=${hook.token}` : null;
  const pixel = `<script async src="${base}/tracker.js" data-key="${project.public_key}" data-decorate="TU-CHECKOUT.impultienda.com"></script>`;

  const steps: { id: string; label: string; ok: boolean }[] = [
    { id: "sr", label: "Publicada en Railway (APP_URL y APP_PASSWORD)", ok: !!process.env.APP_URL && !!process.env.APP_PASSWORD },
    { id: "s0", label: "App ID y Secret de Meta cargados (Credenciales)", ok: !!metaApp(pid) },
    { id: "s1", label: "Meta conectado (token vigente)", ok: tokenDaysLeft(pid) !== undefined || !!process.env.META_ACCESS_TOKEN },
    { id: "s1", label: "Dashboard con tu cuenta publicitaria", ok: count("select count(*) n from dashboard where project_id=?", pid) > 0 },
    { id: "s1", label: "Gasto de Meta sincronizado", ok: count("select count(*) n from meta_ad_day where project_id=?", pid) > 0 },
    { id: "s2", label: "Webhook de Impultienda creado", ok: !!hook },
    { id: "s2", label: "Llegó al menos una venta o aviso OK", ok: count("select count(*) n from webhook_log where project_id=? and ok=1", pid) > 0 },
    { id: "s3", label: "El pixel registró al menos un clic", ok: count("select count(*) n from touch where project_id=?", pid) > 0 },
    { id: "s4", label: "Cotización del dólar cargada", ok: count("select count(*) n from setting where project_id=? and key='usd_rate'", pid) > 0 },
  ];
  const done = steps.filter((s) => s.ok).length;

  return (
    <>
      <h1>Tutorial de conexión</h1>
      <p className="text-muted mb-4">
        Seis pasos, en este orden. Cada paso dice en qué herramienta se hace con una etiqueta:{" "}
        <Tool t="app" /><Tool t="meta" /><Tool t="ads" /><Tool t="imp" /><Tool t="web" /><Tool t="host" />
        Tarda unos 30 minutos la primera vez.
      </p>

      <div className="space-y-3 max-w-3xl">
        <Card title={`Tu progreso · ${done} de ${steps.length}`}>
          <div className="h-1.5 rounded bg-line mb-4"><div className="h-1.5 rounded bg-accent" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
          <ul className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.label} className="flex gap-2">
                <span aria-hidden className={s.ok ? "text-good" : "text-muted"}>{s.ok ? "✓" : "○"}</span>
                <a href={`#${s.id}`} className={s.ok ? "text-muted line-through" : "hover:text-accent"}>{s.label}</a>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Palabras que vas a ver">
          <dl className="space-y-2">
            {GLOSS.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-white">{t}</dt>
                <dd className="text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div id="sr" className="scroll-mt-20">
          <Card title="0 · Publicar esta herramienta en Railway (primero que todo)">
            <p className="text-muted mb-3">
              Railway es el servidor donde vive la herramienta, prendida 24 horas. Lo hacemos primero porque necesitás la dirección pública (URL) que te da para los pasos de Meta e Impultienda. Plan Hobby, unos 5 USD por mes.
            </p>
            <Steps>
              <li><Tool t="host" />Tocá el botón <b>Desplegar en Railway</b>{RAILWAY_TEMPLATE ? <> <a href={RAILWAY_TEMPLATE} target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent no-underline">Desplegar en Railway</a></> : " (el link te lo pasa quien te vendió la herramienta)"}. Creá la cuenta si no tenés (plan Hobby, unos 5 USD por mes).</li>
              <li><Tool t="host" />Completá <code>APP_PASSWORD</code> con una contraseña larga que inventes (es la que vas a usar para entrar). <b>No toques</b> <code>META_APP_ID</code> ni <code>META_APP_SECRET</code>: dejalos en <code>pendiente</code>, los cargás después dentro de la herramienta. Tocá <b>Deploy</b> y esperá a que termine.</li>
              <li><Tool t="host" />Abrí el servicio → <b>Settings → Networking</b>: ahí está tu URL pública (algo como <code>https://xxx.up.railway.app</code>). Abrila: tiene que pedirte la contraseña. Entrá con ella.</li>
            </Steps>
            <Check
              ok="la pantalla de login con tu URL de Railway, y al entrar ves el Resumen."
              fix="si dice “Falta la variable APP_PASSWORD”, no se guardó: revisá Variables en Railway y esperá el redeploy. Si no abre, mirá Deployments → View logs."
            />
          </Card>
        </div>

        <div id="s0" className="scroll-mt-20">
          <Card title="1 · Crear tu propia app de Meta (una sola vez)">
            <p className="text-muted mb-3">
              Anotá el App ID y el App Secret en un bloc de notas cuando los veas: los vas a pegar en la herramienta al final. Meta exige que cada persona use su propia “app” para dar permiso de lectura y de edición (pausar campañas y cambiar presupuestos). No es una app que se publica: queda en modo desarrollo, solo para vos, y no pide verificación de empresa.
            </p>
            <Steps>
              <li>
                <Tool t="meta" />Entrá a <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className={link}>developers.facebook.com/apps</a> con tu Facebook y tocá <b>Crear aplicación</b> (botón verde, arriba a la derecha).
                <Shot src="/tutorial/meta-1-apps.png" alt="Lista de aplicaciones de Meta for Developers" marks={[{ x: 74.3, y: 6.1, w: 5.3, h: 2.8, label: "Crear aplicación" }]} />
              </li>
              <li>
                <Tool t="meta" />Paso <b>Detalles de la aplicación</b>: poné el nombre que quieras y tu email de contacto. Tocá <b>Siguiente</b>.
                <Shot src="/tutorial/meta-2-detalles.png" alt="Crear una aplicación: nombre y correo" marks={[
                  { x: 31, y: 21, w: 38, h: 2.8, label: "Nombre" },
                  { x: 31, y: 30.6, w: 38, h: 2.8, label: "Tu email" },
                  { x: 65.3, y: 34.3, w: 3.7, h: 2.8 },
                ]} />
              </li>
              <li>
                <Tool t="meta" />Paso <b>Casos de uso</b>: marcá <b>Mide los datos de rendimiento de tus anuncios con la API de marketing</b> y tocá <b>Siguiente</b> (abajo, en la misma pantalla). Solo te deja marcar uno: está bien, el “Inicio de sesión con Facebook” se agrega solo después.
                <Shot tall src="/tutorial/meta-3-casos.png" alt="Añadir casos de uso" marks={[
                  { x: 42.2, y: 14.5, w: 26.7, h: 4.3, label: "Marcá este" },
                  { x: 65.3, y: 97, w: 3.8, h: 1.5 },
                ]} />
              </li>
              <li>
                <Tool t="meta" />Paso <b>Empresa</b>: elegí <b>Aún no quiero conectar un portfolio empresarial</b> y <b>Siguiente</b>.
                <Shot src="/tutorial/meta-4-empresa.png" alt="Paso Empresa" marks={[
                  { x: 30.9, y: 33.7, w: 14, h: 2.1 },
                  { x: 65.3, y: 40, w: 3.7, h: 2.8 },
                ]} />
              </li>
              <li>
                <Tool t="meta" />Paso <b>Requisitos</b>: dice “No se han identificado requisitos”. Tocá <b>Siguiente</b>.
                <Shot src="/tutorial/meta-5-requisitos.png" alt="Paso Requisitos" marks={[{ x: 65.3, y: 28.9, w: 3.7, h: 2.7 }]} />
              </li>
              <li>
                <Tool t="meta" />Paso <b>Información general</b>: revisá el resumen y tocá <b>Crear aplicación</b>.
                <Shot src="/tutorial/meta-6-resumen.png" alt="Resumen antes de crear la app" marks={[{ x: 63.7, y: 62, w: 5.3, h: 2.8, label: "Crear aplicación" }]} />
              </li>
              <li>
                <Tool t="meta" />Ya en el <b>Panel</b> de tu app (dice <b>Sin publicar</b>: perfecto, es lo que queremos), en el menú de la izquierda tocá <b>Inicio de sesión con Facebook → Configuración</b>.
                <Shot src="/tutorial/meta-7-panel.png" alt="Panel de la app" marks={[{ x: 0.3, y: 20.6, w: 11.1, h: 6, label: "Acá" }]} />
              </li>
              <li>
                <Tool t="meta" />En <b>URI de redireccionamiento de OAuth válidos</b> pegá esta dirección y tocá <b>Guardar cambios</b>:
                <Code text={`${base}/api/meta/callback`} />
                <Shot src="/tutorial/meta-8-oauth.png" alt="Configuración del cliente de OAuth" marks={[
                  { x: 31.5, y: 40.9, w: 48.7, h: 2.1, label: "Pegá la URI" },
                  { x: 75.3, y: 81.9, w: 5.6, h: 2.4 },
                ]} />
              </li>
              <li><Tool t="meta" />Dejá la app en <b>modo Desarrollo</b> (no la pases a “Live”). Con tu propia cuenta como administrador alcanza.</li>
              <li><Tool t="meta" />En <b>Configuración de la aplicación → Básica</b> (menú de la izquierda, abajo) copiá el <b>Identificador de la aplicación</b> y la <b>Clave secreta</b> (tocá <b>Mostrar</b>; Facebook te pide tu contraseña).</li>
              <li><Tool t="app" />Volvé a esta herramienta → <Link href="/credenciales" className={link}>Credenciales</Link> → <b>Tu app de Meta</b>: pegá el App ID y el App Secret y tocá <b>Guardar app de Meta</b>.</li>
            </Steps>
            <Check
              ok="el ítem «App ID y Secret de Meta cargados» de tu progreso (arriba) queda en ✓."
              fix="si Meta dice “redirect_uri no coincide” al conectar, la URI del paso 3 no es idéntica a la de APP_URL (revisá https, barras y mayúsculas)."
            />
          </Card>
        </div>

        <div id="s1" className="scroll-mt-20">
          <Card title="2 · Conectar Meta (para traer los gastos)">
            <Steps>
              <li><Tool t="app" />Andá a <Link href="/credenciales" className={link}>Credenciales</Link> y tocá <b>Conectar / reconectar con Meta</b>.</li>
              <li><Tool t="meta" />Se abre Facebook. Entrá con la cuenta que administra tus anuncios y aceptá los permisos (pide <i>leer</i> anuncios y <i>editarlos</i>: solo pausa/activa campañas y cambia presupuestos cuando vos lo pedís; no crea anuncios).</li>
              <li><Tool t="app" />Volvés a esta herramienta. En <Link href="/credenciales" className={link}>Credenciales</Link>, junto al botón, tiene que decir <b>token vigente</b>.</li>
              <li>
                <Tool t="ads" />Entrá a <a href="https://adsmanager.facebook.com" target="_blank" rel="noreferrer" className={link}>adsmanager.facebook.com</a> y elegí tu cuenta. Fijate en la barra de direcciones del navegador: aparece <code>act=1234567890</code>. Ese número es el <b>ID de tu cuenta publicitaria</b>. Copialo.
              </li>
              <li><Tool t="app" />Andá a <Link href="/dashboards" className={link}>Dashboards</Link>, escribí un nombre, pegá el ID y tocá <b>Crear</b>.</li>
              <li><Tool t="app" />En <Link href="/" className={link}>Resumen</Link> tocá <b>Sincronizar Meta</b>.</li>
            </Steps>
            <Check
              ok="en la pestaña Meta aparecen tus campañas con su gasto."
              fix="elegí “30 días” arriba (si hoy no gastaste, “Hoy” sale vacío); revisá que el ID sea el de la cuenta correcta; si dice “token vencido”, reconectá desde Ajustes."
            />
            <p className="text-xs text-muted mt-3">
              Opcional: si no querés reconectar cada 60 días, creá un token de “usuario del sistema” en el Administrador comercial de Meta y guardalo en Railway como <code>META_ACCESS_TOKEN</code>. Es avanzado: el flujo normal alcanza.
            </p>
          </Card>
        </div>

        <div id="s2" className="scroll-mt-20">
          <Card title="3 · Conectar Impultienda (para traer las ventas)">
            <Steps>
              <li>
                <Tool t="app" />Andá a <Link href="/integraciones?tab=webhooks" className={link}>Integraciones → Webhooks</Link>, elegí <b>impultienda</b> y tocá <b>Agregar webhook</b>. Te da una dirección (URL) personal.
                {hookUrl ? <Code text={hookUrl} /> : <span className="block text-muted text-xs mt-1">(Todavía no creaste uno: al crearlo, la URL aparece ahí y la copiás con el botón.)</span>}
              </li>
              <li><Tool t="imp" /><b>Configuraciones → Webhooks → Agregar endpoint</b> (requiere el plan Max).</li>
              <li><Tool t="imp" />Pegá la URL del paso 1.</li>
              <li><Tool t="imp" />Marcá estos eventos: <code>order.created</code>, <code>order.approved</code>, <code>order.refunded</code>, <code>order.chargeback</code>, <code>order.rejected</code>. Guardá.</li>
              <li><Tool t="imp" />Hacé una compra de prueba (o esperá una real).</li>
            </Steps>
            <Check
              ok="en Integraciones → Pruebas aparece una línea verde OK, y la venta se ve en Resumen a los pocos segundos."
              fix="la URL tiene que ser pública (la de Railway), no “localhost”; revisá que el token de la URL esté completo y que marcaste los eventos."
            />
            <p className="text-xs text-muted mt-3">
              <Link href="/integraciones?tab=pruebas" className={link}>Ir a Pruebas</Link>
            </p>
          </Card>
        </div>

        <div id="s3" className="scroll-mt-20">
          <Card title="4 · Pixel y UTMs (para saber de qué anuncio vino cada venta)">
            <p className="text-muted mb-2">Sin esto las ventas se cuentan igual, pero como “Sin atribución”. Son dos cosas:</p>
            <Steps>
              <li>
                <Tool t="web" /><b>Pegar el pixel</b> en el <code>&lt;head&gt;</code> de tu landing y de tu checkout. Cambiá <code>TU-CHECKOUT.impultienda.com</code> por el dominio de tu checkout, así la venta no pierde el anuncio al cambiar de página:
                <Code text={pixel} />
              </li>
              <li>
                <Tool t="ads" /><b>Poner los UTMs en tus anuncios</b>: editá el anuncio (nivel <i>anuncio</i>, no campaña), bajá a la sección <b>Seguimiento</b> y, en <b>Parámetros de URL</b>, pegá esto:
                <Code text={UTMS} />
                Meta reemplaza solo las partes entre llaves por el nombre y el ID reales. Hacelo en todos los anuncios activos; los nuevos se pueden duplicar de uno que ya lo tenga.
              </li>
              <li><Tool t="ads" />Abrí uno de tus anuncios (botón <i>Ver vista previa</i> → link) o hacé clic en uno real.</li>
            </Steps>
            <Check
              ok="en Integraciones → Pruebas → Últimos clics aparece el clic con su campaña."
              fix="el clic sale sin campaña si faltan los UTMs en ese anuncio; no sale nada si el pixel no está en el <head> de esa página."
            />
            <p className="text-xs text-muted mt-3">
              También podés armar los UTMs a mano en <Link href="/utms" className={link}>UTMs</Link>.
            </p>
          </Card>
        </div>

        <div id="s4" className="scroll-mt-20">
          <Card title="5 · Dólar y costos (para que el ROAS y la ganancia estén bien)">
            <Steps>
              <li><Tool t="app" />En <Link href="/ajustes" className={link}>Ajustes</Link> cargá la cotización: <b>1 USD = cuántos pesos</b>. Las ventas llegan en pesos y el gasto de Meta en dólares; sin esto el panel mezcla monedas.</li>
              <li><Tool t="app" />En la misma pantalla, por cada producto, cargá <b>cuánto te queda tras impuestos</b>. Así la ganancia es real y no solo facturación.</li>
            </Steps>
            <Check
              ok="el Resumen muestra ganancia y ROAS con números razonables."
              fix="si el ROAS es altísimo o ridículo, casi seguro falta la cotización o el costo de ese producto."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
