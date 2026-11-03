"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProject, run } from "@/lib/db";

export async function savePricing(form: FormData) {
  const pid = getProject().id;
  const rate = Number(String(form.get("rate") ?? "").replace(",", "."));
  if (rate > 0 && rate < 1e6) run("insert or replace into setting(project_id,key,value) values(?,'usd_rate',?)", pid, String(rate));
  const tax = Number(String(form.get("tax") ?? "").replace(",", "."));
  if (tax > 0 && tax < 100) run("insert or replace into setting(project_id,key,value) values(?,'tax_pct',?)", pid, String(tax));
  else run("delete from setting where project_id=? and key='tax_pct'", pid);
  const since =/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(form.get("since") ?? ""));
  if (since) run("insert or replace into setting(project_id,key,value) values(?,'sales_since',?)", pid, String(new Date(+since[1], +since[2] - 1, +since[3]).getTime()));
  else run("delete from setting where project_id=? and key='sales_since'", pid);
  // product_<i> / net_<i> / price_<i> triples; an empty net clears the product back to its sale price, an empty price to the order's own.
  for (const [k, v] of form.entries()) {
    const m = /^product_(\d+)$/.exec(k);
    if (!m) continue;
    const product = String(v).slice(0, 200);
    const price = Number(String(form.get(`price_${m[1]}`) ?? "").replace(",", "."));
    if (price > 0 && price < 1e12) run("insert or replace into setting(project_id,key,value) values(?,?,?)", pid, `price:${product}`, String(price));
    else run("delete from setting where project_id=? and key=?", pid, `price:${product}`);
    const net = Number(String(form.get(`net_${m[1]}`) ?? "").replace(",", "."));
    if (net > 0 && net < 1e12) run("insert or replace into product_net(project_id,product,net_ars) values(?,?,?)", pid, product, net);
    else run("delete from product_net where project_id=? and product=?", pid, product);
  }
  revalidatePath("/", "layout");
  redirect("/ajustes?ok=1");
}
