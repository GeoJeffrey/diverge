import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button, ButtonLink } from "@/design-system/components/Controls";
import NotFoundPage from "./NotFoundPage";

/** Global error boundary: a crash in one page never blanks the whole app. */
export default function RouteError() {
  const err = useRouteError();
  if (isRouteErrorResponse(err) && err.status === 404) return <NotFoundPage />;
  const chunkFailed = err instanceof Error && /dynamically imported module|Loading chunk/i.test(err.message);
  return (
    <div className="page py-24" role="alert">
      <h1 className="t-h1">{chunkFailed ? "This page couldn't load." : "Something broke on this page."}</h1>
      <p className="t-body mt-3">
        {chunkFailed
          ? "Part of the app didn't download, usually because of a dropped connection or a new version going live. Reloading fixes it."
          : "The rest of Diverge still works. Reload to try again, or go back to the market."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <ButtonLink to="/market" variant="quiet">Go to the market</ButtonLink>
      </div>
    </div>
  );
}
