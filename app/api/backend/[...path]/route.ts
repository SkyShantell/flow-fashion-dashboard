import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function upstream(path: string[], search: string) {
  const base = (process.env.RAILWAY_API_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("RAILWAY_API_BASE_URL is not configured");
  return `${base}/${path.join("/")}${search}`;
}

async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const url = upstream(path, req.nextUrl.search);
    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const apiKey = process.env.PHASE1_API_KEY || "";
    if (apiKey) headers.set("x-api-key", apiKey);

    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
    };
    if (!["GET", "HEAD"].includes(req.method)) {
      init.body = await req.arrayBuffer();
    }

    const res = await fetch(url, init);
    const body = await res.arrayBuffer();
    const outHeaders = new Headers();
    outHeaders.set("content-type", res.headers.get("content-type") || "application/json");
    return new NextResponse(body, { status: res.status, headers: outHeaders });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Backend proxy failed" },
      { status: 500 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
