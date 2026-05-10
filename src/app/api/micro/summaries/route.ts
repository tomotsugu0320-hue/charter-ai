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
};

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is missing" },
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

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `内容を評価せず、読みやすく3行程度で整理してください。\n\n${rawContent}`,
    });

    const summaryText = response.output_text?.trim();

    if (!summaryText) {
      return NextResponse.json(
        { success: false, error: "summary generation failed" },
        { status: 500 }
      );
    }

    const { data: existingSummary, error: existingSummaryError } =
      await supabase
        .from("micro_summaries")
        .select("id")
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

    return NextResponse.json(
      {
        success: true,
        summary,
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
