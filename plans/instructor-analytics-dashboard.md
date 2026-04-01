# Plan: Instructor Analytics Dashboard

> Source PRD: prd/instructor-analytics-dashboard.md

## Architectural decisions

- **Routes**: `/instructor` (extended with global overview), `/instructor/:courseId/analytics` (new per-course analytics page)
- **Time window**: `?window=` URL search param, validated with Valibot `picklist(["7d", "30d", "90d", "all"])`, default `"30d"`
- **Service**: New `analyticsService` using the Drizzle `db` instance (not raw `better-sqlite3`). All functions use the opts-object convention. Time-series aggregation done in SQL via `strftime`; gaps zero-filled in JS via `fillBuckets`.
- **Charts**: `recharts` (client-only). All charts wrapped in `ResponsiveContainer`. Route uses `HydrateFallback` to render `Skeleton` until hydration. Revenue → `LineChart`, Enrollment → `BarChart`, Drop-off funnel → horizontal `BarChart` (`layout="vertical"`), Quiz stats → HTML table.
- **Authorization**: Same pattern as `instructor.$courseId.students.tsx` — authenticate, verify instructor/admin role, verify course ownership.
- **Schema**: No migrations needed. All data lives in `purchases`, `enrollments`, `lessonProgress`, `quizAttempts`, `quizzes`, `lessons`, `modules`.
- **Revenue**: Stored as cents (`pricePaid`); display values divide by 100 and format as currency (e.g. `$1,234.56`).

---

## Phase 1: Per-course analytics shell with live KPI cards

**User stories**: 3, 9, 10, 11, 16, 17, 18, 19, 22

### What to build

A new read-only route at `/instructor/:courseId/analytics` that shows four KPI cards — total revenue, total enrollments, completion rate, and average quiz score — all scoped to a selected time window. A segmented `TimeWindowPicker` component updates `?window=` in the URL so the selection is bookmarkable and shareable. A `StatCard` component wraps each metric. The course editor gains an "Analytics" nav link pointing to this route. The new route is registered in `app/routes.ts`. The `analyticsService` functions powering the KPI cards have a companion test file covering happy-path aggregations, zero/empty states, and division-by-zero guards.

### Acceptance criteria

- [ ] `/instructor/:courseId/analytics` is accessible to the course's instructor and to admins; returns 403 for other roles and 404 for unknown courses
- [ ] Four KPI cards render: Total Revenue, Total Enrollments, Completion Rate, Average Quiz Score
- [ ] Each KPI card gracefully shows a zero/empty state (e.g. "$0 Revenue", "0 Enrollments") for a brand-new course
- [ ] `TimeWindowPicker` renders four segmented buttons (7d / 30d / 90d / All time) and updates `?window=` in the URL on selection
- [ ] KPI values change when a different time window is selected
- [ ] "Analytics" link appears in the course editor nav alongside the existing "Students" link
- [ ] New route is registered and loads without error
- [ ] `analyticsService` test file covers: correct aggregations, time-window filtering, zero-enrollment edge case, division-by-zero guards for completion rate and pass rate

---

## Phase 2: Per-course trend charts

**User stories**: 2, 5, 20, 24 (and the chart portion of 3)

### What to build

Add `recharts` to the project. Extend the per-course analytics page with two charts below the KPI cards: a `LineChart` for revenue over time and a `BarChart` for enrollment trend. Revenue buckets use daily granularity for the 7d and 30d windows and weekly granularity for 90d and all time. Gaps in the time series (days or weeks with zero activity) are filled by a `fillBuckets` utility so the charts always render a continuous axis. Because Recharts uses browser APIs, charts are excluded from SSR; the route's `HydrateFallback` export renders `Skeleton` placeholders until client hydration completes. Tests cover `fillBuckets` for all four windows and verify zero-filled buckets appear for days with no activity.

### Acceptance criteria

- [ ] `recharts` is installed and the charts render without SSR errors
- [ ] Revenue `LineChart` appears on the per-course analytics page
- [ ] Enrollment `BarChart` appears on the per-course analytics page
- [ ] Revenue chart uses daily buckets for 7d/30d and weekly buckets for 90d/all time
- [ ] Both charts update when the time window is changed
- [ ] Days or weeks with zero activity show as zero-value data points (no gaps in the axis)
- [ ] A `Skeleton` loading state is shown while the page hydrates on the client
- [ ] `fillBuckets` is tested: generates all expected keys for each window, zero-fills gaps, handles an empty input

---

## Phase 3: Per-course quiz analytics and lesson drop-off funnel

**User stories**: 12, 13, 14, 15, 21, 23

### What to build

Add two more sections to the per-course analytics page. First, a quiz pass rates HTML table showing each quiz in the course with its lesson name, total attempts, average score, and pass rate (displayed as whole-number percentages). Second, a lesson drop-off funnel rendered as a horizontal `BarChart` listing each lesson in module/lesson position order, where the bar length represents the percentage of enrolled students (cohort scoped to the selected time window) who completed that lesson. Both sections respect the `?window=` filter. Tests cover: correct pass rates per quiz, empty array for a course with no attempts, funnel ordering, correct completion-rate proportions, and zero-enrollment funnel (all rates = 0).

### Acceptance criteria

- [ ] Quiz analytics table renders: quiz name, lesson name, total attempts, average score, pass rate
- [ ] Pass rates display as whole-number percentages (e.g. "72%")
- [ ] Table shows an empty/zero state for a course with no quiz attempts
- [ ] Lesson drop-off funnel renders as a horizontal bar chart in correct module/lesson sequence
- [ ] Funnel denominator is the count of students enrolled within the selected time window
- [ ] A lesson no student completed shows 0% completion rate (not NaN or undefined)
- [ ] A course with zero enrollments in the window renders without error (all rates = 0)
- [ ] Both sections update when the time window is changed
- [ ] Service tests cover all edge cases listed above

---

## Phase 4: Global overview extension

**User stories**: 1, 4, 6, 7, 8

### What to build

Extend the existing `/instructor` dashboard page to include a global overview above the existing course list. A row of KPI cards shows total revenue, total enrollments, and overall completion rate aggregated across all of the instructor's courses and scoped to the selected time window. A `TimeWindowPicker` on this page updates `?window=` in the URL. Below the KPI cards, a per-course summary table lists each course with its individual revenue, enrollment count, and completion rate, with a link from each row to that course's per-course analytics page. Revenue and enrollment trend charts (reusing the same chart components from Phase 2) visualise the aggregated global trends.

### Acceptance criteria

- [ ] `/instructor` displays KPI cards for total revenue, total enrollments, and overall completion rate
- [ ] `TimeWindowPicker` on the global overview updates `?window=` and re-scopes all KPI values
- [ ] Per-course summary table shows each course's individual revenue, enrollments, and completion rate
- [ ] Each row in the summary table links to `/instructor/:courseId/analytics`
- [ ] Global revenue `LineChart` and enrollment `BarChart` render and respect the time window filter
- [ ] All values gracefully display zero/empty states for instructors with no purchases or enrollments
- [ ] Existing course list and page behaviour are unchanged
