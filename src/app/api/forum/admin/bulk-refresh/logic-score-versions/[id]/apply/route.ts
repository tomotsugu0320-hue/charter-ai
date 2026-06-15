import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ApplyRequest = {
  confirmApply?: boolean;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const versionId = String(id ?? "").trim();

  if (!versionId) {
    return NextResponse.json({ ok: false, error: "version id is required" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ApplyRequest;
  if (body.confirmApply !== true) {
    return NextResponse.json(
      { ok: false, error: "Apply confirmation is required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role is not configured." },
      { status: 500 }
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("forum_post_logic_score_versions")
    .select(
      [
        "id",
        "post_id",
        "logic_score",
        "logic_score_reason",
        "logic_break_type",
        "logic_break_note",
        "is_applied",
      ].join(", ")
    )
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) {
    return NextResponse.json({ ok: false, error: versionError.message }, { status: 500 });
  }

  if (!version) {
    return NextResponse.json({ ok: false, error: "version not found" }, { status: 404 });
  }

  const versionRow = version as unknown as Record<string, unknown>;
  if (versionRow.is_applied === true) {
    return NextResponse.json(
      { ok: false, error: "This logic_score version has already been applied." },
      { status: 409 }
    );
  }

  const postId = asString(versionRow.post_id);
  const logicScore = toScore(versionRow.logic_score);
  const logicScoreReason = asString(versionRow.logic_score_reason);

  if (!postId) {
    return NextResponse.json({ ok: false, error: "version post_id is missing" }, { status: 400 });
  }

  if (logicScore === null || !logicScoreReason) {
    return NextResponse.json(
      { ok: false, error: "version logic_score or reason is missing" },
      { status: 400 }
    );
  }

  const { data: post, error: postError } = await supabase
    .from("forum_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    return NextResponse.json({ ok: false, error: postError.message }, { status: 500 });
  }

  if (!post) {
    return NextResponse.json({ ok: false, error: "post not found" }, { status: 404 });
  }

  const { data: updatedPost, error: updatePostError } = await supabase
    .from("forum_posts")
    .update({
      logic_score: logicScore,
      logic_score_reason: logicScoreReason,
      logic_break_type: asString(versionRow.logic_break_type) || null,
      logic_break_note: asString(versionRow.logic_break_note) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("id, logic_score, logic_score_reason, logic_break_type, logic_break_note")
    .maybeSingle();

  if (updatePostError) {
    return NextResponse.json({ ok: false, error: updatePostError.message }, { status: 500 });
  }

  if (!updatedPost) {
    return NextResponse.json({ ok: false, error: "post update failed" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: appliedVersion, error: applyError } = await supabase
    .from("forum_post_logic_score_versions")
    .update({
      is_applied: true,
      applied_at: now,
    })
    .eq("id", versionId)
    .eq("post_id", postId)
    .eq("is_applied", false)
    .select("id, post_id, is_applied, applied_at")
    .maybeSingle();

  if (applyError) {
    return NextResponse.json({ ok: false, error: applyError.message }, { status: 500 });
  }

  if (!appliedVersion) {
    return NextResponse.json(
      { ok: false, error: "This logic_score version has already been applied." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    version: appliedVersion,
    post: updatedPost,
  });
}
