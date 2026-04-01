# PRD: Instructor Analytics Dashboard

## Context

Instructors currently have no visibility into how their courses perform financially or educationally beyond a basic enrollment count. They can see individual student quiz scores in the student roster but have no aggregated metrics. This PRD defines an analytics dashboard so instructors can understand revenue trends, enrollment growth, course completion rates, quiz health, and where students abandon the course.

The PRD will be submitted as a GitHub issue using `gh issue create`.

---

## PRD Content (GitHub Issue Body)

### Problem Statement

Instructors on the platform have no way to understand how their courses are performing over time. They cannot see how much revenue their courses have generated, whether enrollment is growing or declining, how many students actually finish the course, whether quizzes are appropriately difficult, or at which lesson students tend to give up. This lack of visibility prevents instructors from making informed decisions about pricing, content improvement, or marketing.

---

### Solution

Build a two-level analytics dashboard in the instructor area:

1. **Global Overview** (`/instructor`) — aggregated KPIs across all of an instructor's courses: total revenue, total enrollments, overall completion rate, and a per-course summary table with trend charts (revenue and enrollments over time).
2. **Per-Course Analytics** (`/instructor/:courseId/analytics`) — deep-dive metrics for a single course: KPI cards, revenue-over-time chart, enrollment trend chart, quiz pass rates table, and a lesson drop-off funnel.

Both views support a **time window filter** (7 days / 30 days / 90 days / All time) to scope trends.

---

### User Stories

1. As an instructor, I want to see my total revenue across all courses so that I can understand my overall earnings.
2. As an instructor, I want to see a revenue trend chart over time so that I can identify whether sales are growing, declining, or seasonal.
3. As an instructor, I want to filter analytics by a time window (7d / 30d / 90d / All time) so that I can compare short-term and long-term performance.
4. As an instructor, I want to see total enrollment counts across all my courses so that I can understand my overall audience size.
5. As an instructor, I want to see how many students enrolled per day or week in a chart so that I can evaluate the impact of promotions or price changes.
6. As an instructor, I want to see an overall course completion rate so that I can know if students are finishing what they started.
7. As an instructor, I want to see a per-course summary table on the global overview so that I can quickly compare course performance side by side.
8. As an instructor, I want to navigate from the global overview to per-course analytics for any course so that I can drill down without leaving the instructor area.
9. As an instructor, I want to see total revenue for a single course so that I understand that course's individual contribution.
10. As an instructor, I want to see the completion rate for a single course so that I know if my content is engaging enough to retain students through the end.
11. As an instructor, I want to see the average quiz score across all quizzes in a course so that I can gauge overall student understanding.
12. As an instructor, I want to see a table of each quiz in a course showing: quiz name, lesson name, total attempts, average score, and pass rate so that I can identify which quizzes are too hard or too easy.
13. As an instructor, I want to see a lesson drop-off funnel showing the percentage of enrolled students who completed each lesson in order so that I can identify where students abandon the course.
14. As an instructor, I want the drop-off funnel to show lessons in their correct module/lesson sequence so that the funnel accurately represents the learning path.
15. As an instructor, I want to see a completion rate for each lesson individually so that I can identify specific content that causes high drop-off.
16. As an instructor, I want the analytics time window filter to be persistent in the URL so that I can share or bookmark a specific analytics view.
17. As an instructor, I want to access per-course analytics from within the course editor via an "Analytics" navigation link so that I can move between editing and analytics without searching.
18. As an instructor, I want to see a KPI card for total revenue (scoped to the selected time window) on the per-course analytics page so that I can see recent revenue at a glance.
19. As an instructor, I want to see a KPI card for total enrollments on the per-course analytics page so that I can see recent student acquisition.
20. As an instructor, I want the revenue chart on the per-course page to use daily buckets for the 7d and 30d windows and weekly buckets for 90d and all time so that the chart is readable at each granularity.
21. As an instructor, I want the drop-off funnel to base its denominator on students who enrolled within the selected time window so that the funnel reflects a cohort of students, not all-time students.
22. As an instructor, I want KPI cards to gracefully display zero/empty states (e.g., "$0 Revenue", "0 Enrollments") so that a brand-new course does not show broken or undefined values.
23. As an instructor, I want quiz pass rate percentages to be shown as whole-number percentages (e.g., "72%") so that the data is easy to read at a glance.
24. As an instructor, I want the analytics page to show a loading skeleton while chart data hydrates on the client so that the page does not flash or break on first load.

---

### Implementation Decisions

#### New Service: `analyticsService`

A single new service (`analyticsService`) encapsulates all analytics aggregation logic. It uses the Drizzle ORM `db` instance (not raw SQLite) so it is mockable in tests. It does **not** reuse `quizScoringService` which uses a raw `better-sqlite3` connection.

All functions follow the opts-object convention: `fn(opts: { ... })`.

Key exported functions:
- `getGlobalOverviewStats(opts: { instructorId, window })` — KPI cards for the global overview
- `getCourseOverviewRows(opts: { instructorId, window })` — per-course summary table rows
- `getRevenueOverTime(opts: { courseIds, window })` — bucketed revenue data for line chart
- `getEnrollmentTrend(opts: { courseIds, window })` — bucketed enrollment data for bar chart
- `getCourseAnalyticsStats(opts: { courseId, window })` — KPI cards for per-course view
- `getQuizAnalyticsForCourse(opts: { courseId, window })` — per-quiz stats table rows
- `getLessonDropOffFunnel(opts: { courseId, window })` — ordered lesson completion rates
- `fillBuckets(rows, window)` — fills zero-value buckets for date gaps (exported, tested separately)

Time-series data is aggregated in SQL using `strftime` group-by (not in JavaScript) to avoid loading thousands of raw rows into the server process. Gaps (days/weeks with zero activity) are filled in JavaScript post-processing via `fillBuckets`.

#### Route Structure

- **Global overview:** Extend existing `app/routes/instructor.tsx`. Loader gains `window` query param (default `"30d"`). Page gains KPI cards, two trend charts, and a per-course summary table.
- **Per-course analytics:** New route `app/routes/instructor.$courseId.analytics.tsx` at `/instructor/:courseId/analytics`. Loader fetches all five data shapes. Read-only (no actions).
- Register the new route in `app/routes.ts`.

#### No Schema Migration Required

All needed data exists in current tables: `purchases`, `enrollments`, `lessonProgress`, `quizAttempts`, `lessons`, `modules`.

#### Recharts

Add `recharts` as a new dependency. Charts must be wrapped in `ResponsiveContainer`. They must not render on the server (Recharts uses browser APIs); use the route's `HydrateFallback` export to show a `Skeleton` until client hydration.

Chart assignments:
- Revenue over time → `LineChart`
- Enrollment trend → `BarChart`
- Lesson drop-off funnel → horizontal `BarChart` (`layout="vertical"`)
- Quiz pass rates → HTML table (not a chart)

#### Drop-Off Funnel Logic

The funnel denominator is the count of enrolled students within the selected time window (filtered by `enrolledAt`). The numerator per lesson is the count of `lessonProgress` rows with `status = 'completed'` for enrolled students in that cohort. Results are ordered by `modules.position ASC, lessons.position ASC`.

#### Time Window Filter

A `TimeWindowPicker` shared component renders four segmented buttons. Selection updates the `?window=` URL search param via React Router `Link`. The `window` param is validated with Valibot `v.picklist(["7d", "30d", "90d", "all"])`, defaulting to `"30d"`.

#### Authorization

New routes follow the same pattern as `instructor.$courseId.students.tsx`: authenticate user, verify instructor/admin role, verify course ownership.

#### Navigation

- Add "Analytics" link in the course editor nav area (alongside existing "Students" link) pointing to `/instructor/:courseId/analytics`.

#### New Components

- `app/components/analytics/time-window-picker.tsx` — segmented control for time window
- `app/components/analytics/stat-card.tsx` — KPI card wrapping shadcn `Card`

---

### Testing Decisions

**What makes a good test:** Tests should verify the external behavior of service functions (what they return given specific DB state), not implementation details. Tests should not mock the database; they should use the in-memory SQLite test DB via the project's existing `createTestDb()` + `seedBaseData()` pattern from `app/test/setup.ts`.

**Module to test:** `analyticsService` — this is a service file and requires a `.test.ts` companion per the project convention.

**Test file:** `app/services/analyticsService.test.ts`

**Key behaviors to test:**
- Revenue buckets sum `pricePaid` correctly and exclude purchases outside the time window
- Zero-filled buckets appear for days/weeks with no activity
- Enrollment trend counts only new enrollments within the window
- Quiz analytics return correct `avgScore` and `passRate` per quiz
- Quiz analytics return empty array for a course with no quiz attempts
- Drop-off funnel returns lessons in module/lesson position order
- Drop-off funnel `completionRate` is 0 for lessons no student completed, and correct proportions otherwise
- Drop-off funnel handles a course with zero enrollments (all rates = 0)
- `fillBuckets` generates all daily keys for a 7d window with correct zero-filling
- Division-by-zero guards: completion rate and pass rate return `0` (not `NaN`) when denominator is zero

**Test data:** Seed explicit `createdAt`/`enrolledAt` values (ISO strings) to test time-window filtering. Drizzle allows passing `createdAt` explicitly on insert even when a `$defaultFn` is defined.

**Prior art:** `app/services/enrollmentService.test.ts`, `app/services/purchaseService.test.ts`

---

### Out of Scope

- CSV/Excel export of analytics data
- Admin-level analytics across all instructors
- Custom date range picker (only the four preset windows)
- Video watch-time analytics (video events exist in DB but are not surfaced here)
- Revenue breakdown by country (PPP pricing data not surfaced)
- Student-level drill-down from the analytics page (already exists at `/instructor/:courseId/students`)
- Email reports or scheduled analytics digests
- Comparison mode (comparing one time window against a prior period)
- A/B testing analytics

---

### Further Notes

- Revenue is stored in cents (`pricePaid` integer). All display values should divide by 100 and format as currency (e.g., `$1,234.56`).
- The project has no timezone handling; all date bucketing is UTC. This is acceptable for the current stage.
- The existing `instructor.$courseId.students.tsx` student roster page already shows per-student quiz scores. The new per-course analytics quiz table complements this with aggregate/population-level data.
- The `quizScoringService.ts` file uses `rawDb` (direct `better-sqlite3` connection). The new analytics service must **not** import from it; all analytics queries use the Drizzle `db` instance.
- All instructor functions in existing services (`getCoursesByInstructor`, `getPurchasesByCourse`, `getEnrollmentsByCourse`) remain unchanged; the new `analyticsService` composes new aggregate queries independently.

---

## Execution Plan

1. Install `recharts` dependency
2. Write `analyticsService.ts` + `analyticsService.test.ts` (all query logic validated against in-memory DB)
3. Create `TimeWindowPicker` + `StatCard` components
4. Create `instructor.$courseId.analytics.tsx` route (per-course analytics page)
5. Extend `instructor.tsx` loader + page with global overview stats
6. Add "Analytics" link in course editor nav (`instructor.$courseId.tsx`)
7. Register new route in `app/routes.ts`

## Critical Files

- `app/services/analyticsService.ts` — new (all analytics queries)
- `app/services/analyticsService.test.ts` — new (service tests)
- `app/routes/instructor.$courseId.analytics.tsx` — new (per-course analytics page)
- `app/components/analytics/time-window-picker.tsx` — new
- `app/components/analytics/stat-card.tsx` — new
- `app/routes/instructor.tsx` — modified (global overview extension)
- `app/routes/instructor.$courseId.tsx` — modified (add Analytics nav link)
- `app/routes.ts` — modified (register new route)
- `package.json` — modified (add recharts)
- `app/test/setup.ts` — reference only (test scaffolding pattern)
- `app/db/schema.ts` — reference only (no changes needed)
