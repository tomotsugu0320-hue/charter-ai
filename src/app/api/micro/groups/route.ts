import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const GROUP_COLUMNS = `
  id,
  tenant_slug,
  title,
  description,
  status,
  pinned,
  usage_count,
  last_used_at,
  created_at,
  updated_at,
  archived_at
`;

type GroupRow = {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string | null;
};

type GroupItemRow = {
  id: string;
  group_id: string;
  source_data_id?: string;
};

type SourceDataRow = {
  id: string;
  title: string | null;
  source_type: string;
  raw_content?: string | null;
  status?: string | null;
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

async function addSourceToGroup(
  supabase: SupabaseClient,
  tenantSlug: string,
  groupId: string,
  sourceDataId: string
) {
  const { data: existingItem, error: existingItemError } = await supabase
    .from("micro_group_items")
    .select("id, group_id")
    .eq("tenant_slug", tenantSlug)
    .eq("group_id", groupId)
    .eq("source_data_id", sourceDataId)
    .maybeSingle();

  if (existingItemError) {
    return { data: null, error: existingItemError, alreadyExists: false };
  }

  if (existingItem) {
    return {
      data: existingItem as GroupItemRow,
      error: null,
      alreadyExists: true,
    };
  }

  const { data, error } = await supabase
    .from("micro_group_items")
    .insert({
      tenant_slug: tenantSlug,
      group_id: groupId,
      source_data_id: sourceDataId,
      created_by: "user",
    })
    .select("id, group_id")
    .maybeSingle();

  return {
    data: data as GroupItemRow | null,
    error,
    alreadyExists: false,
  };
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
  const id = searchParams.get("id")?.trim() || "";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (id) {
    const { data: group, error: groupError } = await supabase
      .from("micro_groups")
      .select(GROUP_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .eq("id", id)
      .maybeSingle();

    if (groupError) {
      return NextResponse.json(
        { success: false, error: groupError.message },
        { status: 500 }
      );
    }

    if (!group) {
      return NextResponse.json(
        { success: false, error: "group not found" },
        { status: 404 }
      );
    }

    const { data: groupItems, error: groupItemsError } = await supabase
      .from("micro_group_items")
      .select("id, group_id, source_data_id")
      .eq("tenant_slug", tenantSlug)
      .eq("group_id", id);

    if (groupItemsError) {
      return NextResponse.json(
        { success: false, error: groupItemsError.message },
        { status: 500 }
      );
    }

    const sourceDataIds = ((groupItems ?? []) as GroupItemRow[])
      .map((item) => item.source_data_id)
      .filter((value): value is string => Boolean(value));

    if (sourceDataIds.length === 0) {
      return NextResponse.json({
        success: true,
        group,
        sources: [],
      });
    }

    const { data: sources, error: sourcesError } = await supabase
      .from("micro_source_data")
      .select(
        "id, tenant_slug, source_type, title, raw_content, status, updated_at"
      )
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
      group,
      sources: sourceRows.map((source) => ({
        ...source,
        summary: summaryBySourceDataId.get(source.id) ?? null,
      })),
    });
  }

  const { data: groups, error: groupsError } = await supabase
    .from("micro_groups")
    .select(GROUP_COLUMNS)
    .eq("tenant_slug", tenantSlug)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (groupsError) {
    return NextResponse.json(
      { success: false, error: groupsError.message },
      { status: 500 }
    );
  }

  const groupRows = (groups ?? []) as GroupRow[];
  const linkedGroupIds = new Set<string>();

  if (sourceDataId) {
    const { data: groupItems, error: groupItemsError } = await supabase
      .from("micro_group_items")
      .select("id, group_id")
      .eq("tenant_slug", tenantSlug)
      .eq("source_data_id", sourceDataId);

    if (groupItemsError) {
      return NextResponse.json(
        { success: false, error: groupItemsError.message },
        { status: 500 }
      );
    }

    ((groupItems ?? []) as GroupItemRow[]).forEach((item) => {
      linkedGroupIds.add(item.group_id);
    });
  }

  const groupsWithLinkedState = groupRows.map((group) => ({
    ...group,
    linked: linkedGroupIds.has(group.id),
  }));

  return NextResponse.json({
    success: true,
    groups: groupsWithLinkedState,
    sourceGroups: sourceDataId
      ? groupsWithLinkedState.filter((group) => group.linked)
      : [],
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

  const action = readString(body.action);
  const tenantSlug = readString(body.tenant_slug || body.tenantSlug);
  const groupId = readString(body.group_id || body.groupId);
  const sourceDataId = readString(body.source_data_id || body.sourceDataId);

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (action === "add_source") {
    if (!groupId) {
      return NextResponse.json(
        { success: false, error: "group_id is required" },
        { status: 400 }
      );
    }

    if (!sourceDataId) {
      return NextResponse.json(
        { success: false, error: "sourceDataId is required" },
        { status: 400 }
      );
    }

    const { data, error, alreadyExists } = await addSourceToGroup(
      supabase,
      tenantSlug,
      groupId,
      sourceDataId
    );

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      groupItem: data,
      alreadyExists,
    });
  }

  const title = readString(body.title);
  const description = readString(body.description) || null;
  const status = readString(body.status) || "active";

  if (!title) {
    return NextResponse.json(
      { success: false, error: "title is required" },
      { status: 400 }
    );
  }

  if (status !== "draft" && status !== "active" && status !== "archived") {
    return NextResponse.json(
      { success: false, error: "status is invalid" },
      { status: 400 }
    );
  }

  const insertWithCreatedBy = {
    tenant_slug: tenantSlug,
    title,
    description,
    status,
    created_by: "user",
  };
  const insertWithoutCreatedBy = {
    tenant_slug: tenantSlug,
    title,
    description,
    status,
  };

  let { data: group, error: groupError } = await supabase
    .from("micro_groups")
    .insert(insertWithCreatedBy)
    .select(GROUP_COLUMNS)
    .maybeSingle();

  if (groupError && groupError.message.includes("created_by")) {
    const retryResult = await supabase
      .from("micro_groups")
      .insert(insertWithoutCreatedBy)
      .select(GROUP_COLUMNS)
      .maybeSingle();

    group = retryResult.data;
    groupError = retryResult.error;
  }

  if (groupError) {
    return NextResponse.json(
      { success: false, error: groupError.message },
      { status: 500 }
    );
  }

  const groupRow = group as GroupRow | null;

  if (!groupRow?.id) {
    return NextResponse.json(
      { success: false, error: "group creation failed" },
      { status: 500 }
    );
  }

  let groupItem: GroupItemRow | null = null;
  let alreadyExists = false;

  if (sourceDataId) {
    const addResult = await addSourceToGroup(
      supabase,
      tenantSlug,
      groupRow.id,
      sourceDataId
    );

    if (addResult.error) {
      return NextResponse.json(
        { success: false, error: addResult.error.message },
        { status: 500 }
      );
    }

    groupItem = addResult.data;
    alreadyExists = addResult.alreadyExists;
  }

  return NextResponse.json(
    {
      success: true,
      group,
      groupItem,
      alreadyExists,
    },
    { status: 201 }
  );
}
