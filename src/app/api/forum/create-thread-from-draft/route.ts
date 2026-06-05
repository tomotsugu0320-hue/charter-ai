// src/app/api/forum/create-thread-from-draft/route.ts




import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumBetaLoggedIn } from "@/lib/forum-auth";

function makeSlug(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const fallback = "thread";
  const random = Math.random().toString(36).slice(2, 8);

  return `${base || fallback}-${random}`;
}

function getOrCreateAuthorKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (match?.[1]) {
    return {
      authorKey: match[1],
      shouldSetCookie: false,
    };
  }

  return {
    authorKey: "u_" + Math.random().toString(36).slice(2, 10),
    shouldSetCookie: true,
  };
}

function buildAuthorKeyCookie(authorKey: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `author_key=${encodeURIComponent(
    authorKey
  )}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}

type Conflict = {
  opinion?: string;
  rebuttal?: string;
};

const MAX_THREAD_TITLE_LENGTH = 120;
const MAX_DRAFT_CLAIM_LENGTH = 12000;
const MAX_DRAFT_TOTAL_LENGTH = 12000;
const MAX_DRAFT_ARRAY_ITEMS = 20;
const MAX_DRAFT_ITEM_LENGTH = 1000;
const MAX_DRAFT_CONFLICT_ITEM_LENGTH = 1500;

function textLength(value: unknown) {
  return String(value ?? "").trim().length;
}

function conflictTextLength(conflict: Conflict) {
  return textLength(conflict?.opinion) + textLength(conflict?.rebuttal);
}

export async function POST(req: NextRequest) {
  try {
    if (!isForumBetaLoggedIn(req)) {
      return NextResponse.json(
        { ok: false, error: "Login required." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const title = String(body?.title || "").trim();
    const claim = String(body?.claim || "").trim();
    const premises: unknown[] = Array.isArray(body?.premises) ? body.premises : [];
    const reasons: unknown[] = Array.isArray(body?.reasons) ? body.reasons : [];
    const conflicts: Conflict[] = Array.isArray(body?.conflicts) ? body.conflicts : [];
    const postType = body?.postType === "auto" ? "auto" : "human";

    if (!title || !claim) {
      return NextResponse.json(
        { success: false, error: "title and claim are required" },
        { status: 400 }
      );
    }

    if (title.length > MAX_THREAD_TITLE_LENGTH) {
      return NextResponse.json(
        { success: false, error: "タイトルは120文字以内にしてください。" },
        { status: 400 }
      );
    }

    if (claim.length > MAX_DRAFT_CLAIM_LENGTH) {
      return NextResponse.json(
        { success: false, error: "投稿候補の本文が長すぎます。短くしてから投稿してください。" },
        { status: 400 }
      );
    }

    if (
      premises.length > MAX_DRAFT_ARRAY_ITEMS ||
      reasons.length > MAX_DRAFT_ARRAY_ITEMS ||
      conflicts.length > MAX_DRAFT_ARRAY_ITEMS
    ) {
      return NextResponse.json(
        { success: false, error: "前提・根拠・反論は各20件以内にしてください。" },
        { status: 400 }
      );
    }

    if (
      premises.some((premise) => textLength(premise) > MAX_DRAFT_ITEM_LENGTH) ||
      reasons.some((reason) => textLength(reason) > MAX_DRAFT_ITEM_LENGTH)
    ) {
      return NextResponse.json(
        { success: false, error: "前提・根拠の各項目は1000文字以内にしてください。" },
        { status: 400 }
      );
    }

    if (
      conflicts.some(
        (conflict) => conflictTextLength(conflict) > MAX_DRAFT_CONFLICT_ITEM_LENGTH
      )
    ) {
      return NextResponse.json(
        { success: false, error: "反論・リスクの各項目は1500文字以内にしてください。" },
        { status: 400 }
      );
    }

    const totalDraftLength =
      title.length +
      claim.length +
      premises.reduce<number>((sum, premise) => sum + textLength(premise), 0) +
      reasons.reduce<number>((sum, reason) => sum + textLength(reason), 0) +
      conflicts.reduce<number>((sum, conflict) => sum + conflictTextLength(conflict), 0);

    if (totalDraftLength > MAX_DRAFT_TOTAL_LENGTH) {
      return NextResponse.json(
        { success: false, error: "投稿候補の内容が長すぎます。短くしてから投稿してください。" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Supabase env is missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const slug = makeSlug(title);

    const { data: existing } = await supabase
      .from("forum_threads")
      .select("id")
      .eq("title", title)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        threadId: existing.id,
      });
    }

    const { authorKey, shouldSetCookie } = getOrCreateAuthorKey(req);

    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .insert({
        title,
        slug,
        original_post: claim,
        category: null,
        ai_summary: null,
        is_deleted: false,
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { success: false, error: threadError?.message || "thread insert failed" },
        { status: 500 }
      );
    }

    const threadId = thread.id;

    const seedPosts: {
      thread_id: string;
      content: string;
      source_type: string;
      post_role: string;
      trust_status: string;
      logic_score: number;
      author_key: string;
    }[] = [
    {
      thread_id: threadId,
      content: claim,
      source_type: postType === "auto" ? "ai" : "human",
      post_role: "issue_raise",
      trust_status: "trusted",
      logic_score: 70,
      author_key: authorKey,
    },
    ];

    for (const premise of premises) {
      const text = String(premise || "").trim();
      if (!text) continue;

      seedPosts.push({
        thread_id: threadId,
        content: text,
        source_type: "ai",
        post_role: "supplement",
        trust_status: "trusted",
        logic_score: 85,
        author_key: authorKey,
      });
    }

    for (const reason of reasons) {
      const text = String(reason || "").trim();
      if (!text) continue;
      seedPosts.push({
        thread_id: threadId,
        content: `根拠: ${reason}`,
        source_type: "ai",
        post_role: "explanation",
        trust_status: "trusted",
        logic_score: 90,
        author_key: authorKey,
      });
    }


    for (const conflict of conflicts) {
      const opinion = String(conflict?.opinion || "").trim();
      const rebuttal = String(conflict?.rebuttal || "").trim();

      if (opinion) {
        seedPosts.push({
          thread_id: threadId,
          content: opinion,
          source_type: "ai",
          post_role: "opinion",
          trust_status: "trusted",
          logic_score: 75,
          author_key: authorKey,
        });
      }

      if (rebuttal) {
        seedPosts.push({
          thread_id: threadId,
          content: rebuttal,
          source_type: "ai",
          post_role: "rebuttal",
          trust_status: "trusted",
          logic_score: 95,
          author_key: authorKey,
        });
      }
    }

    const { error: postError } = await supabase
      .from("forum_posts")
      .insert(seedPosts);

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      threadId,
    });

    if (shouldSetCookie) {
      response.headers.set(
        "Set-Cookie",
        buildAuthorKeyCookie(authorKey)
      );
    }

    return response;
  } catch (e: any) {
    console.error("[create-thread-from-draft error]", e);

    return NextResponse.json(
      {
        success: false,
        error: e?.message || "unexpected error",
      },
      { status: 500 }
    );
  }
}
