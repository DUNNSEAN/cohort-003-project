# Course Reviews (Star Ratings)

Students can rate courses with a 1–5 star rating. No written reviews — just a star score. Each student can rate a course once and update their rating at any time.

---

## Data Model

### `course_reviews` table

| Column       | Type                | Constraints                     |
|--------------|---------------------|---------------------------------|
| `id`         | integer             | PK, auto-increment              |
| `user_id`    | integer             | not null, FK → `users.id`       |
| `course_id`  | integer             | not null, FK → `courses.id`     |
| `rating`     | integer             | not null (1–5)                  |
| `created_at` | text (ISO string)   | not null, default now            |
| `updated_at` | text (ISO string)   | not null, default now            |

Schema defined in `app/db/schema.ts` (`courseReviews`). Migration: `drizzle/0003_perpetual_orphan.sql`.

One review per user per course — enforced at the application level via upsert logic (not a unique constraint).

---

## Business Rules

- **Only enrolled students can rate.** The API checks enrollment before accepting a rating.
- **Upsert behavior.** If a student has already rated a course, submitting again updates the existing rating rather than creating a duplicate.
- **Rating range.** Validated server-side via Zod: integer between 1 and 5 inclusive.
- **Instructors and non-enrolled users** see the average rating but cannot submit one.

---

## Service Layer

`app/services/reviewService.ts` provides:

| Function                         | Purpose                                                      |
|----------------------------------|--------------------------------------------------------------|
| `getReviewByUserAndCourse()`     | Fetch a single user's rating for a course (or `undefined`)   |
| `getAverageRating(courseId)`      | Returns `{ averageRating, reviewCount }` for one course      |
| `getAverageRatingsForCourses(ids)` | Batch query — single SQL for the course list page           |
| `upsertReview(userId, courseId, rating)` | Create or update a rating                            |

---

## API

**POST `/api/course-reviews`** — `app/routes/api.course-reviews.ts`

Request body (JSON):
```json
{ "courseId": 1, "rating": 4 }
```

- Requires authentication (401 if not logged in).
- Requires enrollment in the course (403 if not enrolled).
- Returns `{ success: true, review: { ... } }`.

---

## UI Components

### `StarRatingDisplay` — `app/components/star-rating.tsx`

Read-only display of filled/empty stars plus the numeric average and review count. Shows "No ratings" when count is 0. Used on:

- **Course list page** (`app/routes/courses.tsx`) — below each course description in the card.
- **Course detail page** (`app/routes/courses.$slug.tsx`) — in the hero metadata row alongside lesson count and duration.

### `StarRatingInput` — `app/components/star-rating.tsx`

Interactive star picker with hover state. Used on:

- **Course detail page** sidebar — visible only to enrolled students. Submits via `fetch()` to the API route with optimistic UI and toast feedback.

---

## Where Ratings Appear

| Location             | What's shown                        | Component used       |
|----------------------|-------------------------------------|----------------------|
| Course catalog grid  | Average rating + count per card     | `StarRatingDisplay`  |
| Course detail hero   | Average rating + count              | `StarRatingDisplay`  |
| Course detail sidebar| Interactive rating input (enrolled) | `StarRatingInput`    |
