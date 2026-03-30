# User Roles and Permissions

## User Roles

Defined in `app/db/schema.ts` as a `UserRole` enum:

| Role | Value |
|------|-------|
| **Student** | `"student"` |
| **Instructor** | `"instructor"` |
| **Admin** | `"admin"` |

There is also a separate `TeamMemberRole` enum (`"admin"` / `"member"`) for team-level permissions.

## Authentication

Cookie-based sessions (`app/lib/session.ts`) store only the `userId`. The role is **always fetched from the database** on each request — never cached in the session.

## What Each Role Can Do

### Student

- Browse and purchase courses
- Access lessons for **enrolled** courses only
- Track progress, take quizzes
- Post comments on lessons they are enrolled in
- Redeem coupon codes
- View their dashboard (`/dashboard`)

### Instructor

- Everything a student can do, plus:
- Create new courses (`/instructor/new`)
- Edit **their own** courses, modules, lessons, and quizzes
- Post comments on lessons in **their own** courses
- **Moderate comments** on their own courses' lessons (delete any comment)
- View enrolled students and their progress (`/instructor/:courseId/students`)
- Sidebar shows "My Courses"

### Admin

- Everything an instructor can do, plus:
- Edit **any** instructor's courses (ownership check bypassed)
- Manage all users — update names, emails, and **change roles** (`/admin/users`)
- Control course status: draft/published/archived (`/admin/courses`)
- Full CRUD on categories (`/admin/categories`)
- Sidebar shows "Manage Users", "Manage Courses", "Categories"

## How Permissions Are Enforced

**Route loaders & actions** — each route checks auth and role inline:

1. Get `userId` from session — 401 if missing
2. Fetch user from DB — check role — 403 if insufficient
3. For instructor routes: also verify course ownership (admins bypass this)
4. For student lesson access: verify enrollment exists

Both the loader (read) and action (write) repeat the same checks, so permission is enforced on GET and POST.

**Sidebar (`app/components/sidebar.tsx`)** — conditionally renders nav items based on role, so users only see links they can access.

**Service layer** — no role checks; services trust that the calling route already authorized the request.

## Team Permissions

Separate from the main role system. When a user makes a team purchase, they become a team admin (`TeamMemberRole.Admin`) and can:

- View their team at `/team`
- See generated coupon codes and redemption status
- Checked via `isTeamAdmin(userId)` / `getTeamForAdmin(userId)`

## Key Routes by Role

### Admin-only routes

- `/admin/users` — manage all users, change roles
- `/admin/courses` — manage all course statuses
- `/admin/categories` — CRUD on categories

### Instructor routes (+ admin override)

- `/instructor` — list own courses
- `/instructor/new` — create course
- `/instructor/:courseId` — edit course (ownership enforced, admins bypass)
- `/instructor/:courseId/modules/:moduleId` — edit modules
- `/instructor/:courseId/lessons/:lessonId` — edit lessons
- `/instructor/:courseId/lessons/:lessonId/quiz` — create/edit quizzes
- `/instructor/:courseId/students` — view enrolled students

### Student / general routes

- `/courses` — browse published courses
- `/courses/:slug` — view course details
- `/courses/:slug/purchase` — purchase a course
- `/courses/:slug/lessons/:lessonId` — access lesson (enrollment required)
- `/courses/:slug/welcome` — post-enrollment welcome
- `/dashboard` — student dashboard
- `/settings` — user settings
- `/redeem/:code` — redeem coupon
- `/team` — team management (team admin only)
