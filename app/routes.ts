import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("courses", "routes/courses.tsx"),
  route("courses/:slug", "routes/courses.$slug.tsx"),
  route("courses/:slug/lessons/:lessonId", "routes/courses.$slug.lessons.$lessonId.tsx"),
  route("api/switch-user", "routes/api.switch-user.ts"),
] satisfies RouteConfig;
