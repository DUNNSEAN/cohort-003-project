# Authentication and Authorization

## Authentication Mechanisms

### Session Management (`app/lib/session.ts`)
- Uses React Router's `createCookieSessionStorage`
- Cookie name: `cadence_session`
- Settings: httpOnly, sameSite: lax, path: "/"
- Secret: `"cadence-dev-secret"` (hardcoded — dev only)
- Key functions:
  - `getSession(request)` — retrieves session from cookie
  - `getCurrentUserId(request)` — extracts user ID from session
  - `setCurrentUserId(request, userId)` — sets user ID in session
  - `destroySession(request)` — clears session on logout
  - `getDevCountry(request)` / `setDevCountry()` — dev feature for country testing

### Login (`app/routes/login.tsx`)
- Email-based login (no password)
- Validation: Zod schema for email format
- User lookup via `getUserByEmail(email)`
- Session creation via `setCurrentUserId()` on success
- Respects `redirectTo` query parameter

### Signup (`app/routes/signup.tsx`)
- Email and name required (Zod validation)
- If email already exists, silently logs in existing user
- New users created as `UserRole.Student`

### Logout (`app/routes/api.logout.ts`)
- POST `/api/logout`
- Destroys session cookie, redirects to `/`

---

## Authorization & Role-Based Access Control

### User Roles (defined in `app/db/schema.ts`)
| Role | Description |
|------|-------------|
| `Student` | Default role for new users |
| `Instructor` | Can create and manage own courses |
| `Admin` | Full platform access |

### Authorization Pattern
All protected routes validate in `loader()` and `action()` functions:
```typescript
const currentUserId = await getCurrentUserId(request);
if (!currentUserId) throw data("message", { status: 401 });
const user = getUserById(currentUserId);
if (!user || user.role !== UserRole.Admin) throw data("Only admins...", { status: 403 });
```

---

## Protected Routes by Role

### Admin Routes
- `/admin/users` — manage all users, change roles
- `/admin/courses` — manage all courses, update status
- `/admin/categories` — create/edit course categories
- Guard: `user.role === UserRole.Admin`
- Files: `app/routes/admin.users.tsx`, `admin.courses.tsx`, `admin.categories.tsx`

### Instructor Routes
- `/instructor` — view owned courses
- `/instructor/new` — create new course
- `/instructor/:courseId` — edit course content, manage modules/lessons
- `/instructor/:courseId/lessons/:lessonId` — edit lesson
- `/instructor/:courseId/lessons/:lessonId/quiz` — edit quiz
- `/instructor/:courseId/modules/:moduleId` — edit module
- `/instructor/:courseId/students` — view course enrollments
- Guard: `user.role === UserRole.Instructor OR UserRole.Admin`
- Additional check: course ownership (`course.instructorId === currentUserId`) — admins bypass this
- Files: `app/routes/instructor.tsx`, `instructor.new.tsx`, `instructor.$courseId.tsx`, etc.

### Student Routes
- `/dashboard` — view enrolled courses and progress
- `/courses` — browse published courses
- `/courses/:slug` — view course details
- `/courses/:slug/:moduleId` — view module (if enrolled)
- `/courses/:slug/lessons/:lessonId` — view lesson (if enrolled)
- `/courses/:slug/purchase` — purchase course
- `/settings` — edit profile
- `/redeem/:code` — redeem coupon code
- Guard: must be authenticated (`getCurrentUserId`)
- Files: `app/routes/dashboard.tsx`, `courses.tsx`, `courses.$slug.tsx`, etc.

### Team Admin Routes
- `/team` — manage team seats and coupons
- Guard: `isTeamAdmin(currentUserId)`
- File: `app/routes/team.tsx`

---

## Enrollment-Based Access
- Function: `isUserEnrolled(userId, courseId)` in `app/services/enrollmentService.ts`
- Checked before allowing lesson/module access for students

---

## API Endpoints with Auth

| Endpoint | File | Auth |
|----------|------|------|
| POST `/api/logout` | `api.logout.ts` | Destroys session |
| POST `/api/switch-user` | `api.switch-user.ts` | Dev feature — switch between users |
| POST `/api/set-dev-country` | `api.set-dev-country.ts` | Dev feature — set country for PPP testing |
| POST `/api/video-tracking` | `api.video-tracking.ts` | Must be authenticated (401 if not) |

---

## Team Coupon Authorization (`app/services/couponService.ts`)
Validation checks on redemption:
- Coupon exists
- Coupon not already redeemed
- User not already enrolled
- Country match (purchaser country must match redeemer country)
- Auto-enrolls user on successful redemption

---

## Key Service Functions

| Service | Functions |
|---------|-----------|
| `userService.ts` | `getUserById()`, `getUserByEmail()`, `getUsersByRole()`, `updateUserRole()`, `createUser()` |
| `enrollmentService.ts` | `isUserEnrolled()`, `enrollUser()`, `unenrollUser()`, `getUserEnrolledCourses()` |
| `courseService.ts` | `getCoursesByInstructor()`, `getCourseById()`, `getCourseBySlug()` |
| `teamService.ts` | `isTeamAdmin()`, `getTeamForAdmin()`, `getOrCreateTeamForUser()` |
| `couponService.ts` | `redeemCoupon()`, `generateCoupons()` |

---

## Database Models (`app/db/schema.ts`)

### Users Table
`id`, `name`, `email` (unique), `role` (UserRole enum), `avatarUrl`, `bio`, `createdAt`

### Team Tables
- `teams` — team records
- `teamMembers` — junction table with `teamId`, `userId`, `role` (admin/member)
- `coupons` — team course seats: `teamId`, `courseId`, `code`, `redeemedByUserId`, `redeemedAt`

---

## Routing & Layout (`app/routes.ts`, `app/routes/layout.app.tsx`)
- Layout-based routing: protected routes nested under `layout("routes/layout.app.tsx")`
- Layout loader fetches current user and passes to all child routes
- Enables role-based UI rendering (e.g., show instructor links only for instructors)
- Public routes (login, signup, home) at root level

---

## Security Notes
1. **Session secret**: hardcoded `"cadence-dev-secret"` — must use env var in production
2. **No password auth**: email-only login
3. **CSRF**: not explicitly implemented — relies on React Router form handling
4. **SQL injection**: protected by Drizzle ORM parameterized queries
5. **Authorization**: consistently enforced server-side in loaders/actions, no client-side-only guards
6. **Error messages**: some reveal user existence (e.g., "No account found") — intentional UX choice
