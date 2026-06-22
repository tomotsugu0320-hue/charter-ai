import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUMMARY_TYPE = "thread_summary_from_classifications";

type StructureRow = {
  thread_id: string;
  summary_text: string | null;
  easy_summary_text: string | null;
  key_points: unknown;
  updated_at: string | null;
};

type ThreadRow = {
  id: string;
  title: string | null;
  category: string | null;
  created_at: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment is not configured." },
      { status: 500 }
    );
  }

  const { data: structures, error: structuresError } = await supabase
    .from("thread_ai_structures")
    .select("thread_id, summary_text, easy_summary_text, key_points, updated_at")
    .eq("summary_type", SUMMARY_TYPE)
    .eq("status", "active")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (structuresError) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補を取得できませんでした。" },
      { status: 500 }
    );
  }

  const structureRows = (structures ?? []) as StructureRow[];
  const threadIds = Array.from(
    new Set(structureRows.map((row) => row.thread_id).filter(Boolean))
  );

  if (threadIds.length === 0) {
    return NextResponse.json({ ok: true, proposals: [] });
  }

  const { data: threads, error: threadsError } = await supabase
    .from("forum_threads")
    .select("id, title, category, created_at")
    .eq("is_deleted", false)
    .in("id", threadIds);

  if (threadsError) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補のスレッドを取得できませんでした。" },
      { status: 500 }
    );
  }

  const threadMap = new Map(
    ((threads ?? []) as ThreadRow[]).map((thread) => [thread.id, thread])
  );

  const proposals = structureRows
    .map((structure) => {
      const thread = threadMap.get(structure.thread_id);
      if (!thread) return null;

      const keyPoints = asRecord(structure.key_points);
      return {
        thread_id: thread.id,
        title: thread.title?.trim() || "無題の議論",
        category: thread.category?.trim() || "未設定",
        created_at: thread.created_at,
        summary_updated_at: structure.updated_at,
        easy_summary_text: structure.easy_summary_text?.trim() || "",
        summary_text: structure.summary_text?.trim() || "",
        current_tentative_conclusion: asStringArray(
          keyPoints.current_tentative_conclusion
        ),
        verification_metrics: asStringArray(keyPoints.verification_metrics),
      };
    })
    .filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null)
    .sort((a, b) => {
      const categoryPriority = Number(b.category === "経済・政策") - Number(a.category === "経済・政策");
      if (categoryPriority !== 0) return categoryPriority;
      return (
        new Date(b.summary_updated_at ?? b.created_at ?? 0).getTime() -
        new Date(a.summary_updated_at ?? a.created_at ?? 0).getTime()
      );
    });

  return NextResponse.json({ ok: true, proposals });
}
