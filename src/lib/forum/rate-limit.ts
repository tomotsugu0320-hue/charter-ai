import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type FilterValue = string | number | boolean | null;

export type RateLimitFilter =
  | {
      column: string;
      operator?: "eq";
      value: FilterValue;
    }
  | {
      column: string;
      operator: "in";
      value: FilterValue[];
    };

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase service role env is missing");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

export async function countRecentRows({
  table,
  filters,
  since,
}: {
  table: string;
  filters: RateLimitFilter[];
  since: Date;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());

  for (const filter of filters) {
    if (filter.operator === "in") {
      query = query.in(filter.column, filter.value);
    } else if (filter.value === null) {
      query = query.is(filter.column, null);
    } else {
      query = query.eq(filter.column, filter.value);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export function buildRateLimitResponse(message: string, retryAfterSeconds = 60) {
  const response = NextResponse.json(
    {
      success: false,
      ok: false,
      error: message,
      rateLimited: true,
    },
    { status: 429 }
  );

  response.headers.set("Retry-After", String(retryAfterSeconds));

  return response;
}

export async function assertRecentRateLimit({
  table,
  filters,
  limit,
  windowMs,
  message,
  retryAfterSeconds,
}: {
  table: string;
  filters: RateLimitFilter[];
  limit: number;
  windowMs: number;
  message: string;
  retryAfterSeconds?: number;
}) {
  const count = await countRecentRows({
    table,
    filters,
    since: new Date(Date.now() - windowMs),
  });

  if (count >= limit) {
    return buildRateLimitResponse(message, retryAfterSeconds);
  }

  return null;
}
