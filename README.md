# PR Desk

One live page for everything PR-shaped: your own pull requests ordered by what to do next, the reviews people asked of you, and how loaded each reviewer already is.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

On the machine running it there's nothing to sign in to: the dev server reads the token the `gh` CLI already holds (`gh auth token`). Make sure `gh auth status` shows you logged in.

The server also answers NetBird peers (any `100.64.0.0/10` address, and `*.netbird.cloud` host names) and refuses every other network. Peers don't get the gh token, since it can write to every repo you can; each device pastes its own once. Start it with `PR_DESK_SHARE_TOKEN=1 npm run dev` to hand the gh token to peers too.

On a static host there is no dev server, so the page asks for a token once per browser and keeps it in that browser's local storage. Use a classic token with `repo`, `read:org` and `notifications`, or paste the output of `gh auth token`. The token is only ever sent to api.github.com.

## What it shows

- **Queue**: your open PRs and review requests, grouped by next action (needs you, self-review, waiting on reviewers, blocked by a lower PR in a stack, quiet for 30+ days), by repository, or by story. A PR with no reviewer requested counts as still in self-review, draft or not.
- **Reviewers**: every person or team with open review requests in your main org, how many are pending, how many are yours, and the oldest.
- Rows changed since you last left the tab get a blue dot and say what changed.
- Copy for Teams puts a rich link on the clipboard: the title linked, then size and `repo#number`.

Keys: `j`/`k` move, `o` opens the selected PR on GitHub.

## Cost

A 1-point probe runs every minute and only PRs whose `updatedAt` or check state changed are fetched in full, so a quiet hour costs about 100 of the 5,000 GraphQL points.

## Develop

```bash
npm run typecheck
npm test
npm run build
```
