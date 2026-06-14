import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage, recordForumApiUsageLog } from "@/lib/forum-api-usage";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_THREADS = 100;
const MAX_POSTS = 300;
const MAX_TITLE_LENGTH = 160;
const MAX_THREAD_TEXT_LENGTH = 800;
const MAX_POST_CONTENT_LENGTH = 500;
const MAX_POSTS_PER_THREAD = 5;
const PROMPT_VERSION = "rebuild_discussion_map_v1";

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

function compactText(value: unknown, maxLength: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function extractOutputText(json: any) {
  return json?.output_text ?? json?.output?.[0]?.content?.[0]?.text ?? "";
}

function normalizeSourceThreadIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;

    const threadId = item.trim();
    if (!threadId || seen.has(threadId)) continue;

    seen.add(threadId);
    normalized.push(threadId);
  }

  return normalized;
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
    nodes: Array.isArray(value.nodes)
      ? value.nodes.map((node) =>
          node && typeof node === "object" && !Array.isArray(node)
            ? {
                ...node,
                source_thread_ids: normalizeSourceThreadIds(
                  (node as { source_thread_ids?: unknown }).source_thread_ids
                ),
              }
            : node
        )
      : [],
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

async function saveDiscussionMapPreview(
  supabase: ReturnType<typeof getSupabase>,
  preview: ReturnType<typeof normalizePreviewJson>,
  sourceThreadCount: number,
  sourcePostCount: number
) {
  if (!supabase) {
    throw new Error("Supabase env is missing");
  }

  const { data, error } = await supabase
    .from("forum_discussion_map_previews")
    .insert({
      preview_json: preview,
      source_thread_count: sourceThreadCount,
      source_post_count: sourcePostCount,
      prompt_version: PROMPT_VERSION,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id as string | undefined;
}

function errorResponse(
  error_code: string,
  error: string,
  status = 500,
  details?: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      error_code,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export async function POST(req: Request) {
  if (!isForumAdminAuthenticated(req)) {
    return errorResponse("admin_key_invalid", "Unauthorized", 401);
  }

  const supabase = getSupabase();

  if (!supabase) {
    return errorResponse("supabase_env_missing", "Supabase env is missing");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return errorResponse(
      "openai_api_key_missing",
      "OPENAI_API_KEY is not set"
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
      return errorResponse(
        "supabase_threads_failed",
        "Supabase threads query failed",
        500,
        threadsError.message
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
        return errorResponse(
          "supabase_posts_failed",
          "Supabase posts query failed",
          500,
          postsError.message
        );
      }

      posts = (postRows ?? []) as PostRow[];
    }

    if (visibleThreads.length === 0) {
      const preview = normalizePreviewJson({
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
      });
      let previewId: string | undefined;

      try {
        previewId = await saveDiscussionMapPreview(supabase, preview, 0, 0);
      } catch (error) {
        return errorResponse(
          "discussion_map_preview_save_failed",
          "Failed to save discussion map preview",
          500,
          error instanceof Error ? error.message : String(error)
        );
      }

      return NextResponse.json({
        success: true,
        preview_id: previewId,
        preview,
        source: {
          threads: 0,
          posts: 0,
          saved: true,
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

    let response: any;
    try {
      response = await client.responses.create({
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
- root直下の第1階層は最大5〜7個程度に抑えてください。
- 第1階層は大分類だけにしてください。細かい単発論点をroot直下に置かないでください。
- 推奨する第1階層カテゴリ例は「経済政策」「税金・社会保険料」「金融・為替」「労働・社会政策」「安全保障・外交」「歴史認識・国際発信」です。ただし、入力内容に応じて必要なら調整して構いません。
- nodesに入れるのは、複数スレッドにまたがる主要論点を優先してください。
- 各大分類の下には、複数スレッドにまたがる主要な中分類を2〜5個程度までnodesに含めて構いません。
- 中分類は、既存ノードに近い論点を優先してください。
- 中分類例: 経済政策 → 需要不足 / 財政政策 / アベノミクス / 物価・インフレ。
- 中分類例: 税金・社会保険料 → 消費税 / 減税 / 財源・インフレ。
- 中分類例: 金融・為替 → 金融政策 / 為替・円安円高 / 外貨準備。
- 中分類例: 労働・社会政策 → 雇用・賃金 / 移民・多文化共生。
- nodesは「大分類＋主要中分類」までに抑えてください。細かい個別論点を第2階層以下に大量追加しないでください。
- source_thread_idsが1件だけの細かい論点は、原則nodesではなくnew_node_candidatesに入れてください。
- 例外的に重要論点としてsource_thread_idsが1件だけのnodeを作る場合は、その理由をwarningsに書いてください。
- 主要カテゴリに入らない公開スレッドは、id "other" / label "その他" のnodeに必ず入れてください。
- "その他" nodeはparent_idをroot.idにし、分類しきれない公開スレッドのsource_thread_idsを入れてください。
- 分類しきれない公開スレッドをwarningsやnew_node_candidatesだけに逃がさず、議論マップ上で見える状態にしてください。
- 類似論点は別々のnodeにせず、merge_candidatesに統合候補として出してください。
- 既存ノードに近い論点は、同じ意味の別名nodeを作らず、existing_node_matchesで既存ノードへ寄せてください。
- parent_idはできるだけ大分類nodeに接続してください。japan-economy直下に細かい論点を大量に置かないでください。
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
      await recordForumApiUsageLog({
        featureKey: "rebuild_discussion_map",
        routePath: "/api/forum/admin-rebuild-discussion-map",
        model: "gpt-4.1-mini",
        promptVersion: PROMPT_VERSION,
        targetType: "admin_job",
        targetId: null,
        userId: null,
        inputText: JSON.stringify(discussionInput),
        outputText: extractOutputText(response),
        usage: response.usage,
        status: "success",
      });
    } catch (error) {
      await recordForumApiUsageLog({
        featureKey: "rebuild_discussion_map",
        routePath: "/api/forum/admin-rebuild-discussion-map",
        model: "gpt-4.1-mini",
        promptVersion: PROMPT_VERSION,
        targetType: "admin_job",
        targetId: null,
        userId: null,
        inputText: JSON.stringify(discussionInput),
        status: "error",
        errorMessage: getErrorMessage(error),
      });
      throw error;
    }

    const outputText = extractOutputText(response);

    if (!outputText) {
      return errorResponse(
        "openai_preview_json_missing",
        "OpenAI did not return preview JSON"
      );
    }

    let parsed: PreviewJson;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      return errorResponse(
        "openai_preview_json_parse_failed",
        "Failed to parse discussion map preview JSON"
      );
    }

    const preview = normalizePreviewJson(parsed);
    let previewId: string | undefined;

    try {
      previewId = await saveDiscussionMapPreview(
        supabase,
        preview,
        visibleThreads.length,
        posts.length
      );
    } catch (error) {
      return errorResponse(
        "discussion_map_preview_save_failed",
        "Failed to save discussion map preview",
        500,
        error instanceof Error ? error.message : String(error)
      );
    }

    return NextResponse.json({
      success: true,
      preview_id: previewId,
      preview,
      source: {
        threads: visibleThreads.length,
        posts: posts.length,
        saved: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "failed to rebuild discussion map preview";

    return errorResponse("discussion_map_rebuild_failed", message);
  }
}
