import { useId } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/design-system/components/Controls";
import { dateTime } from "@/lib/format";
import { labelForRole } from "@/lib/labels";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const THEMES: { value: ThemeChoice; label: string; note: string }[] = [
  { value: "system", label: "Match my device", note: "Follows your system's light or dark setting." },
  { value: "ink", label: "Dark", note: "Ink background." },
  { value: "paper", label: "Light", note: "Paper background." },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { choice, setChoice } = useTheme();
  const name = useId();
  if (!user) return null;
  return (
    <div className="page max-w-[760px] pb-10 pt-14">
      <h1 className="t-h1">Account</h1>
      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-10 gap-y-3 border-t border-line pt-6 text-[0.9375rem]">
        <dt className="text-text-3">Name</dt><dd>{user.full_name}</dd>
        <dt className="text-text-3">Email</dt><dd className="break-all">{user.email}</dd>
        <dt className="text-text-3">Plan</dt><dd>{labelForRole(user.role)}</dd>
        <dt className="text-text-3">Member since</dt><dd>{dateTime(user.created_at)}</dd>
      </dl>

      <fieldset className="mt-12 border-0 border-t border-line p-0 pt-6">
        <legend className="t-h3 float-left mb-4 w-full">Theme</legend>
        <div className="clear-both flex flex-col gap-3">
          {THEMES.map((t) => (
            <label key={t.value} className="flex cursor-pointer items-start gap-3">
              <input type="radio" name={name} value={t.value} checked={choice === t.value} onChange={() => setChoice(t.value)} className="mt-1 accent-[var(--text)]" />
              <span>
                <span className="block text-[0.9375rem] text-text">{t.label}</span>
                <span className="t-small block">{t.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-12 border-t border-line pt-6">
        <Button variant="quiet" onClick={() => { logout(); navigate("/", { replace: true }); }}>Sign out</Button>
      </div>
    </div>
  );
}
