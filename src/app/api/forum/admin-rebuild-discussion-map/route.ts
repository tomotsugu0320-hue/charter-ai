import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_THREADS = 100;
const MAX_POSTS = 300;
const MAX_TITLE_LENGTH = 160;
const MAX_THREAD_TEXT_LENGTH = 800;
const MAX_POST_CONTENT_LENGTH = 500;
const MAX_POSTS_PER_THREAD = 5;

const EXISTING_NODES = [
  { id: "consumption-tax", label: "消費税" },
  { id: "tax-social-insurance", label: "税金・社会保険料" },
  { id: "demand-shortage", label: "需要不足" },
  { id: "tax-cuts", label: "減税" },
  { id: "fiscal-policy", label: "財政政策" },
  { id: "inflation", label: "物価・インフレ" },
  { id: "funding-source", label: "財源" },
  { id: "funding-inflation", label: "財源・インフレ" },
  { id: "employment-wages-impact", label: "雇用・賃金への影響" },
  { id: "abenomics", label: "アベノミクス" },
];

type ThreadRow = {
  id: string;
  title: string | null;
  category: string | null;
  original_post: string | null;
  ai_summary: string | null;
  created_at: string | null;
};

type PostRow = {
  thread_id: string;
  content: string | null;
  post_role: string | null;
  logic_score: number | null;
  created_at: string | null;
};

type PreviewJson = {
  root?: unknown;
  nodes?: unknown;
  existing_node_matches?: unknown;
  new_node_candidates?: unknown;
  merge_candidates?: unknown;
  warnings?: unknown;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

function compactText(value: unknown, maxLength: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function extractOutputText(json: any) {
  return json?.output_text ?? json?.output?.[0]?.content?.[0]?.text ?? "";
}

function normalizePreviewJson(value: PreviewJson) {
  return {
    root:
      value.root && typeof value.root === "object"
        ? value.root
        : {
            id: "japan-economy",
            label: "日本経済",
            summary: "",
          },
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    existing_node_matches: Array.isArray(value.existing_node_matches)
      ? value.existing_node_matches
      : [],
    new_node_candidates: Array.isArray(value.new_node_candidates)
      ? value.new_node_candidates
      : [],
    merge_candidates: Array.isArray(value.merge_candidates)
      ? value.merge_candidates
      : [],
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
  };
}

export async function POST(req: Request) {
  if (req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  try {
    const { data: threads, error: threadsError } = await supabase
      .from("forum_threads")
      .select("id, title, category, original_post, ai_summary, created_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(MAX_THREADS);

    if (threadsError) {
      return NextResponse.json(
        { success: false, error: threadsError.message },
        { status: 500 }
      );
    }

    const visibleThreads = (threads ?? []) as ThreadRow[];
    const threadIds = visibleThreads.map((thread) => thread.id);
    let posts: PostRow[] = [];

    if (threadIds.length > 0) {
      const { data: postRows, error: postsError } = await supabase
        .from("forum_posts")
        .select("thread_id, content, post_role, logic_score, created_at")
        .eq("is_deleted", false)
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(MAX_POSTS);

      if (postsError) {
        return NextResponse.json(
          { success: false, error: postsError.message },
          { status: 500 }
        );
      }

      posts = (postRows ?? []) as PostRow[];
    }

    if (visibleThreads.length === 0) {
      return NextResponse.json({
        success: true,
        preview: normalizePreviewJson({
          root: {
            id: "japan-economy",
            label: "日本経済",
            summary: "公開中のスレッドがまだないため、再編案は生成していません。",
          },
          nodes: [],
          existing_node_matches: [],
          new_node_candidates: [],
          merge_candidates: [],
          warnings: ["公開中のスレッドがありません。"],
        }),
        source: {
          threads: 0,
          posts: 0,
          saved: false,
        },
      });
    }

    const postsByThreadId = new Map<string, PostRow[]>();

    for (const post of posts) {
      const current = postsByThreadId.get(post.thread_id) ?? [];
      if (current.length >= MAX_POSTS_PER_THREAD) continue;
      current.push(post);
      postsByThreadId.set(post.thread_id, current);
    }

    const discussionInput = visibleThreads.map((thread) => ({
      id: thread.id,
      title: compactText(thread.title, MAX_TITLE_LENGTH),
      category: compactText(thread.category, 80),
      original_post: compactText(thread.original_post, MAX_THREAD_TEXT_LENGTH),
      ai_summary: compactText(thread.ai_summary, MAX_THREAD_TEXT_LENGTH),
      created_at: thread.created_at,
      posts: (postsByThreadId.get(thread.id) ?? []).map((post) => ({
        post_role: compactText(post.post_role, 40),
        logic_score: post.logic_score,
        created_at: post.created_at,
        content: compactText(post.content, MAX_POST_CONTENT_LENGTH),
      })),
    }));

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
あなたはAI知恵袋Forumの議論マップ編集補助AIです。
公開中のスレッドと投稿内容だけを材料に、議論の全体マップ再編案をJSONで作成してください。

重要:
- これはpreviewです。本番ツリーを変更するものではありません。
- 投稿者情報、Cookie、author_key、管理キー、秘密情報は扱いません。
- 与えられたスレッド内容から、論点の親子関係、既存ノードとの対応、新規追加候補、統合候補を整理してください。
- 反対意見やリスクも論点として扱ってください。
- 既存ノードに近い場合は、できるだけ既存node idを維持してください。
- idは英小文字・数字・ハイフンのslug形式にしてください。
- JSON以外の説明文は返さないでください。
      `.trim(),
      input: JSON.stringify(
        {
          existing_nodes: EXISTING_NODES,
          desired_schema: {
            root: {
              id: "japan-economy",
              label: "日本経済",
              summary: "全体の要約",
            },
            nodes: [
              {
                id: "consumption-tax",
                label: "消費税",
                summary: "この論点の説明",
                parent_id: "tax-social-insurance",
                related_keywords: ["消費税", "減税", "需要不足"],
                source_thread_ids: ["..."],
              },
            ],
            existing_node_matches: [
              {
                existing_node_id: "consumption-tax",
                suggested_node_id: "consumption-tax",
                confidence: 0.9,
                reason: "既存ノードと同じ消費税論点",
              },
            ],
            new_node_candidates: [
              {
                id: "food-tax-impact",
                label: "食料品税率と飲食店への影響",
                reason: "複数スレッドで独立論点として出ている",
              },
            ],
            merge_candidates: [
              {
                from_node_ids: ["funding-source", "funding-inflation"],
                to_label: "財源・インフレ",
                reason: "近い論点として扱える",
              },
            ],
            warnings: [],
          },
          threads: discussionInput,
        },
        null,
        2
      ),
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "discussion_map_preview",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              root: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  summary: { type: "string" },
                },
                required: ["id", "label", "summary"],
              },
              nodes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    summary: { type: "string" },
                    parent_id: { type: ["string", "null"] },
                    related_keywords: {
                      type: "array",
                      items: { type: "string" },
                    },
                    source_thread_ids: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "id",
                    "label",
                    "summary",
                    "parent_id",
                    "related_keywords",
                    "source_thread_ids",
                  ],
                },
              },
              existing_node_matches: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    existing_node_id: { type: "string" },
                    suggested_node_id: { type: "string" },
                    confidence: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: [
                    "existing_node_id",
                    "suggested_node_id",
                    "confidence",
                    "reason",
                  ],
                },
              },
              new_node_candidates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["id", "label", "reason"],
                },
              },
              merge_candidates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    from_node_ids: {
                      type: "array",
                      items: { type: "string" },
                    },
                    to_label: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["from_node_ids", "to_label", "reason"],
                },
              },
              warnings: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "root",
              "nodes",
              "existing_node_matches",
              "new_node_candidates",
              "merge_candidates",
              "warnings",
            ],
          },
          strict: true,
        },
      },
    });

    const outputText = extractOutputText(response);

    if (!outputText) {
      return NextResponse.json(
        { success: false, error: "OpenAI did not return preview JSON" },
        { status: 500 }
      );
    }

    let parsed: PreviewJson;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse discussion map preview JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: normalizePreviewJson(parsed),
      source: {
        threads: visibleThreads.length,
        posts: posts.length,
        saved: false,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to rebuild discussion map preview";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
