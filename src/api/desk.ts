import { classify } from "../model/classify";
import { normalize } from "../model/normalize";
import { reviewerLoad, type ReviewerLoad } from "../model/reviewers";
import { findStacks } from "../model/stacks";
import type { Item, Person, Pr } from "../model/types";
import { graphql, type RateLimit } from "./github";
import { DETAILS_QUERY, LOAD_QUERY, PROBE_QUERY, type RawLoadPr, type RawPr } from "./queries";

export interface Desk {
  me: Person;
  org: string | null;
  orgs: string[];
  items: Item[];
  mine: Pr[];
  rate: RateLimit;
}

interface ProbeNode {
  id?: string;
  updatedAt?: string;
  commits?: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
}

interface ProbeData {
  viewer: { login: string; name: string | null; avatarUrl: string };
  mine: { nodes: ProbeNode[] };
  reviews: { nodes: ProbeNode[] };
  rateLimit: RateLimit;
}

const BATCH = 10;
// Mergeability and some review state change without touching updatedAt (main moving on,
// a team request resolving), so everything is refetched on this interval regardless.
const FULL_REFRESH_MS = 10 * 60_000;

const cache = new Map<string, { stamp: string; raw: RawPr }>();
let lastFull = 0;

const stampOf = (n: ProbeNode) => `${n.updatedAt}|${n.commits?.nodes[0]?.commit.statusCheckRollup?.state ?? ""}`;

async function details(ids: string[]): Promise<RawPr[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const results = await Promise.all(
    batches.map((b) => graphql<{ nodes: (RawPr | null)[] }>(DETAILS_QUERY, { ids: b })),
  );
  return results.flatMap((r) => r.nodes.filter((n): n is RawPr => !!n));
}

export async function fetchDesk(): Promise<Desk> {
  const probe = await graphql<ProbeData>(PROBE_QUERY, {
    mine: "is:pr is:open author:@me archived:false sort:updated-desc",
    reviews: "is:pr is:open review-requested:@me archived:false sort:updated-desc",
  });
  const full = Date.now() - lastFull > FULL_REFRESH_MS;
  const nodes = [...probe.mine.nodes, ...probe.reviews.nodes].filter((n) => n.id);
  const stale = nodes.filter((n) => full || cache.get(n.id!)?.stamp !== stampOf(n));
  const fresh = await details([...new Set(stale.map((n) => n.id!))]);
  for (const raw of fresh) {
    const node = nodes.find((n) => n.id === raw.id)!;
    cache.set(raw.id, { stamp: stampOf(node), raw });
  }
  if (full) lastFull = Date.now();
  const live = new Set(nodes.map((n) => n.id!));
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);

  const me = probe.viewer.login;
  const pick = (list: ProbeNode[]) => list.flatMap((n) => (n.id && cache.has(n.id) ? [normalize(cache.get(n.id)!.raw, me)] : []));
  const mine = pick(probe.mine.nodes);
  const reviews = pick(probe.reviews.nodes);

  const counts = new Map<string, number>();
  for (const pr of [...mine, ...reviews]) if (pr.owner !== me) counts.set(pr.owner, (counts.get(pr.owner) ?? 0) + 1);
  const orgs = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);

  return {
    me: { login: me, name: probe.viewer.name, avatarUrl: probe.viewer.avatarUrl },
    org: orgs[0] ?? null,
    orgs,
    items: classify(mine, reviews, findStacks(mine)),
    mine,
    rate: probe.rateLimit,
  };
}

export interface Load {
  org: string;
  openPrs: number;
  loads: ReviewerLoad[];
  rate: RateLimit;
}

interface LoadData {
  search: { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: (RawLoadPr | Record<string, never>)[] };
  rateLimit: RateLimit;
}

const MAX_PAGES = 5;

export async function fetchLoad(org: string, me: string): Promise<Load> {
  const prs: RawLoadPr[] = [];
  let after: string | null = null;
  let data: LoadData | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    data = await graphql<LoadData>(LOAD_QUERY, { q: `org:${org} is:pr is:open archived:false`, after });
    prs.push(...data.search.nodes.filter((n): n is RawLoadPr => "id" in n));
    if (!data.search.pageInfo.hasNextPage) break;
    after = data.search.pageInfo.endCursor;
  }
  return { org, openPrs: data!.search.issueCount, loads: reviewerLoad(prs, me), rate: data!.rateLimit };
}
