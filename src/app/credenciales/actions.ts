"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProject, run } from "@/lib/db";

export async function saveMetaApp(form: FormData) {
  const pid = getProject().id;
  const id = String(form.get("app_id") ?? "").trim().slice(0, 100);
  const secret = String(form.get("app_secret") ?? "").trim().slice(0, 200); // empty = keep the saved one
  if (/^\d{8,25}$/.test(id)) run("insert or replace into setting(project_id,key,value) values(?,'meta_app_id',?)", pid, id);
  else redirect("/credenciales?meta=id");
  if (secret) run("insert or replace into setting(project_id,key,value) values(?,'meta_app_secret',?)", pid, secret);
  revalidatePath("/", "layout");
  redirect("/credenciales?ok=1");
}
