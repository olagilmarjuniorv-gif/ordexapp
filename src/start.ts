import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Server functions and middleware throw `Response` instances to signal
    // HTTP errors (401 Unauthorized, 403 Forbidden, 4xx validation, etc.).
    // These MUST propagate as-is so the client receives a proper status
    // code and can react (re-auth, show toast). Swallowing them into a
    // generic 500 HTML page trips the global Error Boundary and hides the
    // real cause.
    if (error instanceof Response) {
      throw error;
    }
    // Some runtimes wrap HTTP errors in plain objects with `status`/`statusCode`.
    if (
      error != null &&
      typeof error === "object" &&
      ("statusCode" in error || "status" in error)
    ) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
