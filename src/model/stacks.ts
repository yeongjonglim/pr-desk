import type { Pr, StackInfo } from "./types";

// A stack is a chain of open PRs where each one's base branch is the head branch of
// the one below it. This covers gh-stack and stacks made by hand alike.
export function findStacks(prs: Pr[]): Map<string, StackInfo> {
  const byHead = new Map(prs.map((p) => [`${p.repoFull}:${p.headRef}`, p]));
  const below = (p: Pr) => byHead.get(`${p.repoFull}:${p.baseRef}`) ?? null;
  const children = new Map<string, Pr[]>();
  for (const p of prs) {
    const parent = below(p);
    if (parent) children.set(parent.id, [...(children.get(parent.id) ?? []), p]);
  }

  const result = new Map<string, StackInfo>();
  for (const root of prs.filter((p) => !below(p) && children.has(p.id))) {
    const members: Pr[] = [];
    const walk = (p: Pr) => {
      members.push(p);
      for (const c of (children.get(p.id) ?? []).sort((a, b) => a.number - b.number)) walk(c);
    };
    walk(root);
    members.forEach((p, i) =>
      result.set(p.id, { key: `${root.repoFull}#${root.number}`, position: i + 1, members, below: below(p) }),
    );
  }
  return result;
}
