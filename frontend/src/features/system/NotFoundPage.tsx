import { ButtonLink } from "@/design-system/components/Controls";
import { ForkMark } from "@/design-system/components/Brand";

export default function NotFoundPage({ what }: { what?: string }) {
  return (
    <div className="page py-24">
      <ForkMark className="h-10 w-12 text-text-3" />
      <h1 className="t-h1 mt-6">This path doesn't lead anywhere.</h1>
      <p className="t-body mt-3">{what ?? "The page you asked for doesn't exist or has moved."}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/market">Go to the market</ButtonLink>
        <ButtonLink to="/" variant="quiet">Home</ButtonLink>
      </div>
    </div>
  );
}
