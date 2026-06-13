import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminKeyValid } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UsageLogRow = {
  id: string;
  created_at: string;
  feature_key: string | null;
  route_path: string | null;
  model: string | null;
  prompt_version: string | null;
  target_type: string | null;
  target_id: string | null;
  input_token_estimate: number | null;
  output_token_estimate: number | null;
  total_token_estimate: number | null;
  estimated_cost: string | number | null;
  status: string | null;
  error_message: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase environment is not configured");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

function sumToken(rows: UsageLogRow[], key: "input_token_estimate" | "output_token_estimate" | "total_token_estimate") {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function sumCost(rows: UsageLogRow[]) {
  let hasCost = false;
  const total = rows.reduce((sum, row) => {
    if (row.estimated_cost === null || row.estimated_cost === undefined) {
      return sum;
    }
    const value = Number(row.estimated_cost);
    if (!Number.isFinite(value)) {
      return sum;
    }
    hasCost = true;
    return sum + value;
  }, 0);
  return hasCost ? total : null;
}

function groupRows(rows: UsageLogRow[], key: "feature_key" | "model" | "status") {
  const grouped = new Map<
    string,
    {
      key: string;
      count: number;
      inputTokenTotal: number;
      outputTokenTotal: number;
      totalTokenTotal: number;
      estimatedCostTotal: number | null;
      costSeen: boolean;
    }
  >();

  for (const row of rows) {
    const groupKey = row[key] || "unknown";
    const current =
      grouped.get(groupKey) ??
      {
        key: groupKey,
        count: 0,
        inputTokenTotal: 0,
        outputTokenTotal: 0,
        totalTokenTotal: 0,
        estimatedCostTotal: null,
        costSeen: false,
      };

    current.count += 1;
    current.inputTokenTotal += Number(row.input_token_estimate) || 0;
    current.outputTokenTotal += Number(row.output_token_estimate) || 0;
    current.totalTokenTotal += Number(row.total_token_estimate) || 0;

    const cost = row.estimated_cost === null || row.estimated_cost === undefined
      ? Number.NaN
      : Number(row.estimated_cost);
    if (Number.isFinite(cost)) {
      current.costSeen = true;
      current.estimatedCostTotal = (current.estimatedCostTotal ?? 0) + cost;
    }

    grouped.set(groupKey, current);
  }

  return Array.from(grouped.values())
    .map(({ costSeen, ...group }) => ({
      ...group,
      estimatedCostTotal: costSeen ? group.estimatedCostTotal : null,
    }))
    .sort((a, b) => b.count - a.count);
}

async function countSince(supabase: ReturnType<typeof getSupabaseAdmin>, since: string) {
  const { count, error } = await supabase
    .from("forum_api_usage_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET(request: NextRequest) {
  if (!isForumAdminKeyValid(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfThirtyDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      todayCount,
      sevenDayCount,
      thirtyDayCount,
      logsResult,
      latestResult,
    ] = await Promise.all([
      countSince(supabase, startOfToday.toISOString()),
      countSince(supabase, startOfSevenDays.toISOString()),
      countSince(supabase, startOfThirtyDays.toISOString()),
      supabase
        .from("forum_api_usage_logs")
        .select(
          "id, created_at, feature_key, route_path, model, prompt_version, target_type, target_id, input_token_estimate, output_token_estimate, total_token_estimate, estimated_cost, status, error_message",
        )
        .gte("created_at", startOfThirtyDays.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000),
      supabase
        .from("forum_api_usage_logs")
        .select(
          "id, created_at, feature_key, route_path, model, prompt_version, target_type, target_id, input_token_estimate, output_token_estimate, total_token_estimate, estimated_cost, status, error_message",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (logsResult.error) {
      throw logsResult.error;
    }
    if (latestResult.error) {
      throw latestResult.error;
    }

    const rows = (logsResult.data ?? []) as UsageLogRow[];
    const latestLogs = (latestResult.data ?? []) as UsageLogRow[];

    return NextResponse.json({
      ok: true,
      summary: {
        todayCount,
        sevenDayCount,
        thirtyDayCount,
        inputTokenTotal: sumToken(rows, "input_token_estimate"),
        outputTokenTotal: sumToken(rows, "output_token_estimate"),
        totalTokenTotal: sumToken(rows, "total_token_estimate"),
        estimatedCostTotal: sumCost(rows),
        byFeatureKey: groupRows(rows, "feature_key"),
        byModel: groupRows(rows, "model"),
        byStatus: groupRows(rows, "status"),
      },
      latestLogs,
    });
  } catch (error) {
    console.error("[forum-admin-api-usage] Failed to load API usage logs", error);
    return NextResponse.json(
      { ok: false, error: "API使用量の取得に失敗しました" },
      { status: 500 },
    );
  }
}
