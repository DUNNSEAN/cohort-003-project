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
import {
  getCourseAnalyticsStats,
  getRevenueOverTime,
  getEnrollmentTrend,
  fillBuckets,
} from "./analyticsService";

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

describe("fillBuckets", () => {
  it("generates all 7 daily keys for a 7d window", () => {
    const result = fillBuckets([], "7d");
    expect(result).toHaveLength(7);
    // All values should be 0
    expect(result.every((r) => r.value === 0)).toBe(true);
    // Keys should be consecutive YYYY-MM-DD strings ending today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expectedLast = today.toISOString().slice(0, 10);
    expect(result[result.length - 1].bucket).toBe(expectedLast);
    // Keys should be in ascending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i].bucket > result[i - 1].bucket).toBe(true);
    }
  });

  it("generates all 30 daily keys for a 30d window", () => {
    const result = fillBuckets([], "30d");
    expect(result).toHaveLength(30);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it("zero-fills gaps — days with no activity appear with value 0", () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const key = yesterday.toISOString().slice(0, 10);
    const result = fillBuckets([{ bucket: key, value: 500 }], "7d");
    expect(result).toHaveLength(7);
    const yesterdayEntry = result.find((r) => r.bucket === key);
    expect(yesterdayEntry?.value).toBe(500);
    // All other entries should be 0
    const others = result.filter((r) => r.bucket !== key);
    expect(others.every((r) => r.value === 0)).toBe(true);
  });

  it("uses the row value when bucket exists", () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const key = today.toISOString().slice(0, 10);
    const result = fillBuckets([{ bucket: key, value: 1234 }], "7d");
    expect(result.find((r) => r.bucket === key)?.value).toBe(1234);
  });

  it("generates weekly keys for a 90d window", () => {
    const result = fillBuckets([], "90d");
    // 90 days = ~13 weeks
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(14);
    expect(result.every((r) => r.value === 0)).toBe(true);
    // Keys should match YYYY-WW format
    for (const r of result) {
      expect(r.bucket).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("returns empty array for 'all' window with no rows", () => {
    expect(fillBuckets([], "all")).toEqual([]);
  });

  it("generates weekly keys for 'all' window from earliest row to today", () => {
    // Create a row from ~3 weeks ago
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setUTCDate(threeWeeksAgo.getUTCDate() - 21);
    threeWeeksAgo.setUTCHours(0, 0, 0, 0);
    // Find the Monday of that week to compute its week key
    const dayOffset = (threeWeeksAgo.getUTCDay() + 6) % 7;
    const monday = new Date(threeWeeksAgo);
    monday.setUTCDate(monday.getUTCDate() - dayOffset);
    const year = monday.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Mon = (jan1.getUTCDay() + 6) % 7;
    const firstMondayYday = (7 - jan1Mon) % 7;
    const yday = Math.floor((monday.getTime() - jan1.getTime()) / 86400000);
    const week =
      yday < firstMondayYday ? 0 : Math.floor((yday - firstMondayYday) / 7) + 1;
    const weekKey = `${year}-${String(week).padStart(2, "0")}`;

    const result = fillBuckets([{ bucket: weekKey, value: 999 }], "all");
    expect(result.length).toBeGreaterThanOrEqual(3);
    const entry = result.find((r) => r.bucket === weekKey);
    expect(entry?.value).toBe(999);
  });
});

describe("getRevenueOverTime", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("returns zero-filled daily buckets for 7d window with no purchases", () => {
    const result = getRevenueOverTime({ courseId: base.course.id, window: "7d" });
    expect(result).toHaveLength(7);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it("sums pricePaid into the correct daily bucket", () => {
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
          createdAt: daysAgo(1),
        },
      ])
      .run();

    const result = getRevenueOverTime({ courseId: base.course.id, window: "7d" });
    expect(result).toHaveLength(7);
    // Two purchases on the same day should sum to 3000
    const total = result.reduce((sum, r) => sum + r.value, 0);
    expect(total).toBe(3000);
  });

  it("excludes purchases outside the time window", () => {
    testDb
      .insert(schema.purchases)
      .values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 500,
          createdAt: daysAgo(1),
        },
        {
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 9999,
          createdAt: daysAgo(10), // outside 7d
        },
      ])
      .run();

    const result = getRevenueOverTime({ courseId: base.course.id, window: "7d" });
    const total = result.reduce((sum, r) => sum + r.value, 0);
    expect(total).toBe(500);
  });

  it("uses weekly buckets for 90d window", () => {
    const result = getRevenueOverTime({ courseId: base.course.id, window: "90d" });
    // Weekly: ~13 weeks
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(14);
    // Keys should be YYYY-WW
    for (const r of result) {
      expect(r.bucket).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("returns empty array for 'all' window with no purchases", () => {
    const result = getRevenueOverTime({ courseId: base.course.id, window: "all" });
    expect(result).toEqual([]);
  });
});

describe("getEnrollmentTrend", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("returns zero-filled daily buckets for 7d window with no enrollments", () => {
    const result = getEnrollmentTrend({ courseId: base.course.id, window: "7d" });
    expect(result).toHaveLength(7);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it("counts enrollments in the correct daily bucket", () => {
    const user2 = testDb
      .insert(schema.users)
      .values({ name: "User 2", email: "u2@test.com", role: schema.UserRole.Student })
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
          enrolledAt: daysAgo(1),
        },
      ])
      .run();

    const result = getEnrollmentTrend({ courseId: base.course.id, window: "7d" });
    const total = result.reduce((sum, r) => sum + r.value, 0);
    expect(total).toBe(2);
  });

  it("excludes enrollments outside the time window", () => {
    testDb
      .insert(schema.enrollments)
      .values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(1),
        },
        {
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(10), // outside 7d
        },
      ])
      .run();

    const result = getEnrollmentTrend({ courseId: base.course.id, window: "7d" });
    const total = result.reduce((sum, r) => sum + r.value, 0);
    expect(total).toBe(1);
  });

  it("uses weekly buckets for 90d window", () => {
    const result = getEnrollmentTrend({ courseId: base.course.id, window: "90d" });
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(14);
    for (const r of result) {
      expect(r.bucket).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("returns empty array for 'all' window with no enrollments", () => {
    const result = getEnrollmentTrend({ courseId: base.course.id, window: "all" });
    expect(result).toEqual([]);
  });
});
