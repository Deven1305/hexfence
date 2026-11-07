# Merging Pramaan into HexFence

Fallback: the tag `hexfence-pre-pramaan` marks the last `main` without Pramaan. We can always submit from it.

## Rules that apply

From [ETHGlobal's rules](https://ethglobal.com/rules), section "Rules on Pre-existing Work":

- Only bring in work made after kick-off. Pre-existing project-specific code, designs or assets are not allowed on the Classic "From Scratch" track, and they make a submission ineligible for Partner prizes and the Finalist category.
- Any pre-existing work must be disclosed in writing to ETHGlobal and in the submission.
- Repos with single commits of large files and no proper history are assumed unqualified unless proven otherwise, so keep the commit history.

## How to work

1. Work on your own branch (`feat/pramaan-…`) in your own worktree. `main` only changes through a PR after a green `build` check. No force-push.
2. Keep Pramaan's history, for example `git subtree add --prefix=pramaan <url> main` (not tested here). Never paste it in as one big commit. Keep it under `pramaan/`, outside `pnpm-workspace.yaml`, because both repos have `apps/`, `packages/` and `contracts/`.
3. The hosted site is static GitHub Pages. Anything that needs Pramaan's server or Docker won't run there, so don't link judges to it unless it is hosted and tested.
4. Don't change `HexFenceGuard` v1, V2, the module guard or their tests. Don't edit `AGENTS.md`, `docs/INTERFACES.md` or `docs/planning`.
5. Keep the wording rules: status is always "suspected"; no "verified", "scam", "malicious", or "safe" as an adjective in UI text. Unsupported transactions show "cannot verify". Only claim what the merged feature really does.
6. Secrets stay in the ignored `.env`. Pramaan's keys must not land in commits, logs or the built site.

## Before any PR to `main`

Run all of these:

```bash
cd contracts && npx hardhat test
```

```bash
corepack pnpm@10.34.9 -r test
```

```bash
corepack pnpm@10.34.9 -r build
```

Then open the built site, explorer and Pay, and confirm that nothing already working broke.

## If `main` changes after the release record

The planned release record on Arkiv binds one build's `SHA256SUMS.txt` to one commit. A later build makes it out of date, and the demo video should show the build we submit. So tell Dhruv before any Pramaan work lands on `main`, or as soon as you know it won't.
