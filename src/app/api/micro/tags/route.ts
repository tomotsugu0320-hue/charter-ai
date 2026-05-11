import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TAG_COLUMNS = `
  id,
  tenant_slug,
  name
`;

type MicroTag = {
  id: string;
  tenant_slug: string;
  name: string;
};

type TagItemRow = {
  id: string;
  tag_id: string;
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
