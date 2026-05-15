import { NextRequest, NextResponse } from "next/server";

export function unauthorizedGateResponse() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function isGateRequestAuthorized(request: NextRequest) {
  const expectedToken = process.env.GATE_API_TOKEN;
  const authHeader = request.headers.get("authorization");
  const headerToken = request.headers.get("x-gate-api-token");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  return Boolean(expectedToken && (bearerToken === expectedToken || headerToken === expectedToken));
}
