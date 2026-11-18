import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyRich } from "./copy";

export function CopyButton({ get, label, primary }: { get: () => { html: string; text: string }; label: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function go() {
    const { html, text } = get();
    setState((await copyRich(html, text)) ? "done" : "failed");
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button className={`btn ${primary ? "pri" : ""}`} onClick={go}>
      {state === "done" ? <Check size={14} /> : <Copy size={14} />}
      {state === "done" ? "Copied" : state === "failed" ? "Copy blocked" : label}
    </button>
  );
}
