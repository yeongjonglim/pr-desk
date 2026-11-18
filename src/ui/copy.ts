export interface Linkable {
  title: string;
  url: string;
  repo: string;
  number: number;
  additions: number;
  deletions: number;
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number) {
  return n.toLocaleString("en");
}

// Teams keeps the HTML link when pasting, and falls back to the plain line elsewhere.
export function teamsLine(pr: Linkable) {
  const size = `(+${fmt(pr.additions)}/−${fmt(pr.deletions)})`;
  const ref = `${pr.repo}#${pr.number}`;
  return {
    html: `<a href="${escape(pr.url)}">${escape(pr.title)}</a> ${size} · ${escape(ref)}`,
    text: `${pr.title} ${size} · ${ref} ${pr.url}`,
  };
}

/** One line per PR, the same shape as a single copy. */
export function teamsList(prs: Linkable[]) {
  const lines = prs.map(teamsLine);
  return { html: lines.map((l) => l.html).join("<br>"), text: lines.map((l) => l.text).join("\n") };
}

// navigator.clipboard only exists in secure contexts, so over a plain-http NetBird
// address the copy goes through a selected, off-screen element instead.
function copyBySelection(html: string): boolean {
  const el = document.createElement("div");
  el.innerHTML = html;
  el.style.cssText = "position:fixed;left:-9999px;top:0;white-space:pre";
  document.body.appendChild(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  let ok = false;
  try {
    // Deprecated but still the only clipboard write available outside a secure context.
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  sel?.removeAllRanges();
  el.remove();
  return ok;
}

export async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection copy.
  }
  return copyBySelection(html);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through.
  }
  return copyBySelection(escape(text));
}
