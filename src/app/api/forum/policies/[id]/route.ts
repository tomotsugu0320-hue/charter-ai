import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TENANT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PolicyProposalRow = {
  id: string;
  thread_id: string;
  tenant_slug: string | null;
  title: string;
  one_line_proposal: string | null;
  policy_area: string | null;
  priority_area: string | null;
  priority_decision: string | null;
  proposal_json: unknown;
  prompt_version: string | null;
  model: string | null;
  source_summary_updated_at: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePolicyProposal(row: PolicyProposalRow) {
  return {
    id: row.id,
    thread_id: row.thread_id,
    tenant_slug: row.tenant_slug,
    title: row.title,
    one_line_proposal: row.one_line_proposal ?? "",
    policy_area: row.policy_area ?? "unclassified",
    priority_area: row.priority_area ?? null,
    priority_decision: row.priority_decision ?? null,
    proposal_json: asRecord(row.proposal_json),
    prompt_version: row.prompt_version,
    model: row.model,
    source_summary_updated_at: row.source_summary_updated_at,
    status: row.status,
    created_at: row.created_at,
    published_at: row.published_at,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = rawId.trim();
  const tenant = request.nextUrl.searchParams.get("tenant")?.trim() ?? "";

  if (!UUID_PATTERN.test(id) || !TENANT_PATTERN.test(tenant)) {
    return NextResponse.json(
      { ok: false, error: "id or tenant is invalid." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment is not configured." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("forum_policy_proposals")
    .select(
      "id, thread_id, tenant_slug, title, one_line_proposal, policy_area, priority_area, priority_decision, proposal_json, prompt_version, model, source_summary_updated_at, status, created_at, published_at"
    )
    .eq("id", id)
    .eq("tenant_slug", tenant)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "公開済み政策提言を取得できませんでした。" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "公開済み政策提言が見つかりません。" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    policy: normalizePolicyProposal(data as PolicyProposalRow),
  });
}
