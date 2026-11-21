import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { ApiError, IS_DEMO_DATA } from "@/lib/api";
import { Button } from "@/design-system/components/Controls";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/market";
}

function Field({ label, type = "text", value, onChange, autoComplete, hint, error }: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-text">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[var(--r-control)] border border-edge bg-raise px-3 text-[0.9375rem] text-text"
      />
      {(hint || error) && (
        <p id={`${id}-help`} className="t-small" style={error ? { color: "var(--down)" } : undefined}>{error ?? hint}</p>
      )}
    </div>
  );
}

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) await signup(email, password, name);
      else await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const field = typeof err.payload.details?.field === "string" ? (err.payload.details.field as string) : undefined;
        setError({ field, message: err.message });
      } else {
        setError({ message: "Couldn't reach the Diverge API. Check your connection and try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  const other = isSignup ? `/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}` : `/signup${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="page grid gap-12 pb-10 pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,5fr)] lg:gap-20">
      <div>
        <h1 className="t-h1">{isSignup ? "Create an account" : "Sign in"}</h1>
        <p className="t-body mt-4">
          An account unlocks the advanced reading for each stock: all five narrative indices, the coordination evidence and
          the posts behind every score. The outlooks and the track record stay public.
        </p>
        {IS_DEMO_DATA && !isSignup && (
          <p className="hatch mt-6 border border-dashed border-line-strong px-4 py-3 text-sm text-text-2">
            Demo mode: sign in with <span className="t-num text-text">trader@example.com</span> and{" "}
            <span className="t-num text-text">SecurePass123!</span>, or create a throwaway account.
          </p>
        )}
      </div>
      <form onSubmit={submit} noValidate={false} className="flex max-w-[420px] flex-col gap-5" aria-describedby={error && !error.field ? "form-error" : undefined}>
        {isSignup && (
          <Field label="Full name" value={name} onChange={setName} autoComplete="name" error={error?.field === "full_name" ? error.message : undefined} />
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={error?.field === "email" ? error.message : undefined} />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={isSignup ? "new-password" : "current-password"}
          hint={isSignup ? "At least 8 characters." : undefined}
          error={error?.field === "password" ? error.message : undefined}
        />
        {error && !error.field && <p id="form-error" role="alert" className="border-l-2 border-down pl-3 text-sm text-text">{error.message}</p>}
        <Button type="submit" disabled={busy} className="h-11">{busy ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}</Button>
        <p className="t-small">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link to={other} className="font-medium text-text underline underline-offset-[3px]">{isSignup ? "Sign in" : "Create an account"}</Link>
        </p>
      </form>
    </div>
  );
}
