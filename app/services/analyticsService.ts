import { eq, and, gte, sql, isNotNull } from "drizzle-orm";
import { db } from "~/db";
import {
  purchases,
  enrollments,
  quizAttempts,
  quizzes,
  lessons,
  modules,
} from "~/db/schema";
import * as v from "valibot";

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
