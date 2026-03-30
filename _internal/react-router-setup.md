# React Router Setup

## Overview

This project uses **React Router v7.12.0** with SSR enabled, Vite as the build tool, and an explicit route configuration (not automatic file-based routing).

---

## Build & Configuration

### `react-router.config.ts`
- SSR enabled (`ssr: true`)
- Minimal config, relies on explicit route definitions

### `vite.config.ts`
- Uses `@react-router/dev/vite` plugin
- Includes Tailwind CSS and TypeScript path resolution

### `package.json` Scripts
- `dev` → `react-router dev`
- `build` → `react-router build`
- `start` → `react-router-serve ./build/server/index.js`

---

## Root Layout (`app/root.tsx`)

The root sets up the HTML document shell:

- **`Layout` component** — wraps the entire app with `<html>`, `<head>`, `<body>`
- **Dark mode** — blocking `<script>` reads `cadence-theme` from localStorage before hydration to prevent flash
- **`<Meta />`, `<Links />`, `<Scripts />`, `<ScrollRestoration />`** — standard React Router head/body helpers
- **`NavigationLoadingBar`** — uses `useNavigation()` to show a shimmer bar at the top when `navigation.state === "loading"`
- **`ErrorBoundary`** — root-level error handler using `isRouteErrorResponse(error)`, with special handling for 404s and dev stack traces

---

## Route Configuration (`app/routes.ts`)

Uses explicit `RouteConfig` array with `route()`, `layout()`, and `index()` helpers:

```
/ (index) → home.tsx

layout("routes/layout.app.tsx") wrapping all protected routes:
├── /dashboard
├── /courses
├── /courses/:slug
├── /courses/:slug/:moduleId
├── /courses/:slug/purchase
├── /courses/:slug/welcome
├── /courses/:slug/lessons/:lessonId
├── /instructor
├── /instructor/new
├── /instructor/:courseId
├── /instructor/:courseId/lessons/:lessonId
├── /instructor/:courseId/lessons/:lessonId/quiz
├── /instructor/:courseId/modules/:moduleId
├── /instructor/:courseId/students
├── /admin/users
├── /admin/courses
├── /admin/categories
├── /settings
├── /team
└── /redeem/:code

Unauthenticated (no layout):
├── /signup
└── /login

API routes (action-only, no UI):
├── /api/switch-user
├── /api/logout
├── /api/video-tracking
└── /api/set-dev-country
```

### File naming convention
- `/courses/:slug` → `courses.$slug.tsx`
- `/courses/:slug/lessons/:lessonId` → `courses.$slug.lessons.$lessonId.tsx`
- `/api/logout` → `api.logout.ts` (`.ts` not `.tsx` for action-only routes)

---

## App Layout (`app/routes/layout.app.tsx`)

Container for all protected routes. Provides shared data and UI chrome.

### Loader
Loads data available to all child routes:
- All users (for DevUI switcher)
- Current user from session
- Recently progressed courses with completion percentages
- Country tier info (PPP pricing)
- Team admin status

### Component Structure
```
<div class="flex">
  <Sidebar />          ← navigation, current user, recent courses
  <main>
    <Outlet />         ← nested route renders here
  </main>
  <DevUI />            ← dev-only user/country switcher
  <Toaster />          ← sonner toast notifications
</div>
```

---

## Data Flow: Loaders → Components

### Loader pattern
```typescript
export async function loader({ request, params }: Route.LoaderArgs) {
  // Fetch data server-side
  return { courses, user };
}
```

### Component consumption
```typescript
export default function Component({ loaderData }: Route.ComponentProps) {
  // loaderData is typed from the loader return
  return <div>{loaderData.courses.map(...)}</div>;
}
```

Alternatively via hook:
```typescript
const data = useLoaderData<typeof loader>();
```

### HydrateFallback
Some routes export a `HydrateFallback` component that renders skeleton loaders while JS hydrates on the client.

---

## Action Pattern (Mutations)

Forms submit to the current route's `action` function:

```typescript
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = parseFormData(formData, schema); // Zod validation

  if (!parsed.success) {
    return data({ errors: parsed.errors }, { status: 400 });
  }

  // Perform mutation
  createThing(parsed.data);

  // Redirect on success
  throw redirect("/destination");
}
```

### Error display in components
```typescript
const actionData = useActionData<typeof action>();
// actionData?.errors contains field-level Zod validation errors
```

### Intent-based actions
Some routes handle multiple actions via an `intent` field:
```typescript
if (parsed.data.intent === "confirm-purchase") { ... }
else if (parsed.data.intent === "confirm-team-purchase") { ... }
```

---

## Navigation & Forms

### Link
```typescript
<Link to="/dashboard">Dashboard</Link>
<Link to={`/courses/${slug}`}>View Course</Link>
```

### Form (full-page navigation)
```typescript
<Form method="post">
  <input name="email" />
  <button type="submit">Log In</button>
</Form>
```

### useFetcher (background submission, no navigation)
```typescript
const fetcher = useFetcher();
<fetcher.Form method="post" action="/api/video-tracking">
  ...
</fetcher.Form>
```
Used for video tracking, dev user switching, country switching — actions that shouldn't cause a page transition.

### useNavigate
```typescript
const navigate = useNavigate();
navigate("/dashboard");
navigate(-1); // back
```

### useSearchParams
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const query = searchParams.get("q");
```

---

## Route Guards

No centralized middleware. Guards are inline in each loader/action:

### Authentication check
```typescript
const currentUserId = await getCurrentUserId(request);
if (!currentUserId) {
  throw data("Sign in required", { status: 401 });
}
```

### Role check
```typescript
const user = getUserById(currentUserId);
if (user.role !== UserRole.Admin) {
  throw data("Only admins can access this page", { status: 403 });
}
```

### Resource existence check
```typescript
const course = getCourseBySlug(params.slug);
if (!course) {
  throw data("Course not found", { status: 404 });
}
```

### Enrollment check
```typescript
const enrolled = isUserEnrolled(currentUserId, courseId);
if (!enrolled) {
  throw data("You must be enrolled", { status: 403 });
}
```

---

## Error Boundaries

Each route can export its own `ErrorBoundary`:

```typescript
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    // error.status is the HTTP code (401, 403, 404, etc.)
    // error.data is the message string
  }
  return <ErrorDisplay />;
}
```

Root error boundary catches anything not handled by child routes.

---

## Meta Tags & SEO

```typescript
export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data.course.title} — Cadence` },
    { name: "description", content: data.course.description },
  ];
}
```

Meta can reference loader data for dynamic page titles.

---

## Navigation Loading State

```typescript
const navigation = useNavigation();
// navigation.state: "idle" | "loading" | "submitting"

const isSubmitting = navigation.state === "submitting";
```

The root `NavigationLoadingBar` component shows a global loading indicator during page transitions.

---

## Session Management (`app/lib/session.ts`)

Uses `createCookieSessionStorage` from React Router:

- Cookie name: `cadence_session`
- httpOnly, sameSite: lax
- Secret: `"cadence-dev-secret"` (hardcoded, dev only)

**Flow:** Login action → `setCurrentUserId()` → signed cookie in `Set-Cookie` header → browser sends cookie on all requests → loaders read via `getCurrentUserId()`.

---

## Key Architectural Patterns

1. **Two-level layout nesting:** Root (HTML shell) → App layout (sidebar + protected chrome) → Route content
2. **Explicit route config** in `app/routes.ts` — not automatic file-system routing
3. **Server-side data loading** — loaders run on server, components receive typed data
4. **Zod validation** — all form inputs validated with `parseFormData()` / `parseParams()`
5. **Server-side markdown rendering** — sales copy and lesson content rendered to HTML in loaders
6. **No client-side-only guards** — all auth/authz checks happen in server loaders/actions
7. **useFetcher for background mutations** — video tracking, dev tools, non-navigating form submissions
