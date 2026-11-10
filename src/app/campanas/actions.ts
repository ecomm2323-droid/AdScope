"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProject, q1, run } from "@/lib/db";
import { metaWrite } from "@/lib/meta";

type Ent = { level: string; status: string | null; daily_budget: number | null };

// Back to the table the user was on, with the outcome in ?err= (shown by the page).
async function edit(form: FormData, change: (e: Ent, id: string, pid: number) => Promise<void>) {
  const pid = getProject().id;
  const id = String(form.get("id") ?? "");
  const back = String(form.get("back") ?? "/campanas");
  const dest = back.startsWith("/campanas") ? back.replace(/[?&]err=[^&]*/, "") : "/campanas";
  const sep = dest.includes("?") ? "&" : "?";
  let err = "";
  try {
    const e = /^\d{1,32}$/.test(id) ? q1<Ent>("select level, status, daily_budget from meta_entity where project_id=? and id=?", pid, id) : undefined;
    if (!e) throw new Error("No encontré esa campaña. Sincronizá con Meta y probá de nuevo.");
    await change(e, id, pid);
  } catch (x) {
    err = x instanceof Error ? x.message : "Error desconocido";
  }
  revalidatePath("/campanas");
  redirect(err ? `${dest}${sep}err=${encodeURIComponent(err)}` : dest);
}

export async function setStatus(form: FormData) {
  const status = form.get("status") === "ACTIVE" ? "ACTIVE" : "PAUSED";
  await edit(form, async (_e, id, pid) => {
    await metaWrite(id, { status }, pid);
    run("update meta_entity set status=? where project_id=? and id=?", status, pid, id);
  });
}

export async function setBudget(form: FormData) {
  const amount = Number(String(form.get("budget") ?? "").replace(",", "."));
  await edit(form, async (e, id, pid) => {
    if (e.daily_budget == null) throw new Error("Este objeto no tiene presupuesto diario propio.");
    if (!(amount > 0 && amount < 1e7)) throw new Error("Presupuesto inválido.");
    await metaWrite(id, { daily_budget: String(Math.round(amount * 100)) }, pid);
    run("update meta_entity set daily_budget=? where project_id=? and id=?", Math.round(amount * 100) / 100, pid, id);
  });
}
