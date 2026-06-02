import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { success: false, error: "thread detail route is no longer available" },
    { status: 404 }
  );
}
