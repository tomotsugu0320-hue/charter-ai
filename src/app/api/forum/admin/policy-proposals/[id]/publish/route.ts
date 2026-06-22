import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PUBLISHABLE_STATUSES = new Set(["draft", "review"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment is not configured." },
      { status: 500 }
    );
  }

  const { id: rawId } = await context.params;
  const id = rawId.trim();
  const body = await request.json().catch(() => null);
  const tenant = isRecord(body) ? String(body.tenant ?? "").trim() : "";

  if (!UUID_PATTERN.test(id) || !TENANT_PATTERN.test(tenant)) {
    return NextResponse.json(
      { ok: false, error: "id or tenant is invalid." },
      { status: 400 }
    );
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("forum_policy_proposals")
    .select("id, tenant_slug, status")
    .eq("id", id)
    .eq("tenant_slug", tenant)
    .maybeSingle();

  if (proposalError) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補を確認できませんでした。" },
      { status: 500 }
    );
  }

  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補が見つかりません。" },
      { status: 404 }
    );
  }

  if (!PUBLISHABLE_STATUSES.has(proposal.status)) {
    return NextResponse.json(
      { ok: false, error: "draft または review の政策提言候補だけを公開できます。" },
      { status: 409 }
    );
  }

  const publishedAt = new Date().toISOString();
  const { data: publishedProposal, error: publishError } = await supabase
    .from("forum_policy_proposals")
    .update({ status: "published", published_at: publishedAt })
    .eq("id", id)
    .eq("tenant_slug", tenant)
    .eq("status", proposal.status)
    .select(
      "id, thread_id, tenant_slug, title, one_line_proposal, policy_area, priority_area, priority_decision, proposal_json, prompt_version, model, source_summary_updated_at, status, content_hash, created_by_admin, created_at, published_at"
    )
    .maybeSingle();

  if (publishError) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補を公開できませんでした。" },
      { status: 500 }
    );
  }

  if (!publishedProposal) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補の状態が変更されたため、公開できませんでした。" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    policy_proposal: publishedProposal,
  });
}
