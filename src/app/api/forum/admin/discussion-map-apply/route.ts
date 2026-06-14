import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NODE_COUNT = 200;
const MAX_ID_LENGTH = 80;
const MAX_LABEL_LENGTH = 120;
const MAX_SUMMARY_LENGTH = 1000;

type NormalizedDiscussionMap = {
  root: {
    id: string;
    label: string;
    summary: string;
  };
  nodes: Array<{
    id: string;
    label: string;
    summary: string;
    parent_id: string | null;
    related_keywords: string[];
    source_thread_ids: string[];
  }>;
  existing_node_matches: unknown[];
  new_node_candidates: unknown[];
  merge_candidates: unknown[];
  warnings: string[];
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase environment is not configured");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

function jsonError(error: string, status = 400, details?: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null) return { ok: true as const, value: [] };

  if (!Array.isArray(value)) {
    return {
      ok: false as const,
      error: `${fieldName} must be an array of strings.`,
    };
  }

  const values: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      return {
        ok: false as const,
        error: `${fieldName} must be an array of strings.`,
      };
    }

    const text = item.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    values.push(text);
  }

  return { ok: true as const, value: values };
}

function validateTextLength(value: string, fieldName: string, maxLength: number) {
  if (!value) return `${fieldName} is required.`;
  if (value.length > maxLength) return `${fieldName} is too long.`;
  return null;
}

function validateDiscussionMap(
  value: unknown
):
  | { ok: true; map: NormalizedDiscussionMap }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "preview_json must be an object." };
  }

  if (!isRecord(value.root)) {
    return { ok: false, error: "root is required." };
  }

  const root = {
    id: readText(value.root.id),
    label: readText(value.root.label),
    summary: readText(value.root.summary),
  };
  const rootIdError = validateTextLength(root.id, "root.id", MAX_ID_LENGTH);
  const rootLabelError = validateTextLength(
    root.label,
    "root.label",
    MAX_LABEL_LENGTH
  );

  if (rootIdError) return { ok: false, error: rootIdError };
  if (rootLabelError) return { ok: false, error: rootLabelError };
  if (root.summary.length > MAX_SUMMARY_LENGTH) {
    return { ok: false, error: "root.summary is too long." };
  }

  if (!Array.isArray(value.nodes)) {
    return { ok: false, error: "nodes must be an array." };
  }

  if (value.nodes.length === 0) {
    return { ok: false, error: "empty map cannot be activated." };
  }

  if (value.nodes.length > MAX_NODE_COUNT) {
    return { ok: false, error: "too many nodes." };
  }

  const nodeIds = new Set<string>();
  const nodes: NormalizedDiscussionMap["nodes"] = [];

  for (const rawNode of value.nodes) {
    if (!isRecord(rawNode)) {
      return { ok: false, error: "each node must be an object." };
    }

    const relatedKeywords = readStringArray(
      rawNode.related_keywords,
      "node.related_keywords"
    );
    if (!relatedKeywords.ok) return { ok: false, error: relatedKeywords.error };

    const sourceThreadIds = readStringArray(
      rawNode.source_thread_ids,
      "node.source_thread_ids"
    );
    if (!sourceThreadIds.ok) return { ok: false, error: sourceThreadIds.error };

    const node = {
      id: readText(rawNode.id),
      label: readText(rawNode.label),
      summary: readText(rawNode.summary),
      parent_id: readText(rawNode.parent_id) || null,
      related_keywords: relatedKeywords.value,
      source_thread_ids: sourceThreadIds.value,
    };

    const nodeIdError = validateTextLength(node.id, "node.id", MAX_ID_LENGTH);
    const nodeLabelError = validateTextLength(
      node.label,
      "node.label",
      MAX_LABEL_LENGTH
    );

    if (nodeIdError) return { ok: false, error: nodeIdError };
    if (nodeLabelError) return { ok: false, error: nodeLabelError };
    if (node.summary.length > MAX_SUMMARY_LENGTH) {
      return { ok: false, error: "node.summary is too long." };
    }
    if (node.id === root.id) {
      return { ok: false, error: "node.id must not duplicate root.id." };
    }
    if (nodeIds.has(node.id)) {
      return { ok: false, error: `duplicated node.id: ${node.id}` };
    }

    nodeIds.add(node.id);
    nodes.push(node);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (
      node.parent_id &&
      node.parent_id !== root.id &&
      !nodeById.has(node.parent_id)
    ) {
      return {
        ok: false,
        error: `parent_id does not exist: ${node.parent_id}`,
      };
    }
  }

  for (const node of nodes) {
    const seen = new Set<string>([node.id]);
    let parentId = node.parent_id;

    while (parentId && parentId !== root.id) {
      if (seen.has(parentId)) {
        return { ok: false, error: "cycle detected in parent_id." };
      }

      seen.add(parentId);
      parentId = nodeById.get(parentId)?.parent_id ?? null;
    }
  }

  const warnings = Array.isArray(value.warnings)
    ? value.warnings
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    ok: true,
    map: {
      root,
      nodes,
      existing_node_matches: Array.isArray(value.existing_node_matches)
        ? value.existing_node_matches
        : [],
      new_node_candidates: Array.isArray(value.new_node_candidates)
        ? value.new_node_candidates
        : [],
      merge_candidates: Array.isArray(value.merge_candidates)
        ? value.merge_candidates
        : [],
      warnings,
    },
  };
}

async function restorePreviousActiveVersion(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  previousActiveId: string | null,
  newVersionId: string | null
) {
  if (newVersionId) {
    await supabase
      .from("forum_discussion_map_versions")
      .update({ is_active: false })
      .eq("id", newVersionId);
  }

  if (previousActiveId) {
    await supabase
      .from("forum_discussion_map_versions")
      .update({ is_active: true })
      .eq("id", previousActiveId);
  }
}

export async function POST(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return jsonError("Unauthorized", 401);
  }

  let body: { preview_id?: unknown; previewId?: unknown } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const previewId =
    typeof body.preview_id === "string"
      ? body.preview_id.trim()
      : typeof body.previewId === "string"
        ? body.previewId.trim()
        : "";

  if (!previewId) {
    return jsonError("preview_id is required.", 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: preview, error: previewError } = await supabase
      .from("forum_discussion_map_previews")
      .select("id, preview_json, status")
      .eq("id", previewId)
      .maybeSingle();

    if (previewError) {
      return jsonError("Failed to load preview.", 500, previewError.message);
    }

    if (!preview) {
      return jsonError("Preview not found.", 404);
    }

    if (preview.status === "rejected") {
      return jsonError("Rejected preview cannot be applied.", 400);
    }

    const validation = validateDiscussionMap(preview.preview_json);

    if (!validation.ok) {
      return jsonError("Invalid discussion map preview.", 400, validation.error);
    }

    const { data: previousActiveRows, error: previousActiveError } =
      await supabase
        .from("forum_discussion_map_versions")
        .select("id")
        .eq("is_active", true)
        .limit(1);

    if (previousActiveError) {
      return jsonError(
        "Failed to load active map version.",
        500,
        previousActiveError.message
      );
    }

    const previousActiveId = previousActiveRows?.[0]?.id ?? null;
    const now = new Date().toISOString();
    const { data: insertedVersion, error: insertError } = await supabase
      .from("forum_discussion_map_versions")
      .insert({
        map_json: validation.map,
        source_preview_id: previewId,
        is_active: false,
        applied_at: now,
      })
      .select("id")
      .single();

    if (insertError || !insertedVersion?.id) {
      return jsonError(
        "Failed to create map version.",
        500,
        insertError?.message
      );
    }

    const newVersionId = insertedVersion.id as string;
    const { error: deactivateError } = await supabase
      .from("forum_discussion_map_versions")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      await restorePreviousActiveVersion(supabase, previousActiveId, newVersionId);
      return jsonError(
        "Failed to deactivate previous map version.",
        500,
        deactivateError.message
      );
    }

    const { error: activateError } = await supabase
      .from("forum_discussion_map_versions")
      .update({ is_active: true })
      .eq("id", newVersionId);

    if (activateError) {
      await restorePreviousActiveVersion(supabase, previousActiveId, newVersionId);
      return jsonError(
        "Failed to activate map version.",
        500,
        activateError.message
      );
    }

    const { error: previewUpdateError } = await supabase
      .from("forum_discussion_map_previews")
      .update({
        status: "applied",
        applied_at: now,
      })
      .eq("id", previewId);

    if (previewUpdateError) {
      await restorePreviousActiveVersion(supabase, previousActiveId, newVersionId);
      return jsonError(
        "Failed to update preview status.",
        500,
        previewUpdateError.message
      );
    }

    return NextResponse.json({
      ok: true,
      version_id: newVersionId,
      preview_id: previewId,
      is_active: true,
    });
  } catch (error) {
    console.error("[forum-discussion-map-apply] Failed to apply map", error);
    return jsonError(
      "Failed to apply discussion map.",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}
