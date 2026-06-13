import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function hasOtherNode(nodes: unknown[]) {
  return nodes.some((node) => {
    if (!isRecord(node)) {
      return false;
    }

    const id = typeof node.id === "string" ? node.id.trim().toLowerCase() : "";
    const label = typeof node.label === "string" ? node.label.trim() : "";
    return id === "other" || id === "others" || label.includes("その他");
  });
}

async function addOtherNodeForUnmappedThreads(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  mapJson: unknown
) {
  if (!supabase || !isRecord(mapJson) || !isRecord(mapJson.root) || !Array.isArray(mapJson.nodes)) {
    return mapJson;
  }

  const rootId = typeof mapJson.root.id === "string" ? mapJson.root.id.trim() : "";
  if (!rootId || hasOtherNode(mapJson.nodes)) {
    return mapJson;
  }

  const mappedThreadIds = new Set<string>();
  for (const node of mapJson.nodes) {
    if (!isRecord(node)) {
      continue;
    }
    for (const threadId of normalizeStringArray(node.source_thread_ids)) {
      mappedThreadIds.add(threadId);
    }
  }

  try {
    const { data, error } = await supabase
      .from("forum_threads")
      .select("id")
      .eq("is_deleted", false)
      .limit(2000);

    if (error) {
      console.error("[forum-discussion-map] Failed to load public thread ids", error.message);
      return mapJson;
    }

    const unmappedThreadIds = (data ?? [])
      .map((thread) => (typeof thread.id === "string" ? thread.id : ""))
      .filter((threadId) => threadId && !mappedThreadIds.has(threadId));

    if (unmappedThreadIds.length === 0) {
      return mapJson;
    }

    return {
      ...mapJson,
      nodes: [
        ...mapJson.nodes,
        {
          id: "other",
          label: "その他",
          summary:
            "主要ノードにまだ分類されていない公開スレッドです。次回の再編案生成時に、必要に応じて正式な論点へ整理します。",
          parent_id: rootId,
          related_keywords: ["その他", "未分類"],
          source_thread_ids: unmappedThreadIds,
        },
      ],
    };
  } catch (error) {
    console.error("[forum-discussion-map] Failed to append other node", error);
    return mapJson;
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase environment is not configured.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("forum_discussion_map_versions")
    .select("map_json")
    .eq("is_active", true)
    .order("applied_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load active discussion map.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({
      ok: true,
      map: null,
      fallbackRequired: true,
    });
  }

  const map = await addOtherNodeForUnmappedThreads(supabase, data.map_json);

  return NextResponse.json({
    ok: true,
    map,
    fallbackRequired: false,
  });
}
