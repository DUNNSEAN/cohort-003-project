import { Link } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCourseById } from "~/services/courseService";
import { getUserById } from "~/services/userService";
import { getCurrentUserId } from "~/lib/session";
import { UserRole } from "~/db/schema";
import {
  getCourseAnalyticsStats,
  timeWindowSchema,
  type TimeWindow,
} from "~/services/analyticsService";
import { TimeWindowPicker } from "~/components/analytics/time-window-picker";
import { StatCard } from "~/components/analytics/stat-card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Analytics";
  return [
    { title: `Analytics: ${title} — Cadence` },
    { name: "description", content: `Analytics for ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseById(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only view analytics for your own courses.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const rawWindow = url.searchParams.get("window") ?? "30d";
  const window = v.parse(
    v.fallback(timeWindowSchema, "30d"),
    rawWindow
  ) as TimeWindow;

  const stats = getCourseAnalyticsStats({ courseId, window });

  return { course, stats, window };
}

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function CourseAnalytics({ loaderData }: Route.ComponentProps) {
  const { course, stats, window } = loaderData;
  const { totalRevenue, totalEnrollments, completionRate, avgQuizScore } =
    stats;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}`}
          className="hover:text-foreground"
        >
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <Link
        to={`/instructor/${course.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Course Editor
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">{course.title}</p>
        </div>
        <TimeWindowPicker current={window} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value={formatRevenue(totalRevenue)} />
        <StatCard
          title="Total Enrollments"
          value={String(totalEnrollments)}
        />
        <StatCard title="Completion Rate" value={`${completionRate}%`} />
        <StatCard
          title="Avg Quiz Score"
          value={avgQuizScore !== null ? `${avgQuizScore}%` : "—"}
        />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message =
    "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to view this page.";
    } else {
      title = `Error ${error.status}`;
      message =
        typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
