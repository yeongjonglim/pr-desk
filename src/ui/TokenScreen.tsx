import { useState, type FormEvent } from "react";
import { checkToken, saveToken } from "../api/github";

const NEW_TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=repo,read:org,notifications&description=PR%20Desk";

export function TokenScreen({ reason, onSaved }: { reason?: string; onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    const problem = await checkToken(token).catch(() => "Couldn't reach GitHub. Check your connection and try again.");
    setBusy(false);
    if (problem) return setError(problem);
    saveToken(token);
    onSaved();
  }

  return (
    <div className="token">
      <form className="token-card" onSubmit={submit}>
        <h1>Connect GitHub</h1>
        <p className="muted">{reason ?? "PR Desk reads your pull requests with a GitHub token kept in this browser. It is only ever sent to api.github.com."}</p>
        <ol>
          <li>
            <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer">Create a classic token</a> with the <code>repo</code>, <code>read:org</code> and <code>notifications</code> scopes.
          </li>
          <li>
            Or reuse the gh CLI's: run <code>gh auth token</code> and copy the output.
          </li>
        </ol>
        <label htmlFor="token">Token</label>
        <input id="token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_… or gho_…" autoFocus />
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn pri" type="submit" disabled={busy || !token.trim()}>
          {busy ? "Checking…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
