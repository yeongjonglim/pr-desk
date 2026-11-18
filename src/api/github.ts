const STORED = "pr-desk:token";

export class AuthError extends Error {}
/** No token yet: the page has to ask for one. */
export class NeedsTokenError extends AuthError {}

let tokenPromise: Promise<string> | null = null;

function stored(): string | null {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  try {
    localStorage.setItem(STORED, token.trim());
  } catch {
    // Storage blocked: the token lives for this page load only.
  }
  tokenPromise = Promise.resolve(token.trim());
}

export function forgetToken() {
  try {
    localStorage.removeItem(STORED);
  } catch {
    // Nothing stored to remove.
  }
  tokenPromise = null;
}

// The Vite dev server serves the gh CLI's token at /api/token. A static host has no such
// route, so there the token is one the user pasted into this browser.
async function fromDevServer(): Promise<string | null> {
  try {
    const res = await fetch("/api/token", { headers: { "X-PR-Desk": "1" } });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return null;
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}

export function getToken(): Promise<string> {
  tokenPromise ??= (async () => {
    const token = stored() ?? (await fromDevServer());
    if (!token) {
      tokenPromise = null;
      throw new NeedsTokenError("No GitHub token in this browser yet.");
    }
    return token;
  })();
  return tokenPromise;
}

export interface RateLimit {
  cost: number;
  remaining: number;
  resetAt: string;
}

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) {
    forgetToken();
    throw new NeedsTokenError("GitHub rejected the saved token. It may have expired or been revoked.");
  }
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  if (!res.ok || !body.data) throw new Error(`GitHub answered ${res.status}.`);
  return body.data;
}

/** Checks a pasted token before saving it, and says which scope is missing if any. */
export async function checkToken(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token.trim()}` } });
  if (res.status === 401) return "GitHub doesn't accept this token. Check you copied all of it.";
  if (!res.ok) return `GitHub answered ${res.status}. Try again in a moment.`;
  const scopes = (res.headers.get("x-oauth-scopes") ?? "").split(",").map((s) => s.trim());
  if (!res.headers.has("x-oauth-scopes")) return "This looks like a fine-grained token. Use a classic token: fine-grained ones can't read notifications.";
  const missing = ["repo", "read:org"].filter((s) => !scopes.includes(s) && !(s === "read:org" && scopes.includes("admin:org")));
  return missing.length ? `The token is missing the ${missing.join(" and ")} scope.` : null;
}
