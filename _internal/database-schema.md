# Database Schema

SQLite database using **Drizzle ORM**. Schema defined in `app/db/schema.ts`.

---

## Enums

| Enum | Values |
|------|--------|
| `UserRole` | `student`, `instructor`, `admin` |
| `CourseStatus` | `draft`, `published`, `archived` |
| `LessonProgressStatus` | `not_started`, `in_progress`, `completed` |
| `QuestionType` | `multiple_choice`, `true_false` |
| `TeamMemberRole` | `admin`, `member` |

---

## Tables

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `name` | text | not null |
| `email` | text | not null, unique |
| `role` | text (UserRole) | not null |
| `avatar_url` | text | nullable |
| `bio` | text | nullable |
| `created_at` | text (ISO string) | not null, default now |

### `categories`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `name` | text | not null |
| `slug` | text | not null, unique |

### `courses`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `title` | text | not null |
| `slug` | text | not null, unique |
| `description` | text | not null |
| `sales_copy` | text | nullable |
| `instructor_id` | integer | not null, FK → users.id |
| `category_id` | integer | not null, FK → categories.id |
| `status` | text (CourseStatus) | not null |
| `cover_image_url` | text | nullable |
| `price` | integer | not null, default 0 |
| `ppp_enabled` | integer (boolean) | not null, default true |
| `created_at` | text (ISO string) | not null, default now |
| `updated_at` | text (ISO string) | not null, default now |

### `modules`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `course_id` | integer | not null, FK → courses.id |
| `title` | text | not null |
| `position` | integer | not null |
| `created_at` | text (ISO string) | not null, default now |

### `lessons`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `module_id` | integer | not null, FK → modules.id |
| `title` | text | not null |
| `content` | text | nullable |
| `video_url` | text | nullable |
| `github_repo_url` | text | nullable |
| `position` | integer | not null |
| `duration_minutes` | integer | nullable |
| `created_at` | text (ISO string) | not null, default now |

### `enrollments`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `user_id` | integer | not null, FK → users.id |
| `course_id` | integer | not null, FK → courses.id |
| `enrolled_at` | text (ISO string) | not null, default now |
| `completed_at` | text | nullable |

### `lesson_progress`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `user_id` | integer | not null, FK → users.id |
| `lesson_id` | integer | not null, FK → lessons.id |
| `status` | text (LessonProgressStatus) | not null |
| `completed_at` | text | nullable |

### `purchases`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `user_id` | integer | not null, FK → users.id |
| `course_id` | integer | not null, FK → courses.id |
| `price_paid` | integer | not null |
| `country` | text | nullable |
| `created_at` | text (ISO string) | not null, default now |

---

## Quiz Tables

### `quizzes`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `lesson_id` | integer | not null, FK → lessons.id |
| `title` | text | not null |
| `passing_score` | real | not null |

### `quiz_questions`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `quiz_id` | integer | not null, FK → quizzes.id |
| `question_text` | text | not null |
| `question_type` | text (QuestionType) | not null |
| `position` | integer | not null |

### `quiz_options`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `question_id` | integer | not null, FK → quiz_questions.id |
| `option_text` | text | not null |
| `is_correct` | integer (boolean) | not null |

### `quiz_attempts`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `user_id` | integer | not null, FK → users.id |
| `quiz_id` | integer | not null, FK → quizzes.id |
| `score` | real | not null |
| `passed` | integer (boolean) | not null |
| `attempted_at` | text (ISO string) | not null, default now |

### `quiz_answers`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `attempt_id` | integer | not null, FK → quiz_attempts.id |
| `question_id` | integer | not null, FK → quiz_questions.id |
| `selected_option_id` | integer | not null, FK → quiz_options.id |

---

## Team Tables

### `teams`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `created_at` | text (ISO string) | not null, default now |

### `team_members`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `team_id` | integer | not null, FK → teams.id |
| `user_id` | integer | not null, FK → users.id |
| `role` | text (TeamMemberRole) | not null |
| `created_at` | text (ISO string) | not null, default now |

### `coupons`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `team_id` | integer | not null, FK → teams.id |
| `course_id` | integer | not null, FK → courses.id |
| `code` | text | not null, unique |
| `purchase_id` | integer | not null, FK → purchases.id |
| `redeemed_by_user_id` | integer | nullable, FK → users.id |
| `redeemed_at` | text | nullable |
| `created_at` | text (ISO string) | not null, default now |

---

## Tracking Tables

### `video_watch_events`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | integer | PK, auto-increment |
| `user_id` | integer | not null, FK → users.id |
| `lesson_id` | integer | not null, FK → lessons.id |
| `event_type` | text | not null |
| `position_seconds` | real | not null |
| `created_at` | text (ISO string) | not null, default now |

---

## Relationships Diagram

```
users ─┬─< enrollments >── courses ──< modules ──< lessons
       │                      │                       │
       ├─< purchases >───────┘                       ├──< lesson_progress >── users
       │       │                                      ├──< quizzes ──< quiz_questions ──< quiz_options
       │       └──< coupons >── teams                 └──< video_watch_events >── users
       │                          │
       ├─< team_members >─────────┘          quiz_attempts ──< quiz_answers
       │                                         │
       └─< quiz_attempts                         └── users
```

### Key relationships
- A **course** belongs to one **instructor** (user) and one **category**
- A **course** has many **modules**, each with ordered **lessons**
- **Enrollments** link users to courses (many-to-many)
- **Lesson progress** tracks per-user, per-lesson completion status
- **Quizzes** attach to lessons; each has ordered questions with options
- **Quiz attempts** record a user's score; **quiz answers** record per-question choices
- **Purchases** record payment with price and country (for PPP)
- **Teams** have members (admin/member roles) and **coupons** tied to a purchase
- **Coupons** can be redeemed by a user, which triggers enrollment
- **Video watch events** log playback position for resume functionality

### Notes
- All timestamps stored as ISO 8601 text strings (not SQLite datetime)
- Booleans stored as integers (`0`/`1`) with Drizzle's `mode: "boolean"`
- `position` columns on modules, lessons, and quiz_questions enable drag-and-drop reordering
- No cascade deletes defined in schema — deletions must be handled in application code
- No composite unique constraints (e.g., no unique on `[user_id, course_id]` in enrollments)
