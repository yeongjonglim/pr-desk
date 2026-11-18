# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript, built with Vite. A static app with no backend of its own. Run locally, the Vite server hands the page the gh CLI's token; on a static host the user pastes a classic token once per browser.

## Users

One engineer who opens many PRs a day across a few repos in one GitHub organisation, often as stacks of dependent PRs, reviews teammates' PRs, and occasionally hears from other organisations. They check in first thing in the morning and between meetings, and want to know in seconds what changed and what to do next, from whichever device is at hand.

## Product Purpose

Replace hopping between GitHub's notifications inbox, pull request list and saved searches with one live page that answers "what should I do next?" for everything PR-shaped. Success: the user stops opening GitHub's lists to triage, and spends less effort chasing reviewers.

## Positioning

GitHub's lists show PRs; this shows the next action on each one, from facts the lists hide: whether a reviewer was asked at all, who holds a PR and for how long, how loaded each reviewer already is across the organisation, unresolved threads, where a PR sits in its stack, and what changed since the user last looked.

## Operating Context

- Auth: the gh CLI's token when served locally (this machine only), otherwise a pasted classic token (`repo`, `read:org`, `notifications`). Fine-grained and GitHub App tokens can't read notifications. No OAuth App.
- Data: a 1-point GraphQL probe every minute (ids, updatedAt, check state); full details only for PRs that changed, in parallel batches of 10; a full refresh every 10 minutes; organisation-wide reviewer load every 2 minutes. Near-live by polling, since GitHub has no browser push.
- Ticket keys (`ABC-123`) come from a bracketed title prefix or the branch name; a Notion link in the PR body becomes a ticket link.
- Copy-outs are pasted into Microsoft Teams, which keeps HTML links.
- The local server can be reached over a NetBird mesh; it refuses every other network.

## Capabilities and Constraints

- One merged queue ordered by what to do next, mixing own PRs and review requests; group by next action, repository or story.
- Own-PR states: **self-review** = no reviewer requested yet, draft or not (PRs go ready just to run CI); **waiting on reviewer**; **needs you** (merge, failing checks, conflicts, changes requested, unanswered threads, reviewed and needs asking again); **blocked by stack**; **quiet** after 30 days without activity. Drafts never land in "needs you".
- A request to a team only counts as requested but shows as team-only.
- Reviewer load: per person or team, pending requests across the organisation, how many are the user's, the oldest.
- Undecided: notifications inbox, other-organisation notifications, multi-select copy, desktop notifications.

## Product Principles

1. Next action over status: every row says what to do, not just what it is.
2. Show what GitHub hides: reviewer presence and load, holder and age, stack position.
3. Glanceable in seconds, then deep on demand.
4. Private: the token stays in the browser, and nothing leaves except calls to GitHub.
5. One page, not a second inbox to manage.
