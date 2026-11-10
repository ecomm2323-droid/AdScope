import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appUrl, metaApp, redirectUri } from "@/lib/meta";

export function GET() {
  const client_id = metaApp()?.id;
  if (!client_id) return NextResponse.redirect(new URL("/credenciales?meta=falta", appUrl()));

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.search = new URLSearchParams({
    client_id, redirect_uri: redirectUri(), scope: "ads_read,ads_management", response_type: "code", state,
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set("meta_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
