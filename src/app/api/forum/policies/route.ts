import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TENANT_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

export async function GET(request: NextRequest) {
  const tenant = request.nextUrl.searchParams.get("tenant")?.trim() ?? "";

  if (!TENANT_PATTERN.test(tenant)) {
    return NextResponse.json(
      { ok: false, error: "tenant is required." },
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
    .eq("tenant_slug", tenant)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "公開済み政策提言を取得できませんでした。" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    policies: ((data ?? []) as PolicyProposalRow[]).map(normalizePolicyProposal),
  });
}
