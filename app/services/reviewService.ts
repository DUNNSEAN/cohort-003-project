import { eq, and, sql, avg } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

// ─── Review Service ───
// Handles course star ratings (1–5). One review per user per course.

export function getReviewByUserAndCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId)
      )
    )
    .get();
}

export function getAverageRating(courseId: number) {
  const result = db
    .select({
      avgRating: avg(courseReviews.rating),
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return {
    averageRating: result?.avgRating ? parseFloat(result.avgRating) : null,
    reviewCount: result?.count ?? 0,
  };
}

export function getAverageRatingsForCourses(courseIds: number[]) {
  if (courseIds.length === 0) return new Map<number, { averageRating: number | null; reviewCount: number }>();

  const results = db
    .select({
      courseId: courseReviews.courseId,
      avgRating: avg(courseReviews.rating),
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(
      sql`${courseReviews.courseId} IN (${sql.join(
        courseIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(courseReviews.courseId)
    .all();

  const map = new Map<number, { averageRating: number | null; reviewCount: number }>();
  for (const row of results) {
    map.set(row.courseId, {
      averageRating: row.avgRating ? parseFloat(row.avgRating) : null,
      reviewCount: row.count,
    });
  }
  return map;
}

export function upsertReview(userId: number, courseId: number, rating: number) {
  const existing = getReviewByUserAndCourse(userId, courseId);

  if (existing) {
    return db
      .update(courseReviews)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseReviews.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseReviews)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}
