import { eq, and, gte, sql, isNotNull } from "drizzle-orm";
import { db } from "~/db";
import {
  purchases,
  enrollments,
  lessonProgress,
  quizAttempts,
  quizzes,
  lessons,
  modules,
} from "~/db/schema";
import * as v from "valibot";

export type BucketRow = { bucket: string; value: number };

export const timeWindowSchema = v.picklist(["7d", "30d", "90d", "all"]);
export type TimeWindow = v.InferOutput<typeof timeWindowSchema>;

function getWindowStart(window: TimeWindow): string | null {
  if (window === "all") return null;
  const days = { "7d": 7, "30d": 30, "90d": 90 } as const;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days[window]);
  return d.toISOString();
}

export function getCourseAnalyticsStats(opts: {
  courseId: number;
  window: TimeWindow;
}) {
  const { courseId, window } = opts;
  const windowStart = getWindowStart(window);

  // Total revenue: sum of pricePaid from purchases within the window
  const revenueRow = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, courseId),
        windowStart ? gte(purchases.createdAt, windowStart) : undefined
      )
    )
    .get();
  const totalRevenue = revenueRow?.total ?? 0;

  // Total enrollments within the window
  const enrollmentRow = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        windowStart ? gte(enrollments.enrolledAt, windowStart) : undefined
      )
    )
    .get();
  const totalEnrollments = enrollmentRow?.count ?? 0;

  // Completed count: enrollments in window with completedAt set
  const completedRow = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        windowStart ? gte(enrollments.enrolledAt, windowStart) : undefined,
        isNotNull(enrollments.completedAt)
      )
    )
    .get();
  const completedCount = completedRow?.count ?? 0;
  const completionRate =
    totalEnrollments > 0
      ? Math.round((completedCount / totalEnrollments) * 100)
      : 0;

  // Average quiz score for quiz attempts in this course within the window
  const avgScoreRow = db
    .select({ avg: sql<number | null>`avg(${quizAttempts.score})` })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(modules.courseId, courseId),
        windowStart ? gte(quizAttempts.attemptedAt, windowStart) : undefined
      )
    )
    .get();
  const avgQuizScore =
    avgScoreRow?.avg != null ? Math.round(avgScoreRow.avg * 100) : null;

  return { totalRevenue, totalEnrollments, completionRate, avgQuizScore };
}

// ─── Time-series helpers ─────────────────────────────────────────────────────

/** Compute SQLite's strftime('%W', date) week key for a given UTC date. */
function toWeekKey(date: Date): string {
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Mon = (jan1.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const firstMondayYday = (7 - jan1Mon) % 7;
  const yday = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week =
    yday < firstMondayYday ? 0 : Math.floor((yday - firstMondayYday) / 7) + 1;
  return `${year}-${String(week).padStart(2, "0")}`;
}

/** Return the Monday of the week containing `date` (UTC midnight). */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const offset = (d.getUTCDay() + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Parse a YYYY-WW week key back to the Monday of that week (UTC midnight). */
function weekKeyToMonday(key: string): Date {
  const [yearStr, weekStr] = key.split("-");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Mon = (jan1.getUTCDay() + 6) % 7;
  const firstMondayYday = (7 - jan1Mon) % 7;
  const yday = week === 0 ? 0 : firstMondayYday + (week - 1) * 7;
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + yday);
  return d;
}

/**
 * Fill zero-value buckets so every day (7d/30d) or week (90d/all) in the
 * window has an entry, even if there was no activity.
 *
 * For the "all" window with no rows, returns an empty array.
 */
export function fillBuckets(rows: BucketRow[], window: TimeWindow): BucketRow[] {
  const rowMap = new Map(rows.map((r) => [r.bucket, r.value]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (window === "7d" || window === "30d") {
    const days = window === "7d" ? 7 : 30;
    const result: BucketRow[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      result.push({ bucket: key, value: rowMap.get(key) ?? 0 });
    }
    return result;
  }

  // Weekly (90d or all)
  let startMonday: Date;
  if (window === "90d") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 90);
    startMonday = getMondayOf(start);
  } else {
    if (rows.length === 0) return [];
    const earliest = rows.reduce((a, b) => (a.bucket < b.bucket ? a : b)).bucket;
    startMonday = weekKeyToMonday(earliest);
  }

  const todayMonday = getMondayOf(today);
  const result: BucketRow[] = [];
  const current = new Date(startMonday);
  while (current <= todayMonday) {
    const key = toWeekKey(current);
    result.push({ bucket: key, value: rowMap.get(key) ?? 0 });
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return result;
}

export function getRevenueOverTime(opts: {
  courseId: number;
  window: TimeWindow;
}): BucketRow[] {
  const { courseId, window } = opts;
  const windowStart = getWindowStart(window);
  const fmt = window === "7d" || window === "30d" ? "%Y-%m-%d" : "%Y-%W";

  const rows = db
    .select({
      bucket: sql<string>`strftime(${fmt}, ${purchases.createdAt})`,
      value: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, courseId),
        windowStart ? gte(purchases.createdAt, windowStart) : undefined
      )
    )
    .groupBy(sql`strftime(${fmt}, ${purchases.createdAt})`)
    .orderBy(sql`strftime(${fmt}, ${purchases.createdAt})`)
    .all();

  return fillBuckets(rows, window);
}

export function getEnrollmentTrend(opts: {
  courseId: number;
  window: TimeWindow;
}): BucketRow[] {
  const { courseId, window } = opts;
  const windowStart = getWindowStart(window);
  const fmt = window === "7d" || window === "30d" ? "%Y-%m-%d" : "%Y-%W";

  const rows = db
    .select({
      bucket: sql<string>`strftime(${fmt}, ${enrollments.enrolledAt})`,
      value: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        windowStart ? gte(enrollments.enrolledAt, windowStart) : undefined
      )
    )
    .groupBy(sql`strftime(${fmt}, ${enrollments.enrolledAt})`)
    .orderBy(sql`strftime(${fmt}, ${enrollments.enrolledAt})`)
    .all();

  return fillBuckets(rows, window);
}

// ─── Quiz analytics ───────────────────────────────────────────────────────────

export type QuizAnalyticsRow = {
  quizId: number;
  quizTitle: string;
  lessonTitle: string;
  totalAttempts: number;
  avgScore: number;
  passRate: number;
};

export function getQuizAnalyticsForCourse(opts: {
  courseId: number;
  window: TimeWindow;
}): QuizAnalyticsRow[] {
  const { courseId, window } = opts;
  const windowStart = getWindowStart(window);

  const rows = db
    .select({
      quizId: quizzes.id,
      quizTitle: quizzes.title,
      lessonTitle: lessons.title,
      totalAttempts: sql<number>`count(${quizAttempts.id})`,
      avgScore: sql<number | null>`avg(${quizAttempts.score})`,
      passRate: sql<number | null>`avg(${quizAttempts.passed})`,
    })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .leftJoin(
      quizAttempts,
      and(
        eq(quizAttempts.quizId, quizzes.id),
        windowStart ? gte(quizAttempts.attemptedAt, windowStart) : undefined
      )
    )
    .where(eq(modules.courseId, courseId))
    .groupBy(quizzes.id)
    .orderBy(modules.position, lessons.position)
    .all();

  return rows.map((row) => ({
    quizId: row.quizId,
    quizTitle: row.quizTitle,
    lessonTitle: row.lessonTitle,
    totalAttempts: row.totalAttempts,
    avgScore: row.avgScore != null ? Math.round(row.avgScore * 100) : 0,
    passRate: row.passRate != null ? Math.round(row.passRate * 100) : 0,
  }));
}

// ─── Lesson drop-off funnel ───────────────────────────────────────────────────

export type FunnelRow = {
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  completionRate: number;
};

export function getLessonDropOffFunnel(opts: {
  courseId: number;
  window: TimeWindow;
}): FunnelRow[] {
  const { courseId, window } = opts;
  const windowStart = getWindowStart(window);

  // Count enrolled students in the cohort (the funnel denominator)
  const cohortRow = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        windowStart ? gte(enrollments.enrolledAt, windowStart) : undefined
      )
    )
    .get();
  const cohortSize = cohortRow?.count ?? 0;

  // For each lesson, count distinct cohort members who completed it
  const rows = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      completedCount: sql<number>`count(distinct case when ${lessonProgress.status} = 'completed' and ${enrollments.id} is not null then ${lessonProgress.userId} end)`,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .leftJoin(lessonProgress, eq(lessonProgress.lessonId, lessons.id))
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.userId, lessonProgress.userId),
        eq(enrollments.courseId, courseId),
        windowStart ? gte(enrollments.enrolledAt, windowStart) : undefined
      )
    )
    .where(eq(modules.courseId, courseId))
    .groupBy(lessons.id)
    .orderBy(modules.position, lessons.position)
    .all();

  return rows.map((row) => ({
    lessonId: row.lessonId,
    lessonTitle: row.lessonTitle,
    moduleTitle: row.moduleTitle,
    completionRate:
      cohortSize > 0 ? Math.round((row.completedCount / cohortSize) * 100) : 0,
  }));
}
