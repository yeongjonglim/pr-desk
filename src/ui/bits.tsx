import {
  Check,
  CircleDashed,
  CircleX,
  Clock,
  Eye,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestDraft,
  Layers,
  MessageSquare,
  RotateCcw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ActionKind, Person, PrState } from "../model/types";

export function Avatar({ person, size = 20 }: { person: Person; size?: number }) {
  const style = { width: size, height: size };
  if (person.isTeam || !person.avatarUrl) {
    return (
      <span className="av av-initials" style={{ ...style, fontSize: Math.round(size * 0.4) }} title={person.name ?? person.login}>
        {(person.name ?? person.login).slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <img className="av" style={style} src={`${person.avatarUrl}${person.avatarUrl.includes("?") ? "&" : "?"}s=${size * 2}`} alt="" title={person.name ?? person.login} />;
}

const ICON: Record<ActionKind, { icon: LucideIcon; tone: string }> = {
  merge: { icon: GitMerge, tone: "green" },
  "fix-ci": { icon: CircleX, tone: "red" },
  conflicts: { icon: TriangleAlert, tone: "red" },
  "address-review": { icon: GitPullRequestArrow, tone: "amber" },
  reply: { icon: MessageSquare, tone: "amber" },
  "re-request": { icon: RotateCcw, tone: "blue" },
  review: { icon: Eye, tone: "blue" },
  "self-review": { icon: CircleDashed, tone: "mute" },
  waiting: { icon: Clock, tone: "mute" },
  "waiting-ci": { icon: Clock, tone: "green" },
  blocked: { icon: Layers, tone: "mute" },
};

export function StatusIcon({ action, size = 16 }: { action: ActionKind; size?: number }) {
  const { icon: Icon, tone } = ICON[action];
  return <Icon className={`st ${tone}`} size={size} strokeWidth={1.75} aria-hidden />;
}

export function displayName(p: Person) {
  if (p.isTeam) return p.login;
  return p.name?.split(" ")[0] || p.login;
}

const STATE: Record<PrState, { label: string; icon: LucideIcon }> = {
  draft: { label: "Draft", icon: GitPullRequestDraft },
  open: { label: "Open", icon: GitPullRequest },
  approved: { label: "Approved", icon: Check },
  changes: { label: "Changes requested", icon: GitPullRequestArrow },
};

export function StateBadge({ state, compact }: { state: PrState; compact?: boolean }) {
  const { label, icon: Icon } = STATE[state];
  return (
    <span className={`state ${state} ${compact ? "compact" : ""}`} title={label}>
      <Icon size={12} strokeWidth={2} aria-hidden />
      {compact && state === "changes" ? "Changes" : label}
    </span>
  );
}
