    // src/app/api/forum/thread-detail/route.ts


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ForumPostForSummary = {
  id: string;
  post_role: string;
  content: string;
  created_at?: string;
};

type SourceItem = {
  text: string;
  source_type: "extracted" | "inferred";
  quality_score: number;
};

type ConflictPair = {
  opinion: string;
  rebuttal: string;
  source_type?: "extracted" | "inferred";
  quality_score?: number;
};

type StoredSummaryRow = {
  summary_type?: string | null;
  status?: string | null;
  summary_text?: string | null;
  easy_summary_text?: string | null;
  key_points?: unknown;
  issues?: unknown;
  opinions?: unknown;
  rebuttals?: unknown;
  supplements?: unknown;
  explanations?: unknown;
};

type PostAiClassificationForResponse = {
  classification: string;
  confidence: number | null;
  reason: string | null;
  extracted_premise: string | null;
  extracted_evidence: string | null;
  suggested_metrics: string[];
};

type PostAiClassificationRow = {
  post_id?: string | null;
  classification?: string | null;
  confidence?: number | string | null;
  reason?: string | null;
  extracted_premise?: string | null;
  extracted_evidence?: string | null;
  suggested_metrics?: unknown;
};

function shortText(value: string, max = 120) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];

    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === "string")
          : [];
      } catch {
        return [];
      }
    }

    return [text];
  }

  return [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSuggestedMetrics(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number" || typeof item === "boolean") return String(item);
      return "";
    })
    .filter((item) => item.length > 0);
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getAuthorKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (!match?.[1]) return "";

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function buildCounts(posts: ForumPostForSummary[]) {
  const counts = {
    total: posts.length,
    issue_raise: 0,
    opinion: 0,
    rebuttal: 0,
    supplement: 0,
    explanation: 0,
  };

  posts.forEach((post) => {
    if (post.post_role in counts && post.post_role !== "total") {
      counts[post.post_role as keyof Omit<typeof counts, "total">] += 1;
    }
  });

  return counts;
}

function toSourceItems(values: string[]): SourceItem[] {
  return values.slice(0, 3).map((text) => ({
    text: shortText(text, 90),
    source_type: "extracted",
    quality_score: 60,
  }));
}

function ensureConflictPairs(
  opinions: string[],
  rebuttals: string[],
  context: string
): ConflictPair[] {
  if (opinions.length > 0 && rebuttals.length > 0) {
    return opinions.slice(0, Math.min(opinions.length, rebuttals.length, 3)).map(
      (opinion, index) => ({
        opinion: shortText(opinion, 90),
        rebuttal: shortText(rebuttals[index], 90),
        source_type: "extracted",
        quality_score: 60,
      })
    );
  }

  if (rebuttals.length > 0) {
    return [
      {
        opinion: shortText(opinions[0] || context, 90),
        rebuttal: shortText(rebuttals[0], 90),
        source_type: "extracted",
        quality_score: 55,
      },
    ];
  }

  return [];
}

function isImmatureSummaryText(text: string) {
  const normalized = text.replace(/\s+/g, "");
  return [
    "まだ議論の整理が十分に進んでいません",
    "まだAIまとめはありません",
    "議論の整理が十分に進んでいません",
  ].some((phrase) => normalized.includes(phrase.replace(/\s+/g, "")));
}

function hasLayeredProvisionalAnswerText(text: string) {
  return (
    text.includes("【誰でも分かる説明】") &&
    text.includes("【もう少し詳しい説明】") &&
    text.includes("【深層・専門的な補足】")
  );
}

function buildProvisionalAnswerFromStored(
  summaryText: string,
  keyPoints: {
    issues: string[];
    opinions: string[];
    rebuttals: string[];
    supplements: string[];
    explanations: string[];
  },
  conflictPairs: ConflictPair[]
) {
  if (hasLayeredProvisionalAnswerText(summaryText)) {
    return summaryText;
  }

  const wholeSummary = isImmatureSummaryText(summaryText)
    ? ""
    : shortText(summaryText, 140);
  const focusText =
    keyPoints.issues[0] ||
    keyPoints.explanations[0] ||
    keyPoints.supplements[0] ||
    keyPoints.opinions[0] ||
    "";
  const remainingConcern = conflictPairs[0]?.rebuttal || keyPoints.rebuttals[0] || "";

  if (wholeSummary && remainingConcern) {
    return `現時点では、「${wholeSummary}」という全体整理をもとに、前提・根拠・反論リスクを見比べる段階です。ただし、「${shortText(
      remainingConcern,
      70
    )}」という反論・リスクも残ります。論理性の目安として確認してください。`;
  }

  if (wholeSummary) {
    return `現時点では、「${wholeSummary}」という全体整理をもとに確認できます。断定ではなく、論理性の目安として見てください。`;
  }

  if (focusText && remainingConcern) {
    return `現時点では、「${shortText(
      focusText,
      70
    )}」を軸に、主張・根拠・反論リスクを分けて確認する段階です。ただし、「${shortText(
      remainingConcern,
      70
    )}」という反論・リスクも残ります。`;
  }

  return "現時点では、投稿内容と論点整理をもとに、どの見方が論理的に強いかを確認している段階です。";
}

function isQuestionLikePremise(text: string) {
  const value = text.trim();
  if (!value) return false;
  return (
    /[?？]/.test(value) ||
    /なのか[。.]?$/.test(value) ||
    /どちらが/.test(value) ||
    /何か[。.]?$/.test(value)
  );
}

function isPremiseLikeText(text: string) {
  const value = text.trim();
  return (
    /確認する必要がある/.test(value) ||
    /分ける必要がある/.test(value) ||
    /前提/.test(value) ||
    /条件/.test(value) ||
    /局面/.test(value) ||
    /検証/.test(value) ||
    /影響を確認/.test(value)
  );
}

function pickPremiseTexts(keyPoints: {
  issues: string[];
  supplements: string[];
  explanations: string[];
}) {
  const usableSupplements = keyPoints.supplements.filter(
    (item) => !isQuestionLikePremise(item)
  );
  if (usableSupplements.length > 0) return usableSupplements;

  const explanationPremises = keyPoints.explanations.filter(
    (item) => !isQuestionLikePremise(item) && isPremiseLikeText(item)
  );
  if (explanationPremises.length > 0) return explanationPremises;

  const issueFallbacks = keyPoints.issues.filter(
    (item) => !isQuestionLikePremise(item) && isPremiseLikeText(item)
  );
  if (issueFallbacks.length > 0) return issueFallbacks;

  return ["判断に必要な前提・条件を確認する必要がある。"];
}

function buildStoredSummaryPayload(
  storedSummary: StoredSummaryRow | null,
  posts: ForumPostForSummary[]
) {
  const summaryText =
    typeof storedSummary?.summary_text === "string"
      ? storedSummary.summary_text.trim()
      : "";
  const storedKeyPoints = asRecord(storedSummary?.key_points);
  const classifiedKeyPoints = {
    discussion_position: asStringArray(storedKeyPoints.discussion_position),
    added_premises: asStringArray(storedKeyPoints.added_premises),
    added_evidence: asStringArray(storedKeyPoints.added_evidence),
    main_agreements: asStringArray(storedKeyPoints.main_agreements),
    main_rebuttals: asStringArray(storedKeyPoints.main_rebuttals),
    verification_metrics: asStringArray(storedKeyPoints.verification_metrics),
    needs_review: asStringArray(storedKeyPoints.needs_review),
    changes_from_initial_answer: asStringArray(
      storedKeyPoints.changes_from_initial_answer
    ),
    current_tentative_conclusion: asStringArray(
      storedKeyPoints.current_tentative_conclusion
    ),
  };
  const keyPoints = {
    issues: asStringArray(storedSummary?.issues),
    opinions: asStringArray(storedSummary?.opinions),
    rebuttals: asStringArray(storedSummary?.rebuttals),
    supplements: asStringArray(storedSummary?.supplements),
    explanations: asStringArray(storedSummary?.explanations),
  };
  const hasKeyPoints = [...Object.values(keyPoints), ...Object.values(classifiedKeyPoints)].some(
    (items) => items.length > 0
  );

  if (!summaryText && !hasKeyPoints) return null;

  const conflictPairs = ensureConflictPairs(
    keyPoints.opinions,
    keyPoints.rebuttals,
    keyPoints.issues[0] || keyPoints.opinions[0] || posts[0]?.content || "この主張"
  );
  const summary_text =
    summaryText || "保存済みの論点整理をもとに、この議論を確認できます。";

  return {
    summary: {
      counts: buildCounts(posts),
      summary_type: storedSummary?.summary_type ?? null,
      summary_text,
      easy_summary_text:
        storedSummary?.easy_summary_text?.trim() || shortText(summary_text, 160),
      provisional_answer: buildProvisionalAnswerFromStored(
        summary_text,
        keyPoints,
        conflictPairs
      ),
      key_points: {
        ...keyPoints,
        ...classifiedKeyPoints,
        premises: toSourceItems(pickPremiseTexts(keyPoints)),
        reasons: toSourceItems([...keyPoints.explanations, ...keyPoints.opinions]),
        counterpoints: toSourceItems(keyPoints.rebuttals),
      },
    },
    conflict_pairs: conflictPairs,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    const cookieAuthorKey = getAuthorKey(req);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);


const { data: thread, error: threadError } = await supabase
  .from("forum_threads")
.select(`
  id,
  title,
  slug,
  original_post,
  category,
  created_at,
  ai_premises,
  ai_reasons,
  ai_conflicts
`)
  .eq("id", threadId)
  .eq("is_deleted", false)
  .maybeSingle();

if (threadError) {
  return NextResponse.json(
    { success: false, error: threadError.message },
    { status: 500 }
  );
}

if (!thread) {
  return NextResponse.json(
    { success: false, error: "thread not found", threadId },
    { status: 404 }
  );
}


    const { data: posts, error: postsError } = await supabase
      .from("forum_posts")
.select(`
  id,
  thread_id,
  source_type,
  post_role,
  stance_label,
  content,
  sanitized_text,
  is_sensitive,
  author_key,
  trust_status,
  created_at,
  logic_score,
  logic_score_reason,
  logic_break_type,
  logic_break_note,
  prediction_flag,
  prediction_target,
  prediction_deadline,
  prediction_result,
  parent_opinion_id,
  ai_conclusion_explanation,
  ai_conclusion_explained_at,
  ai_counterargument_explanation,
  ai_counterargument_explained_at,
  is_deleted,
  deleted_at,
  delete_reason
`)
      .eq("thread_id", threadId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (postsError) {
      return NextResponse.json(
        { success: false, error: postsError.message },
        { status: 500 }
      );
    }

    const postIds = Array.from(
      new Set(
        (posts ?? [])
          .map((post: any) => (typeof post.id === "string" ? post.id : ""))
          .filter(Boolean)
      )
    );
    const classificationMap: Record<string, PostAiClassificationForResponse> = {};

    if (postIds.length > 0) {
      const { data: classificationRows, error: classificationError } = await supabase
        .from("forum_post_ai_classifications")
        .select(
          `
          post_id,
          classification,
          confidence,
          reason,
          extracted_premise,
          extracted_evidence,
          suggested_metrics,
          created_at
        `
        )
        .eq("thread_id", threadId)
        .eq("is_active", true)
        .in("post_id", postIds)
        .order("created_at", { ascending: false });

      if (classificationError) {
        console.warn(
          "[thread-detail classifications skipped]",
          classificationError.message
        );
      } else {
        (classificationRows ?? []).forEach((row: PostAiClassificationRow) => {
          if (!row.post_id || !row.classification || classificationMap[row.post_id]) {
            return;
          }

          classificationMap[row.post_id] = {
            classification: row.classification,
            confidence: toNullableNumber(row.confidence),
            reason: row.reason ?? null,
            extracted_premise: row.extracted_premise ?? null,
            extracted_evidence: row.extracted_evidence ?? null,
            suggested_metrics: normalizeSuggestedMetrics(row.suggested_metrics),
          };
        });
      }
    }

    const { data: storedSummary, error: storedSummaryError } = await supabase
      .from("thread_ai_structures")
      .select(
        "summary_type, status, summary_text, easy_summary_text, key_points, issues, opinions, rebuttals, supplements, explanations"
      )
      .eq("thread_id", threadId)
      .maybeSingle();

    if (storedSummaryError) {
      console.warn("[thread-detail summary skipped]", storedSummaryError.message);
    }

    const hasPolicyProposalCandidate =
      storedSummary?.summary_type === "thread_summary_from_classifications" &&
      storedSummary?.status === "active";

    const storedSummaryPayload = buildStoredSummaryPayload(
      (storedSummary ?? null) as StoredSummaryRow | null,
      (posts ?? []) as ForumPostForSummary[]
    );


    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("forum_post_feedback")
      .select("post_id, feedback_type")
      .eq("thread_id", threadId);

    if (feedbackError) {
      return NextResponse.json(
        { success: false, error: feedbackError.message },
        { status: 500 }
      );
    }

    const feedbackMap: Record<
      string,
      {
        term_unknown: number;
        premise_unknown: number;
        conclusion_unknown: number;
        evidence_unknown: number;
        counterargument_unknown: number;
      }
    > = {};

    (feedbackRows ?? []).forEach((row: any) => {
      if (!feedbackMap[row.post_id]) {
        feedbackMap[row.post_id] = {
          term_unknown: 0,
          premise_unknown: 0,
          conclusion_unknown: 0,
          evidence_unknown: 0,
          counterargument_unknown: 0,
        };
      }

      if (row.feedback_type in feedbackMap[row.post_id]) {
        feedbackMap[row.post_id][
          row.feedback_type as keyof (typeof feedbackMap)[string]
        ] += 1;
      }
    });

    const postsWithFeedback = (posts ?? []).map((post: any) => {
      const { author_key: postAuthorKey, ...publicPost } = post;
      const isSensitive = post.is_sensitive === true;
      const sanitizedText =
        typeof post.sanitized_text === "string"
          ? post.sanitized_text.trim()
          : "";

      return {
        ...publicPost,
        content: isSensitive
          ? "個人情報保護のため、この投稿は表示を制限しています。"
          : sanitizedText || publicPost.content,
        sanitized_text: sanitizedText || null,
        is_sensitive: isSensitive,
        can_delete: Boolean(cookieAuthorKey && postAuthorKey === cookieAuthorKey),
        feedback_counts: feedbackMap[post.id] ?? {
          term_unknown: 0,
          premise_unknown: 0,
          conclusion_unknown: 0,
          evidence_unknown: 0,
          counterargument_unknown: 0,
        },
        ai_classification: classificationMap[post.id] ?? null,
      };
    });

    const feedbackSummary = {
      term_unknown: 0,
      premise_unknown: 0,
      conclusion_unknown: 0,
      evidence_unknown: 0,
      counterargument_unknown: 0,
    };

    (feedbackRows ?? []).forEach((row: any) => {
      if (row.feedback_type in feedbackSummary) {
        feedbackSummary[
          row.feedback_type as keyof typeof feedbackSummary
        ] += 1;
      }
    });

    return NextResponse.json({
      success: true,
      thread: {
        ...thread,
        has_policy_proposal_candidate: hasPolicyProposalCandidate,
      },
      posts: postsWithFeedback,
      feedback_summary: feedbackSummary,
      summary: storedSummaryPayload?.summary ?? null,
      conflict_pairs: storedSummaryPayload?.conflict_pairs ?? [],
    });
  } catch (e: any) {
    console.error("[thread-detail error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

