import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const SUMMARY_COLUMNS = `
  id,
  tenant_slug,
  target_type,
  target_id,
  summary_type,
  content,
  created_by,
  version_id,
  created_at,
  updated_at
`;

const VERSION_COLUMNS = `
  id,
  tenant_slug,
  target_type,
  target_id,
  version_type,
  input_snapshot,
  output_snapshot,
  created_by,
  created_at
`;

const ORGANIZE_PROMPT = "内容を評価せず、読みやすく3行程度で整理してください。";

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

type ExistingSummaryRow = {
  id: string;
  content: string;
};

type SummaryRow = {
  id: string;
  version_id: string | null;
};

type VersionRow = {
  created_at: string;
};

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
  const sourceDataId =
    searchParams.get("sourceDataId")?.trim() ||
    searchParams.get("source_data_id")?.trim() ||
    "";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (!sourceDataId) {
    return NextResponse.json(
      { success: false, error: "sourceDataId is required" },
      { status: 400 }
    );
  }

  const { data: summary, error: summaryError } = await supabase
    .from("micro_summaries")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("target_type", "source_data")
    .eq("target_id", sourceDataId)
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

  const summaryId = (summary as SummaryRow | null)?.id;

  if (!summaryId) {
    return NextResponse.json({
      success: true,
      versions: [],
    });
  }

  const { data: versions, error: versionsError } = await supabase
    .from("micro_versions")
    .select(VERSION_COLUMNS)
    .eq("tenant_slug", tenantSlug)
    .eq("target_type", "summary")
    .eq("target_id", summaryId)
    .order("created_at", { ascending: false });

  if (versionsError) {
    return NextResponse.json(
      { success: false, error: versionsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    versions: ((versions ?? []) as VersionRow[]).map((version) => ({
      ...version,
      updated_at: version.created_at,
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

  const tenantSlug = readString(body.tenantSlug || body.tenant_slug);
  const sourceDataId = readString(body.sourceDataId || body.source_data_id);
  const rawContent = readString(body.rawContent || body.raw_content);
  const force = body.force === true;

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  if (!sourceDataId) {
    return NextResponse.json(
      { success: false, error: "sourceDataId is required" },
      { status: 400 }
    );
  }

  if (!rawContent) {
    return NextResponse.json(
      { success: false, error: "rawContent is required" },
      { status: 400 }
    );
  }

  const { data: existingSummary, error: existingSummaryError } = await supabase
    .from("micro_summaries")
    .select(SUMMARY_COLUMNS)
    .eq("tenant_slug", tenantSlug)
    .eq("target_type", "source_data")
    .eq("target_id", sourceDataId)
    .eq("summary_type", "short")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSummaryError) {
    return NextResponse.json(
      { success: false, error: existingSummaryError.message },
      { status: 500 }
    );
  }

  if (existingSummary && !force) {
    return NextResponse.json({
      success: true,
      summary: existingSummary,
      reused: true,
      source: "existing",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is missing" },
      { status: 500 }
    );
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `${ORGANIZE_PROMPT}\n\n${rawContent}`,
    });

    const summaryText = response.output_text?.trim();

    if (!summaryText) {
      return NextResponse.json(
        { success: false, error: "summary generation failed" },
        { status: 500 }
      );
    }

    const existingSummaryId = (existingSummary as ExistingSummaryRow | null)
      ?.id;

    const { error } = existingSummaryId
      ? await supabase
          .from("micro_summaries")
          .update({
            content: summaryText,
            created_by: "ai",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSummaryId)
      : await supabase.from("micro_summaries").insert({
          tenant_slug: tenantSlug,
          target_type: "source_data",
          target_id: sourceDataId,
          summary_type: "short",
          content: summaryText,
          created_by: "ai",
        });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const { data: summary, error: latestSummaryError } = await supabase
      .from("micro_summaries")
      .select(SUMMARY_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .eq("target_type", "source_data")
      .eq("target_id", sourceDataId)
      .eq("summary_type", "short")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSummaryError) {
      return NextResponse.json(
        { success: false, error: latestSummaryError.message },
        { status: 500 }
      );
    }

    const summaryRow = summary as SummaryRow | null;

    if (!summaryRow?.id) {
      return NextResponse.json(
        { success: false, error: "summary was not found after save" },
        { status: 500 }
      );
    }

    const { data: version, error: versionError } = await supabase
      .from("micro_versions")
      .insert({
        tenant_slug: tenantSlug,
        target_type: "summary",
        target_id: summaryRow.id,
        version_type: "ai_generated",
        input_snapshot: {
          source_data_id: sourceDataId,
          summary_type: "short",
          raw_content: rawContent,
          previous_summary:
            (existingSummary as ExistingSummaryRow | null)?.content ?? null,
          prompt: ORGANIZE_PROMPT,
        },
        output_snapshot: {
          summary: summaryText,
          summary_type: "short",
        },
        prompt_name: "micro_summary_short_organize",
        model_name: "gpt-4.1-mini",
        created_by: "ai",
      })
      .select("id")
      .maybeSingle();

    if (versionError) {
      return NextResponse.json(
        { success: false, error: versionError.message },
        { status: 500 }
      );
    }

    const versionId = (version as { id?: string } | null)?.id;

    if (versionId) {
      const { error: versionLinkError } = await supabase
        .from("micro_summaries")
        .update({ version_id: versionId })
        .eq("id", summaryRow.id);

      if (versionLinkError) {
        return NextResponse.json(
          { success: false, error: versionLinkError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        summary: versionId ? { ...summaryRow, version_id: versionId } : summary,
      },
      { status: existingSummaryId ? 200 : 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "summary generation failed";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
