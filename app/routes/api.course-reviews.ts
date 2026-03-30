import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.course-reviews";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { isUserEnrolled } from "~/services/enrollmentService";
import { upsertReview } from "~/services/reviewService";

const reviewSchema = z.object({
  courseId: z.number(),
  rating: z.number().int().min(1).max(5),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, reviewSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { courseId, rating } = parsed.data;

  if (!isUserEnrolled(currentUserId, courseId)) {
    throw data("You must be enrolled to rate this course", { status: 403 });
  }

  const review = upsertReview(currentUserId, courseId, rating);

  return { success: true, review };
}
