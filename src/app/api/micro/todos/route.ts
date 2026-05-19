import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const TODO_COLUMNS = `
  id,
  tenant_slug,
  source_data_id,
  title,
  description,
  status,
  todo_state,
  created_by,
  created_at,
  updated_at,
  archived_at
`;

const EXTRACT_TODOS_PROMPT =
  "内容を評価せず、実行可能なToDo候補だけを最大3件抽出してください";

type TodoCandidate = {
  title?: unknown;
  description?: unknown;
};

type TodoRow = {
  status?: string | null;
  todo_state?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
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

function getTime(value: string | null | undefined) {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compareTodos(a: TodoRow, b: TodoRow) {
  const statePriority = (value: string | null | undefined) =>
    value === "open" ? 0 : 1;
  const stateDiff = statePriority(a.todo_state) - statePriority(b.todo_state);

  if (stateDiff !== 0) {
    return stateDiff;
  }

  return getTime(b.created_at) - getTime(a.created_at);
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseTodoCandidates(outputText: string) {
  try {
    const parsed = JSON.parse(stripJsonFence(outputText)) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item: TodoCandidate) => {
        const title = readString(item?.title);
        const description = readString(item?.description) || null;

        if (!title) {
          return null;
        }

        return { title, description };
      })
      .filter(
        (item): item is { title: string; description: string | null } =>
          item !== null
      )
      .slice(0, 3);
  } catch {
    return outputText
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*\d.)、]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((title) => ({ title, description: null }));
  }
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
  const includeArchived = ["1", "true", "yes"].includes(
    (
      searchParams.get("include_archived")?.trim() ||
      searchParams.get("includeArchived")?.trim() ||
      ""
    ).toLowerCase()
  );

  if (!tenantSlug && !sourceDataId) {
    return NextResponse.json(
      { success: false, error: "tenant_slug or sourceDataId is required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("micro_todos")
    .select(TODO_COLUMNS)
    .order("created_at", { ascending: false });

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  if (tenantSlug) {
    query = query.eq("tenant_slug", tenantSlug);
  }

  if (sourceDataId) {
    query = query.eq("source_data_id", sourceDataId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    todos: ((data ?? []) as TodoRow[]).sort(compareTodos),
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

  if (!force) {
    const { data: existingTodos, error: existingTodosError } = await supabase
      .from("micro_todos")
      .select(TODO_COLUMNS)
      .eq("tenant_slug", tenantSlug)
      .eq("source_data_id", sourceDataId)
      .neq("status", "archived")
      .or("todo_state.eq.open,todo_state.is.null")
      .order("created_at", { ascending: false });

    if (existingTodosError) {
      return NextResponse.json(
        { success: false, error: existingTodosError.message },
        { status: 500 }
      );
    }

    if ((existingTodos ?? []).length > 0) {
      return NextResponse.json({
        success: true,
        todos: ((existingTodos ?? []) as TodoRow[]).sort(compareTodos),
        reused: true,
        source: "existing",
      });
    }
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
      input: [
        EXTRACT_TODOS_PROMPT,
        "JSON配列だけで返してください。各要素は title と description を持つオブジェクトにしてください。",
        "",
        rawContent,
      ].join("\n"),
    });

    const outputText = response.output_text?.trim();

    if (!outputText) {
      return NextResponse.json(
        { success: false, error: "todo extraction failed" },
        { status: 500 }
      );
    }

    const todoCandidates = parseTodoCandidates(outputText);

    if (todoCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        todos: [],
      });
    }

    const { data, error } = await supabase
      .from("micro_todos")
      .insert(
        todoCandidates.map((todo) => ({
          tenant_slug: tenantSlug,
          source_data_id: sourceDataId,
          title: todo.title,
          description: todo.description,
          status: "active",
          todo_state: "open",
          created_by: "ai",
        }))
      )
      .select(TODO_COLUMNS);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        todos: data ?? [],
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "todo extraction failed";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
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

  if (action !== "done" && action !== "reopen") {
    return NextResponse.json(
      { success: false, error: "action is invalid" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("micro_todos")
    .update({
      todo_state: action === "done" ? "done" : "open",
    })
    .eq("id", id)
    .select(TODO_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: "todo not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    todo: data,
  });
}
