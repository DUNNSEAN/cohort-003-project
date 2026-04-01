import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import { getCourseAnalyticsStats } from "./analyticsService";

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getCourseAnalyticsStats", () => {
    describe("totalRevenue", () => {
      it("returns 0 for a course with no purchases", () => {
        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.totalRevenue).toBe(0);
      });

      it("sums pricePaid correctly", () => {
        testDb
          .insert(schema.purchases)
          .values([
            {
              userId: base.user.id,
              courseId: base.course.id,
              pricePaid: 1000,
              createdAt: daysAgo(1),
            },
            {
              userId: base.user.id,
              courseId: base.course.id,
              pricePaid: 2000,
              createdAt: daysAgo(2),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.totalRevenue).toBe(3000);
      });

      it("excludes purchases outside the time window", () => {
        testDb
          .insert(schema.purchases)
          .values([
            {
              userId: base.user.id,
              courseId: base.course.id,
              pricePaid: 1000,
              createdAt: daysAgo(1),
            },
            {
              userId: base.user.id,
              courseId: base.course.id,
              pricePaid: 2000,
              createdAt: daysAgo(10),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "7d",
        });
        expect(stats.totalRevenue).toBe(1000);
      });

      it("includes all purchases for 'all' window", () => {
        testDb
          .insert(schema.purchases)
          .values([
            {
              userId: base.user.id,
              courseId: base.course.id,
              pricePaid: 1000,
              createdAt: daysAgo(400),
            },
            {
              userId: base.user.id,
              courseId: base.course.id,
              pricePaid: 2000,
              createdAt: daysAgo(1),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "all",
        });
        expect(stats.totalRevenue).toBe(3000);
      });
    });

    describe("totalEnrollments", () => {
      it("returns 0 for a course with no enrollments", () => {
        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.totalEnrollments).toBe(0);
      });

      it("counts enrollments within the window", () => {
        const user2 = testDb
          .insert(schema.users)
          .values({
            name: "User 2",
            email: "u2@test.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();
        const user3 = testDb
          .insert(schema.users)
          .values({
            name: "User 3",
            email: "u3@test.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.enrollments)
          .values([
            {
              userId: base.user.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(1),
            },
            {
              userId: user2.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(5),
            },
            {
              userId: user3.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(10),
            }, // outside 7d
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "7d",
        });
        expect(stats.totalEnrollments).toBe(2);
      });
    });

    describe("completionRate", () => {
      it("returns 0 when there are no enrollments (no division by zero)", () => {
        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.completionRate).toBe(0);
        expect(Number.isNaN(stats.completionRate)).toBe(false);
      });

      it("returns correct completion rate", () => {
        const user2 = testDb
          .insert(schema.users)
          .values({
            name: "User 2",
            email: "u2@test.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();
        const user3 = testDb
          .insert(schema.users)
          .values({
            name: "User 3",
            email: "u3@test.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.enrollments)
          .values([
            {
              userId: base.user.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(1),
              completedAt: new Date().toISOString(),
            },
            {
              userId: user2.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(2),
            },
            {
              userId: user3.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(3),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.completionRate).toBe(33); // 1/3 = 33.33% → 33
      });

      it("returns 0 when enrollments are outside the window", () => {
        testDb
          .insert(schema.enrollments)
          .values([
            {
              userId: base.user.id,
              courseId: base.course.id,
              enrolledAt: daysAgo(400),
              completedAt: new Date().toISOString(),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "7d",
        });
        expect(stats.totalEnrollments).toBe(0);
        expect(stats.completionRate).toBe(0);
      });
    });

    describe("avgQuizScore", () => {
      it("returns null for a course with no quiz attempts", () => {
        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.avgQuizScore).toBeNull();
      });

      it("returns correct average score as a whole-number percentage", () => {
        const mod = testDb
          .insert(schema.modules)
          .values({ courseId: base.course.id, title: "Mod 1", position: 1 })
          .returning()
          .get();
        const lesson = testDb
          .insert(schema.lessons)
          .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
          .returning()
          .get();
        const quiz = testDb
          .insert(schema.quizzes)
          .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
          .returning()
          .get();

        testDb
          .insert(schema.quizAttempts)
          .values([
            {
              userId: base.user.id,
              quizId: quiz.id,
              score: 0.8,
              passed: true,
              attemptedAt: daysAgo(1),
            },
            {
              userId: base.user.id,
              quizId: quiz.id,
              score: 0.6,
              passed: false,
              attemptedAt: daysAgo(2),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "30d",
        });
        expect(stats.avgQuizScore).toBe(70); // (0.8 + 0.6) / 2 = 0.7 → 70%
      });

      it("excludes quiz attempts outside the time window", () => {
        const mod = testDb
          .insert(schema.modules)
          .values({ courseId: base.course.id, title: "Mod 1", position: 1 })
          .returning()
          .get();
        const lesson = testDb
          .insert(schema.lessons)
          .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
          .returning()
          .get();
        const quiz = testDb
          .insert(schema.quizzes)
          .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
          .returning()
          .get();

        testDb
          .insert(schema.quizAttempts)
          .values([
            {
              userId: base.user.id,
              quizId: quiz.id,
              score: 1.0,
              passed: true,
              attemptedAt: daysAgo(1),
            }, // within 7d
            {
              userId: base.user.id,
              quizId: quiz.id,
              score: 0.0,
              passed: false,
              attemptedAt: daysAgo(10),
            }, // outside 7d
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "7d",
        });
        expect(stats.avgQuizScore).toBe(100); // only 1.0 score → 100%
      });

      it("returns null when all attempts are outside the window", () => {
        const mod = testDb
          .insert(schema.modules)
          .values({ courseId: base.course.id, title: "Mod 1", position: 1 })
          .returning()
          .get();
        const lesson = testDb
          .insert(schema.lessons)
          .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
          .returning()
          .get();
        const quiz = testDb
          .insert(schema.quizzes)
          .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
          .returning()
          .get();

        testDb
          .insert(schema.quizAttempts)
          .values([
            {
              userId: base.user.id,
              quizId: quiz.id,
              score: 0.8,
              passed: true,
              attemptedAt: daysAgo(400),
            },
          ])
          .run();

        const stats = getCourseAnalyticsStats({
          courseId: base.course.id,
          window: "7d",
        });
        expect(stats.avgQuizScore).toBeNull();
      });
    });
  });
});
