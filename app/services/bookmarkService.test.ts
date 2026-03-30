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
  isLessonBookmarked,
  toggleBookmark,
  getBookmarkedLessonIds,
} from "./bookmarkService";

describe("bookmarkService", () => {
  let module: typeof schema.modules.$inferSelect;
  let lesson: typeof schema.lessons.$inferSelect;

  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    module = testDb
      .insert(schema.modules)
      .values({ title: "Module 1", courseId: base.course.id, position: 1 })
      .returning()
      .get();

    lesson = testDb
      .insert(schema.lessons)
      .values({ title: "Lesson 1", moduleId: module.id, position: 1 })
      .returning()
      .get();
  });

  describe("isLessonBookmarked", () => {
    it("returns false when lesson is not bookmarked", () => {
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });

    it("returns true when lesson is bookmarked", () => {
      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.user.id, lessonId: lesson.id })
        .run();

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(true);
    });

    it("returns false for a different user's bookmark", () => {
      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.instructor.id, lessonId: lesson.id })
        .run();

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists and returns bookmarked: true", () => {
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: true });
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(true);
    });

    it("removes a bookmark when one exists and returns bookmarked: false", () => {
      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.user.id, lessonId: lesson.id })
        .run();

      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: false });
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });

    it("toggling twice removes the bookmark", () => {
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when user has no bookmarks", () => {
      expect(
        getBookmarkedLessonIds({
          userId: base.user.id,
          courseId: base.course.id,
        })
      ).toEqual([]);
    });

    it("returns bookmarked lesson ids for a course", () => {
      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.user.id, lessonId: lesson.id })
        .run();

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([lesson.id]);
    });

    it("does not return bookmarks from a different course", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const otherModule = testDb
        .insert(schema.modules)
        .values({ title: "Other Module", courseId: otherCourse.id, position: 1 })
        .returning()
        .get();

      const otherLesson = testDb
        .insert(schema.lessons)
        .values({ title: "Other Lesson", moduleId: otherModule.id, position: 1 })
        .returning()
        .get();

      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.user.id, lessonId: otherLesson.id })
        .run();

      expect(
        getBookmarkedLessonIds({
          userId: base.user.id,
          courseId: base.course.id,
        })
      ).toEqual([]);
    });

    it("returns multiple bookmarked lessons for a course", () => {
      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ title: "Lesson 2", moduleId: module.id, position: 2 })
        .returning()
        .get();

      testDb
        .insert(schema.lessonBookmarks)
        .values([
          { userId: base.user.id, lessonId: lesson.id },
          { userId: base.user.id, lessonId: lesson2.id },
        ])
        .run();

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toHaveLength(2);
      expect(ids).toContain(lesson.id);
      expect(ids).toContain(lesson2.id);
    });

    it("does not return bookmarks from a different user", () => {
      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.instructor.id, lessonId: lesson.id })
        .run();

      expect(
        getBookmarkedLessonIds({
          userId: base.user.id,
          courseId: base.course.id,
        })
      ).toEqual([]);
    });
  });
});
