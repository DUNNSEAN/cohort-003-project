import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/courses.$slug.lessons.$lessonId";
import { getCourseBySlug, getCourseWithDetails } from "~/services/courseService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import { getCurrentUserId } from "~/lib/session";
import { isUserEnrolled } from "~/services/enrollmentService";
import {
  getLessonProgress,
  markLessonComplete,
  markLessonInProgress,
} from "~/services/progressService";
import { LessonProgressStatus } from "~/db/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  PlayCircle,
} from "lucide-react";
import { data } from "react-router";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson?.title ?? "Lesson";
  const courseTitle = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} — ${courseTitle} — Ralph` },
  ];
}

type FlatLesson = {
  id: number;
  title: string;
  moduleId: number;
  moduleTitle: string;
};

function flattenCourseLessons(course: {
  modules: Array<{
    id: number;
    title: string;
    lessons: Array<{ id: number; title: string; moduleId: number }>;
  }>;
}): FlatLesson[] {
  const flat: FlatLesson[] = [];
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      flat.push({
        id: lesson.id,
        title: lesson.title,
        moduleId: mod.id,
        moduleTitle: mod.title,
      });
    }
  }
  return flat;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const slug = params.slug;
  const lessonId = Number(params.lessonId);

  if (isNaN(lessonId)) {
    throw data("Invalid lesson ID", { status: 400 });
  }

  const course = getCourseBySlug(slug);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const courseWithDetails = getCourseWithDetails(course.id);
  if (!courseWithDetails) {
    throw data("Course not found", { status: 404 });
  }

  const lesson = getLessonById(lessonId);
  if (!lesson) {
    throw data("Lesson not found", { status: 404 });
  }

  const mod = getModuleById(lesson.moduleId);
  if (!mod) {
    throw data("Module not found", { status: 404 });
  }

  // Verify lesson belongs to this course
  if (mod.courseId !== course.id) {
    throw data("Lesson not found in this course", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  let enrolled = false;
  let lessonStatus: string | null = null;

  if (currentUserId) {
    enrolled = isUserEnrolled(currentUserId, course.id);

    if (enrolled) {
      // Mark lesson as in-progress when viewed
      markLessonInProgress(currentUserId, lessonId);
      const progress = getLessonProgress(currentUserId, lessonId);
      lessonStatus = progress?.status ?? null;
    }
  }

  // Build prev/next navigation
  const allLessons = flattenCourseLessons(courseWithDetails);
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  return {
    course: {
      id: courseWithDetails.id,
      title: courseWithDetails.title,
      slug: courseWithDetails.slug,
    },
    module: {
      id: mod.id,
      title: mod.title,
    },
    lesson,
    lessonStatus,
    enrolled,
    currentUserId,
    prevLesson,
    nextLesson,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const slug = params.slug;
  const lessonId = Number(params.lessonId);

  if (isNaN(lessonId)) {
    throw data("Invalid lesson ID", { status: 400 });
  }

  const course = getCourseBySlug(slug);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("You must be logged in", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark-complete") {
    markLessonComplete(currentUserId, lessonId);
    return { success: true };
  }

  throw data("Invalid action", { status: 400 });
}

export default function LessonViewer({ loaderData }: Route.ComponentProps) {
  const {
    course,
    module: mod,
    lesson,
    lessonStatus,
    enrolled,
    currentUserId,
    prevLesson,
    nextLesson,
  } = loaderData;
  const fetcher = useFetcher();
  const isMarking = fetcher.state !== "idle";

  const isCompleted =
    lessonStatus === LessonProgressStatus.Completed ||
    fetcher.data?.success;

  return (
    <div className="p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/courses/${course.slug}`} className="hover:text-foreground">
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-muted-foreground">{mod.title}</span>
        <span className="mx-2">/</span>
        <span className="text-foreground">{lesson.title}</span>
      </nav>

      <div className="mx-auto max-w-4xl">
        {/* Lesson Title */}
        <h1 className="mb-2 text-3xl font-bold">{lesson.title}</h1>
        {lesson.durationMinutes && (
          <div className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {lesson.durationMinutes} min
          </div>
        )}

        {/* YouTube Video */}
        {lesson.videoUrl && (
          <div className="mb-8 aspect-video overflow-hidden rounded-lg">
            <iframe
              src={toYouTubeEmbedUrl(lesson.videoUrl)}
              title={lesson.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Lesson Content */}
        {lesson.contentHtml && (
          <div
            className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
          />
        )}

        {!lesson.contentHtml && !lesson.videoUrl && (
          <Card className="mb-8">
            <CardContent className="py-12 text-center text-muted-foreground">
              No content has been added to this lesson yet.
            </CardContent>
          </Card>
        )}

        {/* Mark Complete */}
        {enrolled && currentUserId && (
          <div className="mb-8">
            {isCompleted ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="size-5" />
                <span className="font-medium">Lesson completed</span>
              </div>
            ) : (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="mark-complete" />
                <Button disabled={isMarking}>
                  <CheckCircle2 className="mr-2 size-4" />
                  {isMarking ? "Marking..." : "Mark as Complete"}
                </Button>
              </fetcher.Form>
            )}
          </div>
        )}

        {/* Prev/Next Navigation */}
        <div className="flex items-center justify-between border-t pt-6">
          {prevLesson ? (
            <Link
              to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
              className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground"
            >
              <ChevronLeft className="size-4" />
              <div>
                <div className="text-xs text-muted-foreground">
                  Previous
                </div>
                <div className="font-medium text-foreground">
                  {prevLesson.title}
                </div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <Link
              to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
              className="flex items-center gap-2 text-right text-sm hover:text-foreground text-muted-foreground"
            >
              <div>
                <div className="text-xs text-muted-foreground">
                  Next
                </div>
                <div className="font-medium text-foreground">
                  {nextLesson.title}
                </div>
              </div>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <Link
              to={`/courses/${course.slug}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <div>
                <div className="text-xs text-muted-foreground">
                  Back to
                </div>
                <div className="font-medium text-foreground">
                  {course.title}
                </div>
              </div>
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Converts various YouTube URL formats to an embeddable URL.
 * Returns the original string if it doesn't match a known YouTube pattern.
 */
function toYouTubeEmbedUrl(url: string): string {
  // Already an embed URL
  if (url.includes("youtube.com/embed/")) return url;

  // https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/
  );
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  // https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  return url;
}
