"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProject, q1, run } from "@/lib/db";

// Manual fix when the platform shows the order as paid but its approved webhook never arrived. Only pending -> approved.
export async function markApproved(form: FormData) {
  const order = String(form.get("order") ?? "").trim().slice(0, 100);
  const back = String(form.get("back") ?? "/ventas");
  run("update conversion set status='approved', updated_at=? where project_id=? and order_id=? and status='pending'", Date.now(), getProject().id, order);
  revalidatePath("/", "layout");
  redirect(back.startsWith("/ventas") ? back : "/ventas");
}

// Manually pins a sale to an ad (both attribution models). Webhook retries never overwrite it (see needsReattribution).
export async function forceAttribution(form: FormData) {
  const pid = getProject().id;
  const order = String(form.get("order") ?? "").trim().slice(0, 100);
  const adId = String(form.get("ad") ?? "");
  const back = String(form.get("back") ?? "/ventas");
  const dest = back.startsWith("/ventas") ? back.replace(/[?&]o=[^&]*|[?&]err=[^&]*/g, "") : "/ventas";
  const sep = dest.includes("?") ? "&" : "?";
  const conv = order ? q1<{ id: number }>("select id from conversion where project_id=? and order_id=?", pid, order) : undefined;
  const ad = /^\d{1,32}$/.test(adId)
    ? q1<{ ad_id: string; ad_name: string | null; adset_id: string | null; adset_name: string | null; campaign_id: string | null; campaign_name: string | null }>(
        "select ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name from meta_ad_day where project_id=? and ad_id=? order by date desc limit 1",
        pid, adId,
      )
    : undefined;
  if (!conv || !ad) redirect(`${dest}${sep}err=${encodeURIComponent(!conv ? "No encontré ese pedido." : "Elegí un anuncio de la lista.")}`);
  for (const model of ["first_touch", "last_touch"]) {
    run(
      `insert or replace into attribution(project_id, conversion_id, model, touch_id, channel, source, medium, campaign, adset_name, ad_name, ca_id, as_id, ad_id, confidence)
       values(?,?,?,null,'meta','facebook','paid',?,?,?,?,?,?,'manual')`,
      pid, conv.id, model, ad.campaign_name, ad.adset_name, ad.ad_name, ad.campaign_id, ad.adset_id, ad.ad_id,
    );
  }
  revalidatePath("/", "layout");
  redirect(dest);
}
