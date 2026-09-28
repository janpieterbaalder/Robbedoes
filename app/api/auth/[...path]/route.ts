import { getAuth, authConfigured } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!authConfigured())
    return NextResponse.json(
      { error: "Accounts zijn nog niet ingesteld." },
      { status: 503 },
    );
  return getAuth().handler().GET(req, context);
}
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!authConfigured())
    return NextResponse.json(
      { error: "Accounts zijn nog niet ingesteld." },
      { status: 503 },
    );
  return getAuth().handler().POST(req, context);
}
