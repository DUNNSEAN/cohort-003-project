# Lesson Comments

Students can post comments on lessons and instructors can moderate them.

---

## Who Can Do What

| Action | Who |
|--------|-----|
| View comments | Enrolled students, the course's owning instructor, admins |
| Post a comment | Enrolled students, the course's owning instructor, admins |
| Delete a comment | The course's owning instructor, admins |

Comments are **not** visible to unenrolled users or instructors of other courses.

---

## Data Model

### `lesson_comments` table (`app/db/schema.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `lesson_id` | integer | not null, FK → lessons.id |
| `user_id` | integer | not null, FK → users.id |
| `content` | text | not null |
| `created_at` | text (ISO string) | not null, default now |

Comments are immutable — they can be created or deleted but not edited.

---

## Service Layer

`app/services/commentService.ts`

| Function | Description |
|----------|-------------|
| `getCommentsByLesson(lessonId)` | Returns comments with commenter name, avatar, and role; newest-first |
| `createComment(userId, lessonId, content)` | Inserts a new comment |
| `deleteComment(id)` | Deletes a comment by id |
| `getCommentById(id)` | Fetches a single comment — used in the delete action to verify the comment belongs to the current lesson before authorizing deletion |

---

## UI

Comments appear in the lesson view (`app/routes/courses.$slug.lessons.$lessonId.tsx`) between the quiz section and the mark-complete block.

- The **add-comment form** is shown to enrolled students and the owning instructor.
- Each comment shows the commenter's avatar, name, timestamp, and message.
- Comments from instructors or admins display an **"Instructor" badge** next to the name.
- The **delete button** (trash icon) appears on every comment but only when the logged-in user is the owning instructor or an admin.

---

## Authorization Details

Authorization is enforced server-side in both the loader and action — client-side hiding (e.g., not rendering the delete button) is UX only.

**Loader** — `isOwningInstructor` is computed server-side:
```
isInstructor = role is Instructor or Admin
isOwningInstructor = isInstructor AND course.instructorId === currentUserId
```

**Action: `add-comment`** — rejects if the user is neither enrolled nor the owning instructor.

**Action: `delete-comment`** — verifies:
1. The comment exists and its `lessonId` matches the current lesson (prevents cross-lesson manipulation)
2. The user is an Admin, or an Instructor who owns this course

---

## Validation

- `content` must be between 1 and 2000 characters (Zod, validated in the action)
- Validation errors are returned to the client and displayed inline below the textarea

---

## Notes

- Comments have no threading or replies — flat list only
- No edit functionality — delete and repost to correct a mistake
- The `course.instructorId` field is now included in the loader's `course` return object (was not previously exposed to the component)
