import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TAG_COLUMNS = `
  id,
  tenant_slug,
  name
`;

const TAG_SOURCE_COLUMNS = `
  id,
  tenant_slug,
  source_type,
  title,
  updated_at
`;

type MicroTag = {
  id: string;
  tenant_slug: string;
  name: string;
};

type TagItemRow = {
  id: string;
  tag_id: string;
  source_data_id?: string | null;
};

type SourceDataRow = {
  id: string;
  title: string | null;
  source_type: string;
  updated_at: string | null;
};

type SummaryRow = {
  target_id: string;
  content: string;
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

function isMissingTagTableError(error: { message?: string } | null) {
  const message = error?.message ?? "";

  return (
    message.includes("Could not find the table") ||
    message.includes('relation "public.micro_tags" does not exist') ||
    message.includes('relation "micro_tags" does not exist') ||
    message.includes('relation "public.micro_tag_items" does not exist') ||
    message.includes('relation "micro_tag_items" does not exist')
  );
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
  const sourceDataId =
    searchParams.get("sourceDataId")?.trim() ||
    searchParams.get("source_data_id")?.trim() ||
    "";
  const tagName = searchParams.get("tag")?.trim() || "";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (tagName) {
    const { data: tag, error: tagError } = await supabase
      .from("micro_tags")
      .select(TAG_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .ilike("name", tagName)
      .limit(1)
      .maybeSingle();

    if (tagError) {
      if (isMissingTagTableError(tagError)) {
        return NextResponse.json({
          success: true,
          tag: null,
          sources: [],
          tableReady: false,
        });
      }

      return NextResponse.json(
        { success: false, error: tagError.message },
        { status: 500 }
      );
    }

    const tagRow = tag as MicroTag | null;

    if (!tagRow?.id) {
      return NextResponse.json({
        success: true,
        tag: null,
        sources: [],
      });
    }

    const { data: tagItems, error: tagItemsError } = await supabase
      .from("micro_tag_items")
      .select("id, tag_id, source_data_id")
      .eq("tenant_slug", tenantSlug)
      .eq("tag_id", tagRow.id);

    if (tagItemsError) {
      if (isMissingTagTableError(tagItemsError)) {
        return NextResponse.json({
          success: true,
          tag: tagRow,
          sources: [],
          tableReady: false,
        });
      }

      return NextResponse.json(
        { success: false, error: tagItemsError.message },
        { status: 500 }
      );
    }

    const sourceDataIds = Array.from(
      new Set(
        ((tagItems ?? []) as TagItemRow[])
          .map((item) => item.source_data_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (sourceDataIds.length === 0) {
      return NextResponse.json({
        success: true,
        tag: tagRow,
        sources: [],
      });
    }

    const { data: sources, error: sourcesError } = await supabase
      .from("micro_source_data")
      .select(TAG_SOURCE_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .neq("status", "archived")
      .in("id", sourceDataIds)
      .order("updated_at", { ascending: false });

    if (sourcesError) {
      return NextResponse.json(
        { success: false, error: sourcesError.message },
        { status: 500 }
      );
    }

    const sourceRows = (sources ?? []) as SourceDataRow[];
    const sourceIds = sourceRows.map((source) => source.id);
    const summaryBySourceDataId = new Map<string, string>();

    if (sourceIds.length > 0) {
      const { data: summaries, error: summariesError } = await supabase
        .from("micro_summaries")
        .select("target_id, content, updated_at")
        .eq("tenant_slug", tenantSlug)
        .eq("target_type", "source_data")
        .eq("summary_type", "short")
        .in("target_id", sourceIds)
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
      tag: tagRow,
      sources: sourceRows.map((source) => ({
        ...source,
        summary: summaryBySourceDataId.get(source.id) ?? null,
      })),
    });
  }

  if (!sourceDataId) {
    return NextResponse.json(
      { success: false, error: "sourceDataId is required" },
      { status: 400 }
    );
  }

  const { data: tagItems, error: tagItemsError } = await supabase
    .from("micro_tag_items")
    .select("id, tag_id")
    .eq("tenant_slug", tenantSlug)
    .eq("source_data_id", sourceDataId);

  if (tagItemsError) {
    if (isMissingTagTableError(tagItemsError)) {
      return NextResponse.json({
        success: true,
        tags: [],
        tableReady: false,
      });
    }

    return NextResponse.json(
      { success: false, error: tagItemsError.message },
      { status: 500 }
    );
  }

  const tagIds = Array.from(
    new Set(((tagItems ?? []) as TagItemRow[]).map((item) => item.tag_id))
  );

  if (tagIds.length === 0) {
    return NextResponse.json({
      success: true,
      tags: [],
    });
  }

  const { data: tags, error: tagsError } = await supabase
    .from("micro_tags")
    .select(TAG_COLUMNS)
    .eq("tenant_slug", tenantSlug)
    .in("id", tagIds)
    .order("name", { ascending: true });

  if (tagsError) {
    if (isMissingTagTableError(tagsError)) {
      return NextResponse.json({
        success: true,
        tags: [],
        tableReady: false,
      });
    }

    return NextResponse.json(
      { success: false, error: tagsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    tags: (tags ?? []) as MicroTag[],
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
  const sourceDataId = readString(body.sourceDataId || body.source_data_id);
  const name = readString(body.name);

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

  if (!name) {
    return NextResponse.json(
      { success: false, error: "name is required" },
      { status: 400 }
    );
  }

  const { data: existingTag, error: existingTagError } = await supabase
    .from("micro_tags")
    .select(TAG_COLUMNS)
    .eq("tenant_slug", tenantSlug)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existingTagError) {
    if (isMissingTagTableError(existingTagError)) {
      return NextResponse.json(
        { success: false, error: "タグ用テーブルがまだありません" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: existingTagError.message },
      { status: 500 }
    );
  }

  let tag = existingTag as MicroTag | null;

  if (!tag) {
    const { data: createdTag, error: createdTagError } = await supabase
      .from("micro_tags")
      .insert({
        tenant_slug: tenantSlug,
        name,
      })
      .select(TAG_COLUMNS)
      .maybeSingle();

    if (createdTagError) {
      if (isMissingTagTableError(createdTagError)) {
        return NextResponse.json(
          { success: false, error: "タグ用テーブルがまだありません" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: false, error: createdTagError.message },
        { status: 500 }
      );
    }

    tag = createdTag as MicroTag | null;
  }

  if (!tag?.id) {
    return NextResponse.json(
      { success: false, error: "tag creation failed" },
      { status: 500 }
    );
  }

  const { data: existingItem, error: existingItemError } = await supabase
    .from("micro_tag_items")
    .select("id, tag_id")
    .eq("tenant_slug", tenantSlug)
    .eq("tag_id", tag.id)
    .eq("source_data_id", sourceDataId)
    .limit(1)
    .maybeSingle();

  if (existingItemError) {
    if (isMissingTagTableError(existingItemError)) {
      return NextResponse.json(
        { success: false, error: "タグ用テーブルがまだありません" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: existingItemError.message },
      { status: 500 }
    );
  }

  if (existingItem) {
    return NextResponse.json({
      success: true,
      tag,
      alreadyExists: true,
    });
  }

  const { error: tagItemError } = await supabase
    .from("micro_tag_items")
    .insert({
      tenant_slug: tenantSlug,
      tag_id: tag.id,
      source_data_id: sourceDataId,
    });

  if (tagItemError) {
    if (isMissingTagTableError(tagItemError)) {
      return NextResponse.json(
        { success: false, error: "タグ用テーブルがまだありません" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: tagItemError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      tag,
      alreadyExists: false,
    },
    { status: 201 }
  );
}
