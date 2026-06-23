import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TENANT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_LIMIT = 20;

type ProposalTargetRow = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
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

function normalizeLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAX_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(numeric)));
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  if (!isRecord(body) || body.confirm_publish_existing !== true) {
    return NextResponse.json(
      { ok: false, error: "confirm_publish_existing=true is required." },
      { status: 400 }
    );
  }

  const tenant = String(body.tenant ?? "").trim();
  if (!TENANT_PATTERN.test(tenant)) {
    return NextResponse.json(
      { ok: false, error: "tenant is invalid." },
      { status: 400 }
    );
  }

  const limit = normalizeLimit(body.limit);
  const { data: targets, error: targetError } = await supabase
    .from("forum_policy_proposals")
    .select("id, title, status, created_at")
    .eq("tenant_slug", tenant)
    .in("status", ["draft", "review"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (targetError) {
    return NextResponse.json(
      { ok: false, error: "未公開の政策提言を確認できませんでした。" },
      { status: 500 }
    );
  }

  const targetRows = (targets ?? []) as ProposalTargetRow[];
  if (targetRows.length === 0) {
    return NextResponse.json({
      ok: true,
      limit,
      target_count: 0,
      updated_count: 0,
      published_proposals: [],
    });
  }

  const publishedAt = new Date().toISOString();
  const targetIds = targetRows.map((proposal) => proposal.id);
  const { data: updatedProposals, error: updateError } = await supabase
    .from("forum_policy_proposals")
    .update({ status: "published", published_at: publishedAt })
    .eq("tenant_slug", tenant)
    .in("id", targetIds)
    .in("status", ["draft", "review"])
    .select("id, thread_id, title, status, published_at, created_at");

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: "未公開の政策提言を一括公開できませんでした。" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    limit,
    target_count: targetRows.length,
    updated_count: updatedProposals?.length ?? 0,
    published_proposals: updatedProposals ?? [],
  });
}
