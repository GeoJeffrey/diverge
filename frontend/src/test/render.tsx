import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/auth/AuthProvider";

/** Render a page the way the app does (router + query cache + auth), in demo/mock mode. */
export function renderAt(element: ReactElement, { path = "/", url = "/" }: { path?: string; url?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path, element },
      { path: "/login", element: <p>login page</p> },
      { path: "*", element: <p>elsewhere</p> },
    ],
    { initialEntries: [url] },
  );
  return {
    client,
    router,
    ...render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <>
            <RouterProvider router={router} />
          </>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}
