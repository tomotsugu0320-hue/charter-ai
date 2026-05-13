import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SOURCE_DATA_COLUMNS = `
  id,
  tenant_slug,
  source_type,
  title,
  raw_content,
  normalized_content,
  status,
  pinned,
  usage_count,
  last_used_at,
  author_key,
  created_at,
  updated_at,
  archived_at
`;

const SOURCE_TYPES = new Set([
  "free_log",
  "smart_note",
  "chat_log",
  "imported_text",
  "manual",
  "voice",
  "chatgpt_share",
  "line",
  "web_clip",
]);

const SOURCE_STATUSES = new Set(["draft", "active", "archived"]);

const RELATED_STOP_WORDS = new Set([
  "は",
  "が",
  "を",
  "に",
  "の",
  "か",
  "へ",
  "で",
  "と",
  "も",
  "や",
  "ね",
  "な",
  "だ",
  "です",
  "ます",
  "する",
  "した",
  "して",
  "いる",
  "ある",
  "これ",
  "それ",
  "あれ",
  "この",
  "その",
  "どの",
  "こと",
  "もの",
  "ため",
]);

type SourceDataRow = {
  id: string;
  tenant_slug?: string | null;
  pinned?: boolean | null;
  source_type?: string | null;
  title?: string | null;
  raw_content?: string | null;
  last_used_at?: string | null;
  updated_at?: string | null;
};

type SummaryRow = {
  target_id: string;
  content: string;
};

type SourceVersionRow = {
  id: string;
  target_type: string;
  target_id: string;
  version_type: string;
  input_snapshot: unknown;
  output_snapshot: unknown;
  diff_summary: string | null;
  created_by: string;
  created_at: string;
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ja-JP");
}

function getRelatedKeywordCandidates(value: string | null | undefined) {
  return normalizeText(value)
    .split(
      /[\s、。,.!?！？?「」『』（）()【】[\]［］:：;；/／\\|｜・…ー-]+|[はがをにのか]+/
    )
    .map((keyword) => keyword.trim())
    .filter(
      (keyword) =>
        keyword.length >= 2 &&
        keyword.length <= 40 &&
        !RELATED_STOP_WORDS.has(keyword)
    );
}

function getRelatedTerms(
  sourceData: SourceDataRow,
  summary: string | null | undefined
) {
  const candidates = [
    ...getRelatedKeywordCandidates(sourceData.title),
    ...getRelatedKeywordCandidates(sourceData.raw_content),
    ...getRelatedKeywordCandidates(summary),
  ];

  return Array.from(new Set(candidates)).slice(0, 40);
}

function hasPartialMatch(
  sourceData: SourceDataRow,
  terms: string[],
  summary: string | null | undefined
) {
  const target = `${normalizeText(sourceData.title)} ${normalizeText(
    sourceData.raw_content
  )} ${normalizeText(summary)}`;

  return terms.some((term) => target.includes(term));
}

function compareUpdatedAtDesc(a: SourceDataRow, b: SourceDataRow) {
  const aTime = new Date(a.updated_at ?? "").getTime();
  const bTime = new Date(b.updated_at ?? "").getTime();

  return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
}

function getOrderTime(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function compareSourceDataOrder(a: SourceDataRow, b: SourceDataRow) {
  const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  if (pinnedDiff !== 0) return pinnedDiff;

  const lastUsedDiff =
    getOrderTime(b.last_used_at) - getOrderTime(a.last_used_at);
  if (lastUsedDiff !== 0) return lastUsedDiff;

  return getOrderTime(b.updated_at) - getOrderTime(a.updated_at);
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tenantSlug =
    searchParams.get("tenant_slug")?.trim() ||
    searchParams.get("tenantSlug")?.trim() ||
    "";
  const id = searchParams.get("id")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const searchQuery = searchParams.get("q")?.trim() || "";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (id) {
    const { data, error } = await supabase
      .from("micro_source_data")
      .select(SOURCE_DATA_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "source data not found" },
        { status: 404 }
      );
    }

    const { data: summary, error: summaryError } = await supabase
      .from("micro_summaries")
      .select("content, updated_at")
      .eq("tenant_slug", tenantSlug)
      .eq("target_type", "source_data")
      .eq("target_id", id)
      .eq("summary_type", "short")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (summaryError) {
      return NextResponse.json(
        { success: false, error: summaryError.message },
        { status: 500 }
      );
    }

    const { data: sourceVersions, error: sourceVersionsError } = await supabase
      .from("micro_versions")
      .select(
        "id, target_type, target_id, version_type, input_snapshot, output_snapshot, diff_summary, created_by, created_at"
      )
      .eq("tenant_slug", tenantSlug)
      .eq("target_type", "source_data")
      .eq("target_id", id)
      .eq("version_type", "user_edit")
      .order("created_at", { ascending: false });

    if (sourceVersionsError) {
      return NextResponse.json(
        { success: false, error: sourceVersionsError.message },
        { status: 500 }
      );
    }

    const sourceData = data as SourceDataRow;
    const sourceSummaryContent = summary?.content ?? null;
    const relatedTerms = getRelatedTerms(sourceData, sourceSummaryContent);
    let relatedSources: SourceDataRow[] = [];
    const relatedSummaryBySourceDataId = new Map<string, string>();

    if (relatedTerms.length > 0) {
      const { data: relatedCandidates, error: relatedError } = await supabase
        .from("micro_source_data")
        .select(SOURCE_DATA_COLUMNS)
        .eq("tenant_slug", tenantSlug)
        .neq("id", id)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (relatedError) {
        return NextResponse.json(
          { success: false, error: relatedError.message },
          { status: 500 }
        );
      }

      const relatedCandidateRows = (relatedCandidates ?? []) as SourceDataRow[];
      const relatedCandidateIds = relatedCandidateRows.map((item) => item.id);

      if (relatedCandidateIds.length > 0) {
        const { data: relatedSummaries, error: relatedSummariesError } =
          await supabase
            .from("micro_summaries")
            .select("target_id, content, updated_at")
            .eq("tenant_slug", tenantSlug)
            .eq("target_type", "source_data")
            .eq("summary_type", "short")
            .in("target_id", relatedCandidateIds)
            .order("updated_at", { ascending: false });

        if (relatedSummariesError) {
          return NextResponse.json(
            { success: false, error: relatedSummariesError.message },
            { status: 500 }
          );
        }

        ((relatedSummaries ?? []) as SummaryRow[]).forEach(
          (relatedSummary) => {
            if (!relatedSummaryBySourceDataId.has(relatedSummary.target_id)) {
              relatedSummaryBySourceDataId.set(
                relatedSummary.target_id,
                relatedSummary.content
              );
            }
          }
        );
      }

      relatedSources = relatedCandidateRows
        .filter((candidate) =>
          hasPartialMatch(
            candidate,
            relatedTerms,
            relatedSummaryBySourceDataId.get(candidate.id)
          )
        )
        .sort((a, b) => {
          const aSameSourceType = a.source_type === sourceData.source_type;
          const bSameSourceType = b.source_type === sourceData.source_type;

          if (aSameSourceType !== bSameSourceType) {
            return aSameSourceType ? -1 : 1;
          }

          return compareUpdatedAtDesc(a, b);
        })
        .slice(0, 5);
    }

    return NextResponse.json({
      success: true,
      sourceData: {
        ...data,
        summary: summary?.content ?? null,
      },
      sourceVersions: (sourceVersions ?? []) as SourceVersionRow[],
      relatedSources: relatedSources.map((relatedSource) => ({
        ...relatedSource,
        summary: relatedSummaryBySourceDataId.get(relatedSource.id) ?? null,
      })),
    });
  }

  let sourceData: SourceDataRow[] = [];

  if (searchQuery) {
    const searchPattern = `%${searchQuery}%`;
    const sourceDataById = new Map<string, SourceDataRow>();

    const sourceMatchQueries = ["title", "raw_content"].map((column) => {
      let query = supabase
        .from("micro_source_data")
        .select(SOURCE_DATA_COLUMNS)
        .eq("tenant_slug", tenantSlug)
        .ilike(column, searchPattern)
        .order("pinned", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });

      if (status === "archived") {
        query = query.eq("status", "archived");
      } else {
        query = query.neq("status", "archived");
      }

      return query;
    });

    const [titleResult, rawContentResult] = await Promise.all(
      sourceMatchQueries
    );

    if (titleResult.error) {
      return NextResponse.json(
        { success: false, error: titleResult.error.message },
        { status: 500 }
      );
    }

    if (rawContentResult.error) {
      return NextResponse.json(
        { success: false, error: rawContentResult.error.message },
        { status: 500 }
      );
    }

    [
      ...((titleResult.data ?? []) as SourceDataRow[]),
      ...((rawContentResult.data ?? []) as SourceDataRow[]),
    ].forEach((item) => {
      sourceDataById.set(item.id, item);
    });

    const { data: matchedSummaries, error: matchedSummariesError } =
      await supabase
        .from("micro_summaries")
        .select("target_id, content, updated_at")
        .eq("tenant_slug", tenantSlug)
        .eq("target_type", "source_data")
        .eq("summary_type", "short")
        .ilike("content", searchPattern)
        .order("updated_at", { ascending: false });

    if (matchedSummariesError) {
      return NextResponse.json(
        { success: false, error: matchedSummariesError.message },
        { status: 500 }
      );
    }

    const summaryMatchedSourceDataIds = Array.from(
      new Set(
        ((matchedSummaries ?? []) as SummaryRow[]).map(
          (summary) => summary.target_id
        )
      )
    );

    if (summaryMatchedSourceDataIds.length > 0) {
      let summaryMatchedSourceDataQuery = supabase
        .from("micro_source_data")
        .select(SOURCE_DATA_COLUMNS)
        .eq("tenant_slug", tenantSlug)
        .in("id", summaryMatchedSourceDataIds)
        .order("pinned", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });

      if (status === "archived") {
        summaryMatchedSourceDataQuery = summaryMatchedSourceDataQuery.eq(
          "status",
          "archived"
        );
      } else {
        summaryMatchedSourceDataQuery = summaryMatchedSourceDataQuery.neq(
          "status",
          "archived"
        );
      }

      const { data: summaryMatchedSourceData, error: summarySourceDataError } =
        await summaryMatchedSourceDataQuery;

      if (summarySourceDataError) {
        return NextResponse.json(
          { success: false, error: summarySourceDataError.message },
          { status: 500 }
        );
      }

      ((summaryMatchedSourceData ?? []) as SourceDataRow[]).forEach((item) => {
        sourceDataById.set(item.id, item);
      });
    }

    sourceData = Array.from(sourceDataById.values()).sort(
      compareSourceDataOrder
    );
  } else {
    let query = supabase
      .from("micro_source_data")
      .select(SOURCE_DATA_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .order("pinned", { ascending: false })
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (status === "archived") {
      query = query.eq("status", "archived");
    } else {
      query = query.neq("status", "archived");
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    sourceData = (data ?? []) as SourceDataRow[];
  }

  const sourceDataIds = sourceData.map((item) => item.id);
  const summaryBySourceDataId = new Map<string, string>();

  if (sourceDataIds.length > 0) {
    const { data: summaries, error: summariesError } = await supabase
      .from("micro_summaries")
      .select("target_id, content, updated_at")
      .eq("tenant_slug", tenantSlug)
      .eq("target_type", "source_data")
      .eq("summary_type", "short")
      .in("target_id", sourceDataIds)
      .order("updated_at", { ascending: false });

    if (summariesError) {
      return NextResponse.json(
        { success: false, error: summariesError.message },
        { status: 500 }
      );
    }

    ((summaries ?? []) as SummaryRow[]).forEach((summary) => {
      if (!summaryBySourceDataId.has(summary.target_id)) {
        summaryBySourceDataId.set(summary.target_id, summary.content);
      }
    });
  }

  return NextResponse.json({
    success: true,
    sourceData: sourceData.map((item) => ({
      ...item,
      summary: summaryBySourceDataId.get(item.id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const tenantSlug = readString(body.tenant_slug || body.tenantSlug);
  const rawContent = readString(body.raw_content || body.rawContent);
  const title = readString(body.title) || null;
  const sourceType = readString(body.source_type || body.sourceType) || "free_log";
  const status = readString(body.status) || "draft";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (!rawContent) {
    return NextResponse.json(
      { success: false, error: "raw_content is required" },
      { status: 400 }
    );
  }

  if (!SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json(
      { success: false, error: "source_type is invalid" },
      { status: 400 }
    );
  }

  if (!SOURCE_STATUSES.has(status)) {
    return NextResponse.json(
      { success: false, error: "status is invalid" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("micro_source_data")
    .insert({
      tenant_slug: tenantSlug,
      raw_content: rawContent,
      title,
      source_type: sourceType,
      status,
    })
    .select(SOURCE_DATA_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      sourceData: data,
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const id = readString(body.id);
  const action = readString(body.action);

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 }
    );
  }

  if (
    action !== "archive" &&
    action !== "restore" &&
    action !== "pin" &&
    action !== "unpin" &&
    action !== "touch" &&
    action !== "update"
  ) {
    return NextResponse.json(
      { success: false, error: "action is invalid" },
      { status: 400 }
    );
  }

  const values: Record<string, boolean | number | string | null> = {};
  let currentForVersion: SourceDataRow | null = null;
  let todoArchiveValues: Record<string, string | null> | null = null;
  let todoCurrentStatus = "";

  if (action === "archive") {
    const archivedAt = new Date().toISOString();

    values.status = "archived";
    values.archived_at = archivedAt;
    todoArchiveValues = {
      status: "archived",
      archived_at: archivedAt,
    };
    todoCurrentStatus = "active";
  } else if (action === "restore") {
    values.status = "active";
    values.archived_at = null;
    todoArchiveValues = {
      status: "active",
      archived_at: null,
    };
    todoCurrentStatus = "archived";
  } else if (action === "pin" || action === "unpin") {
    values.pinned = action === "pin";
  } else if (action === "update") {
    const title = readString(body.title) || null;
    const rawContent = readString(body.raw_content || body.rawContent);
    const sourceType = readString(body.source_type || body.sourceType);

    if (!rawContent) {
      return NextResponse.json(
        { success: false, error: "raw_content is required" },
        { status: 400 }
      );
    }

    if (!SOURCE_TYPES.has(sourceType)) {
      return NextResponse.json(
        { success: false, error: "source_type is invalid" },
        { status: 400 }
      );
    }

    const { data: current, error: currentError } = await supabase
      .from("micro_source_data")
      .select("id, tenant_slug, title, raw_content, source_type")
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { success: false, error: currentError.message },
        { status: 500 }
      );
    }

    if (!current) {
      return NextResponse.json(
        { success: false, error: "source data not found" },
        { status: 404 }
      );
    }

    currentForVersion = current as SourceDataRow;

    values.title = title;
    values.raw_content = rawContent;
    values.source_type = sourceType;
  } else {
    const { data: current, error: currentError } = await supabase
      .from("micro_source_data")
      .select("usage_count, status")
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { success: false, error: currentError.message },
        { status: 500 }
      );
    }

    if (!current) {
      return NextResponse.json(
        { success: false, error: "source data not found" },
        { status: 404 }
      );
    }

    if (current.status === "archived") {
      return NextResponse.json({
        success: true,
      });
    }

    const usageCount = Number(current.usage_count ?? 0);

    values.usage_count = Number.isFinite(usageCount) ? usageCount + 1 : 1;
    values.last_used_at = new Date().toISOString();
  }

  let updateQuery = supabase
    .from("micro_source_data")
    .update(values)
    .eq("id", id);

  if (action === "touch") {
    updateQuery = updateQuery.neq("status", "archived");
  }

  const { error } = await updateQuery;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  if (todoArchiveValues) {
    const { error: todoArchiveError } = await supabase
      .from("micro_todos")
      .update(todoArchiveValues)
      .eq("source_data_id", id)
      .eq("status", todoCurrentStatus)
      .eq("todo_state", "open");

    if (todoArchiveError) {
      return NextResponse.json(
        { success: false, error: todoArchiveError.message },
        { status: 500 }
      );
    }
  }

  if (action === "update" && currentForVersion) {
    const { error: versionError } = await supabase
      .from("micro_versions")
      .insert({
        tenant_slug: currentForVersion.tenant_slug,
        target_type: "source_data",
        target_id: id,
        version_type: "user_edit",
        input_snapshot: {
          title: currentForVersion.title ?? null,
          raw_content: currentForVersion.raw_content ?? "",
          source_type: currentForVersion.source_type ?? "",
        },
        output_snapshot: {
          title: values.title ?? null,
          raw_content: values.raw_content ?? "",
          source_type: values.source_type ?? "",
        },
        diff_summary: "source_data edited",
        created_by: "user",
      });

    if (versionError) {
      return NextResponse.json(
        { success: false, error: versionError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
  });
}
