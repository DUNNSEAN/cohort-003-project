import { Link } from "react-router";
import type { Route } from "./+types/instructor";
import { getCoursesByInstructor, getLessonCountForCourse } from "~/services/courseService";
import { getEnrollmentCountForCourse } from "~/services/enrollmentService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, BookOpen, GraduationCap, Plus, Users } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { data, isRouteErrorResponse } from "react-router";
import { CourseStatus, UserRole } from "~/db/schema";
import {
  getGlobalOverviewStats,
  getCourseOverviewRows,
  getRevenueOverTime,
  getEnrollmentTrend,
  timeWindowSchema,
  type TimeWindow,
  type BucketRow,
  type CourseOverviewRow,
} from "~/services/analyticsService";
import { TimeWindowPicker } from "~/components/analytics/time-window-picker";
import { StatCard } from "~/components/analytics/stat-card";
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
} from "recharts";

export function meta() {
  return [
    { title: "My Courses — Cadence" },
    { name: "description", content: "Manage your courses" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view your courses.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access this page.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const rawWindow = url.searchParams.get("window") ?? "30d";
  const window = v.parse(v.fallback(timeWindowSchema, "30d"), rawWindow) as TimeWindow;

  const instructorCourses = getCoursesByInstructor(currentUserId);

  const coursesWithStats = instructorCourses.map((course) => {
    const lessonCount = getLessonCountForCourse(course.id);
    const enrollmentCount = getEnrollmentCountForCourse(course.id);

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      status: course.status,
      coverImageUrl: course.coverImageUrl,
      lessonCount,
      enrollmentCount,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  });

  const courseIds = instructorCourses.map((c) => c.id);

  const globalStats = getGlobalOverviewStats({ instructorId: currentUserId, window });
  const courseOverviewRows = getCourseOverviewRows({ instructorId: currentUserId, window });
  const revenueOverTime = getRevenueOverTime({ courseIds, window });
  const enrollmentTrend = getEnrollmentTrend({ courseIds, window });

  return { courses: coursesWithStats, window, globalStats, courseOverviewRows, revenueOverTime, enrollmentTrend };
}

// clientLoader with hydrate = true prevents SSR of Recharts components
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  return await serverLoader();
}
clientLoader.hydrate = true;

function statusBadge(status: string) {
  switch (status) {
    case CourseStatus.Published:
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Published
        </span>
      );
    case CourseStatus.Draft:
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Draft
        </span>
      );
    case CourseStatus.Archived:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
          Archived
        </span>
      );
    default:
      return null;
  }
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

function GlobalRevenueChart({ data }: { data: BucketRow[] }) {
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

function GlobalEnrollmentChart({ data }: { data: BucketRow[] }) {
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

function CourseOverviewTable({ rows }: { rows: CourseOverviewRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Course Summary
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Course</th>
              <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
              <th className="pb-2 pr-4 text-right font-medium">Enrollments</th>
              <th className="pb-2 pr-4 text-right font-medium">Completion</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.courseId} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{row.courseTitle}</td>
                <td className="py-2 pr-4 text-right">
                  {formatRevenue(row.totalRevenue)}
                </td>
                <td className="py-2 pr-4 text-right">{row.totalEnrollments}</td>
                <td className="py-2 pr-4 text-right">{row.completionRate}%</td>
                <td className="py-2 text-right">
                  <Link
                    to={`/instructor/${row.courseId}/analytics`}
                    className="text-xs text-primary hover:underline"
                  >
                    View analytics
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <Skeleton className="mb-8 h-48 w-full rounded-xl" />
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <Skeleton className="aspect-video rounded-b-none rounded-t-lg" />
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InstructorDashboard({
  loaderData,
}: Route.ComponentProps) {
  const { courses, window, globalStats, courseOverviewRows, revenueOverTime, enrollmentTrend } = loaderData;
  const { totalRevenue, totalEnrollments, completionRate } = globalStats;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">My Courses</span>
      </nav>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your courses and track enrollments
          </p>
        </div>
        <Link to="/instructor/new">
          <Button>
            <Plus className="mr-2 size-4" />
            New Course
          </Button>
        </Link>
      </div>

      {courses.length > 0 && (
        <>
          {/* Global analytics overview */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Overview</h2>
            <TimeWindowPicker current={window} />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard title="Total Revenue" value={formatRevenue(totalRevenue)} />
            <StatCard title="Total Enrollments" value={String(totalEnrollments)} />
            <StatCard title="Completion Rate" value={`${completionRate}%`} />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <GlobalRevenueChart data={revenueOverTime} />
            <GlobalEnrollmentChart data={enrollmentTrend} />
          </div>

          <div className="mb-10">
            <CourseOverviewTable rows={courseOverviewRows} />
          </div>

          <h2 className="mb-4 text-lg font-semibold">All Courses</h2>
        </>
      )}

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GraduationCap className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No courses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first course to get started.
          </p>
          <Link to="/instructor/new" className="mt-4">
            <Button>
              <Plus className="mr-2 size-4" />
              Create Course
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col overflow-hidden pt-0">
              <Link to={`/courses/${course.slug}`} className="aspect-video overflow-hidden">
                <CourseImage
                  src={course.coverImageUrl}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </Link>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/courses/${course.slug}`}
                    className="text-lg font-semibold leading-tight hover:text-primary"
                  >
                    {course.title}
                  </Link>
                  {statusBadge(course.status)}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {course.description}
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-4" />
                    <span>
                      {course.lessonCount}{" "}
                      {course.lessonCount === 1 ? "lesson" : "lessons"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="size-4" />
                    <span>
                      {course.enrollmentCount}{" "}
                      {course.enrollmentCount === 1 ? "student" : "students"}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Link to={`/instructor/${course.id}`} className="w-full">
                  <Button className="w-full" variant="outline">
                    <BookOpen className="mr-2 size-4" />
                    Edit Course
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading your courses.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
