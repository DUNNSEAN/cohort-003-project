import { Link } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCourseById } from "~/services/courseService";
import { getUserById } from "~/services/userService";
import { getCurrentUserId } from "~/lib/session";
import { UserRole } from "~/db/schema";
import {
  getCourseAnalyticsStats,
  getRevenueOverTime,
  getEnrollmentTrend,
  getQuizAnalyticsForCourse,
  getLessonDropOffFunnel,
  timeWindowSchema,
  type TimeWindow,
  type BucketRow,
  type QuizAnalyticsRow,
  type FunnelRow,
} from "~/services/analyticsService";
import { TimeWindowPicker } from "~/components/analytics/time-window-picker";
import { StatCard } from "~/components/analytics/stat-card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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
  const revenueOverTime = getRevenueOverTime({ courseIds: [courseId], window });
  const enrollmentTrend = getEnrollmentTrend({ courseIds: [courseId], window });
  const quizAnalytics = getQuizAnalyticsForCourse({ courseId, window });
  const funnelData = getLessonDropOffFunnel({ courseId, window });

  return { course, stats, window, revenueOverTime, enrollmentTrend, quizAnalytics, funnelData };
}

// clientLoader with hydrate = true prevents SSR of charts (Recharts uses browser APIs)
export async function clientLoader({
  serverLoader,
}: Route.ClientLoaderArgs) {
  return await serverLoader();
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <Skeleton className="mb-6 h-5 w-48" />
      <Skeleton className="mb-8 h-10 w-64" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <Skeleton className="mb-8 h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatRevenueLabel(cents: number): string {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`;
  return formatRevenue(cents);
}

function RevenueChart({ data }: { data: BucketRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Revenue Over Time
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatRevenueLabel}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value) => [formatRevenue(Number(value)), "Revenue"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            strokeWidth={2}
            dot={false}
            className="stroke-primary"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EnrollmentChart({ data }: { data: BucketRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Enrollment Trend
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip formatter={(value) => [Number(value), "Enrollments"]} />
          <Bar dataKey="value" className="fill-primary" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuizTable({ rows }: { rows: QuizAnalyticsRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Quiz Pass Rates
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No quiz attempts yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Quiz</th>
                <th className="pb-2 pr-4 font-medium">Lesson</th>
                <th className="pb-2 pr-4 text-right font-medium">Attempts</th>
                <th className="pb-2 pr-4 text-right font-medium">Avg Score</th>
                <th className="pb-2 text-right font-medium">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.quizId} className="border-b last:border-0">
                  <td className="py-2 pr-4">{row.quizTitle}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {row.lessonTitle}
                  </td>
                  <td className="py-2 pr-4 text-right">{row.totalAttempts}</td>
                  <td className="py-2 pr-4 text-right">{row.avgScore}%</td>
                  <td className="py-2 text-right">{row.passRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DropOffFunnel({ data }: { data: FunnelRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Lesson Drop-off Funnel
      </h2>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No lessons yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(data.length * 36, 120)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 48, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="lessonTitle"
              width={140}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip formatter={(value) => [`${value}%`, "Completion Rate"]} />
            <Bar dataKey="completionRate" radius={[0, 3, 3, 0]} className="fill-primary" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function CourseAnalytics({ loaderData }: Route.ComponentProps) {
  const { course, stats, window, revenueOverTime, enrollmentTrend, quizAnalytics, funnelData } = loaderData;
  const { totalRevenue, totalEnrollments, completionRate, avgQuizScore } = stats;

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

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <RevenueChart data={revenueOverTime} />
        <EnrollmentChart data={enrollmentTrend} />
      </div>

      <div className="mb-8">
        <QuizTable rows={quizAnalytics} />
      </div>

      <DropOffFunnel data={funnelData} />
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
