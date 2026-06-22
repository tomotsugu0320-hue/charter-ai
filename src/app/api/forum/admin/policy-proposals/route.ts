import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL = "gpt-5.4-mini";
const PROMPT_VERSION = "policy_proposal_preview_v2";
const SUMMARY_TYPE = "thread_summary_from_classifications";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function asStringArray(value: unknown, maxItems = 12, maxLength = 800) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => asString(item, maxLength))
        .filter(Boolean)
    )
  ).slice(0, maxItems);
}

function normalizePolicyGroup(value: unknown) {
  const group = isRecord(value) ? value : {};
  return {
    summary: asString(group.summary, 1200),
    proposal_items: asStringArray(group.proposal_items, 5),
    merits: asStringArray(group.merits, 5),
    demerits: asStringArray(group.demerits, 5),
    countermeasures: asStringArray(group.countermeasures, 5),
  };
}

function normalizeReferenceThreads(value: unknown, tenant: string) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const threadId = asString(item.thread_id, 80);
    if (!UUID_PATTERN.test(threadId) || seen.has(threadId)) return [];
    seen.add(threadId);
    return [{
      thread_id: threadId,
      title: asString(item.title, 240) || "掲示板スレッド",
      url: `/${tenant}/forum/thread/${threadId}`,
    }];
  }).slice(0, 5);
}

function normalizePreview(value: unknown, tenant: string) {
  if (!isRecord(value)) return null;

  const priority = isRecord(value.priority_judgment) ? value.priority_judgment : {};
  const decisions = ["prioritize", "conditional", "do_not_prioritize", "insufficient"];
  const priorityAreas = ["fiscal", "monetary", "other", "combined", "hold", "insufficient"];
  const decision = decisions.includes(String(priority.decision))
    ? String(priority.decision)
    : "insufficient";
  const priorityArea = priorityAreas.includes(String(priority.priority_area))
    ? String(priority.priority_area)
    : "insufficient";
  const groupsRecord = isRecord(value.policy_groups) ? value.policy_groups : null;
  const policyGroups = groupsRecord
    ? {
        fiscal_policy: normalizePolicyGroup(groupsRecord.fiscal_policy),
        monetary_policy: normalizePolicyGroup(groupsRecord.monetary_policy),
        other_policy: normalizePolicyGroup(groupsRecord.other_policy),
      }
    : null;
  const groupValues = policyGroups ? Object.values(policyGroups) : [];
  const mergeGroupItems = (
    key: "proposal_items" | "merits" | "demerits" | "countermeasures"
  ) => Array.from(new Set(groupValues.flatMap((group) => group[key]))).slice(0, 12);
  const title = asString(value.title, 240);

  if (!title) return null;

  return {
    title,
    one_line_proposal: asString(value.one_line_proposal, 500),
    ...(policyGroups ? { policy_groups: policyGroups } : {}),
    proposal_items: policyGroups
      ? mergeGroupItems("proposal_items")
      : asStringArray(value.proposal_items),
    merits: policyGroups ? mergeGroupItems("merits") : asStringArray(value.merits),
    demerits: policyGroups ? mergeGroupItems("demerits") : asStringArray(value.demerits),
    countermeasures: policyGroups
      ? mergeGroupItems("countermeasures")
      : asStringArray(value.countermeasures),
    opposing_views: asStringArray(value.opposing_views, 5),
    priority_judgment: {
      decision,
      priority_area: priorityArea,
      label: asString(priority.label, 120) || "判断材料不足",
      reasons: asStringArray(priority.reasons, 5),
    },
    verification_metrics: asStringArray(value.verification_metrics, 6),
    review_conditions: asStringArray(value.review_conditions, 5),
    economic_phase: asString(value.economic_phase, 800),
    demand_balance: asString(value.demand_balance, 800),
    inflation_causes: asStringArray(value.inflation_causes, 5),
    monetary_policy_role: asString(value.monetary_policy_role, 800),
    fiscal_policy_role: asString(value.fiscal_policy_role, 800),
    missing_information: asStringArray(value.missing_information, 12),
    reference_threads: normalizeReferenceThreads(value.reference_threads, tenant),
  };
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
  if (!isRecord(body) || body.confirm_save !== true) {
    return NextResponse.json(
      { ok: false, error: "confirm_save=true is required." },
      { status: 400 }
    );
  }

  const threadId = asString(body.thread_id, 80);
  const tenantInput = asString(body.tenant, 80);
  const tenant = /^[a-zA-Z0-9_-]+$/.test(tenantInput) ? tenantInput : "";
  if (!UUID_PATTERN.test(threadId) || !tenant) {
    return NextResponse.json(
      { ok: false, error: "thread_id or tenant is invalid." },
      { status: 400 }
    );
  }

  const preview = normalizePreview(body.preview, tenant);
  if (!preview) {
    return NextResponse.json(
      { ok: false, error: "保存する政策提言プレビューが不正です。" },
      { status: 400 }
    );
  }

  const [{ data: thread, error: threadError }, { data: structure, error: structureError }] =
    await Promise.all([
      supabase
        .from("forum_threads")
        .select("id")
        .eq("id", threadId)
        .eq("is_deleted", false)
        .maybeSingle(),
      supabase
        .from("thread_ai_structures")
        .select("updated_at")
        .eq("thread_id", threadId)
        .eq("summary_type", SUMMARY_TYPE)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  if (threadError || structureError) {
    return NextResponse.json(
      { ok: false, error: "保存対象のスレッド情報を確認できませんでした。" },
      { status: 500 }
    );
  }
  if (!thread || !structure) {
    return NextResponse.json(
      { ok: false, error: "保存対象の政策提言候補が見つかりません。" },
      { status: 404 }
    );
  }

  const serializedPreview = JSON.stringify(preview);
  const contentHash = createHash("sha256").update(serializedPreview).digest("hex");
  const { data: existing, error: existingError } = await supabase
    .from("forum_policy_proposals")
    .select("id, status, created_at")
    .eq("thread_id", threadId)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { ok: false, error: "保存済み政策提言を確認できませんでした。" },
      { status: 500 }
    );
  }
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      saved_proposal: existing,
    });
  }

  const priorityArea = preview.priority_judgment.priority_area;
  const policyArea = ["fiscal", "monetary", "other", "combined"].includes(priorityArea)
    ? priorityArea
    : "unclassified";
  const { data: savedProposal, error: insertError } = await supabase
    .from("forum_policy_proposals")
    .insert({
      thread_id: threadId,
      tenant_slug: tenant,
      title: preview.title,
      one_line_proposal: preview.one_line_proposal || null,
      policy_area: policyArea,
      priority_area: priorityArea,
      priority_decision: preview.priority_judgment.decision,
      proposal_json: preview,
      prompt_version: PROMPT_VERSION,
      model: MODEL,
      source_summary_updated_at: structure.updated_at,
      status: "draft",
      content_hash: contentHash,
      created_by_admin: null,
    })
    .select("id, status, created_at")
    .single();

  if (insertError || !savedProposal) {
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "同じ内容はすでに保存されています。" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "政策提言候補を保存できませんでした。" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: false,
    saved_proposal: savedProposal,
  });
}
