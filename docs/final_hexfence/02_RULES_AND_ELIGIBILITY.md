# 02. Rules and eligibility: can the two projects be one submission?

**Short answer: not tonight.** Pramaan's code predates kickoff. Putting it into HexFence would turn a clean Classic entry into a "ported" project. That costs Finalist eligibility and very likely the from-scratch partner prizes. Submit HexFence alone (option A). Merge after payout.

## 1. Timeline of both repos (IST)

Read from `git log --all` in both repos on 6 Nov at 22:45, and from the event site.

| When | What happened | Source |
|---|---|---|
| 4 Nov | Pramaan code written | Pramaan's own [ETHGLOBAL_STRATEGY.md](../Pramaan/pramaan/docs/ETHGLOBAL_STRATEGY.md) §1: "IMPLEMENTATION_PLAN.md and SPONSORS.md explicitly describe code written on November 4" |
| 5 Nov 01:01 | Pramaan base commit `6d30220` "Initial commit: Pramaan codebase with VaultLab and PermitMarket demo apps" | Pramaan git |
| 5 Nov 01:47–10:32 | 10 more Pramaan commits; the last before kickoff is `1f10464` | Pramaan git |
| **5 Nov 21:00** | **Hacking begins** | Site capture: "hacking begins Thu 5 Nov, 9:00 PM" |
| 6 Nov 01:19 | HexFence first commit `dc6e0c6` "Initial commit" | HexFence git |
| 6 Nov 17:45–22:43 | Pramaan commits resume (Dhruv, Aksaht, Deven), 11 so far | Pramaan git |
| 6 Nov 18:24 | HexFence `main` at `e3e35f7` (PR #46); 226 commits across branches | HexFence git |
| 6 Nov 22:00 | HexFence code freeze (team plan) | [TEAM_HANDOFF](../hexfence/docs/TEAM_HANDOFF.md) |
| 7 Nov 09:00 | Submissions due | Site |
| 7 Nov 09:30 | Finalist judging and partner judging | Site schedule |

Visibility (GitHub API, 23:00): `Deven1305/hexfence` is **public**; `Deven1305/eth_pramaan` returned **404** (private or not visible).

The team confirmed its registration is **From Scratch** (Pramaan strategy doc §1, 5 Nov).

## 2. The rules, word for word

From the ETHGlobal Mumbai pages captured on 19 Oct ([site capture](../ETHGlobal_Mumbai_2026_Site_Capture.docx)). A 6 Nov web search showed the same Classic and Continuity text on the live [rules page](https://ethglobal.com/events/mumbai/info/details).

| Rule | Exact words | What it means here |
|---|---|---|
| Classic track | "all work on your project must begin after the hackathon officially starts. Any prior project-specific code, **designs**, or assets are not allowed unless they're from public libraries or starter kits. Projects built before the event may still participate but **won't qualify for partner prizes or the Finalist category**." | Pramaan's code and designs are prior project-specific work. In HexFence, they would put the whole entry at risk. |
| Continuity tracks | "you may build on an existing codebase … Continuity submissions must **clearly document pre-existing work** and include new features or functionality developed during the hackathon; eligibility for partner prizes **may vary** by event and partner." | A merged entry is only possible here, and only with full disclosure. |
| Porting (FAQ) | "if there is a situation where a project / team are porting or continuing existing projects then the result is that you may continue to participate but **you won't be eligible for being an ETHGlobal Finalist**." | A merge means no Finalist slot. |
| One project (FAQ) | "Can I join two teams/projects? **No.**" | There is only one submission for this team. |
| Version control | "Submissions with large single commits or missing histories may be disqualified" | A merge commit that drops 5,000 Pramaan files into HexFence is exactly that. |
| Transparency | "Clearly distinguish between what's new and what's reused." | Keep the "No pre-event Pramaan code" line in [JUDGE_READINESS](../hexfence/docs/JUDGE_READINESS.md). |
| AI tools | "Submissions that rely entirely on AI without meaningful contributions from team members may not be eligible for partner prizes or finalist consideration." Spec-driven work: "you must include all spec files, prompts, and planning artifacts in your submission repository." | Do the human items, and add the missing upgrade plan ([01](01_TONIGHT_SUBMISSION_PLAN.md) step 1). |
| After submission (FAQ) | "you should not be working on your project again until PRIZES have been officially paid out / distributed" | The merge waits for payout. |
| Project page | "You may not add features to existing work but can use boilerplate code." "You[r] repo must remain public" | Same direction as Classic. |
| Partners | "select up to 3 Partner Prizes"; EF "places a project in at most one of its prizes" | HexFence's plan already follows this: Arkiv + EF CROPS + Chainlink if gated in. |

**The pages contradict each other.** The Project page and FAQ still say "from scratch only". Info → Rules adds the Continuity tracks. One FAQ answer says partners may award "any project … that meets the requirements", while the Classic rule says pre-built projects "won't qualify for partner prizes". When rules conflict, the strictest reading protects you, and that is option A.

## 3. The options in detail

### A. HexFence alone, Classic (recommended)

- Eligible for Finalist and the from-scratch partner prizes, as planned in [SUBMISSION.md](../hexfence/docs/SUBMISSION.md).
- No organiser question is needed, no code change and no new video.
- Its one weak spot is AI reliance. Fix it with the human items in [01](01_TONIGHT_SUBMISSION_PLAN.md) step 2, recorded in AI_USAGE.

### B. Merged project, moved to a Continuity track

What it would take, all before 09:00:

1. Organisers approve moving the dashboard project from Classic to "Ship a Feature" (Pramaan is private, so that track fits: "private → public"). Whether a change is allowed this late is unknown.
2. Make Pramaan public after a secret scan. It has a local `.env` and `.pramaan/demo/keys.json`; confirm neither is tracked.
3. Add a README section that separates pre-event work (Pramaan up to `1f10464`) from event work (all of HexFence plus the new integration).
4. Merge two monorepos (Hardhat + Foundry, two extensions, two decoders, two CRE workflows) and keep CI and the live Pages site green.
5. Record a new video.

What it would cost:

| Prize | Option A | Option B |
|---|---|---|
| ETHGlobal Finalist | Eligible | Lost (porting rule) |
| Arkiv | "Build on Arkiv (from scratch)" | That track is lost. Whether a Continuity Arkiv track exists was not verified |
| EF | Best CROPS App, $3,500 pool (1st $2,000) | Best CROPS Upgrade to an Existing Project, $1,500 pool |
| ENS | Not used | General ENSv2 track ($7,000 pool) needs a real Sepolia or mainnet deployment, but Pramaan's ENS setup has only run on local forks; the existing-project track ($3,000) needs **mainnet** (Pramaan strategy doc §3) |
| Chainlink CRE | Same gate (real simulation output) | Same gate |

**Verdict:** B earns less and risks more. Only consider it if organisers say yes in writing **before 00:30**, and even then A is still the better bet.

### C. Merged, still called Classic: never

This would mean presenting pre-event code as event work. Re-dating commits, squashing history, retyping files or moving them into a fresh repo does not change when the work was done. Pramaan's own strategy doc says the same. The risks are disqualification and a damaged record with ETHGlobal.

## 4. Why "rebuild Pramaan from scratch tonight" does not help

- The Classic ban covers **designs** too. A fresh rewrite of Pramaan's ENS release record, timelock and manifest design is still a prior project-specific design.
- Pramaan's strategy doc: "Do not imply that a clean implementation automatically cures use of prior project-specific designs."
- HexFence is in its code freeze, and the remaining hours belong to the human items and the video.

## 5. What is allowed

- Ideas and research from before the event. The FAQ: "you can familiarize yourself with all the tools and technologies you intend to use beforehand".
- Open-source libraries and starter kits, named in the README (HexFence already lists Safe contracts, the Arkiv SDK, viem, zod and others).
- AI tools, with attribution and real human contribution.
- Talking about the post-event merge as a roadmap in Q&A.

## 6. If you still want to ask the organisers

Ask in person at the help desk (the event is in person at Jio World Convention Centre) or in the ETHGlobal Discord help channel. Get the answer in writing and save it in the repo.

> Hi, this is team HexFence (Deven Mahajan, Dhruv Kothari, …). Our project HexFence is registered in Classic / From Scratch. Its public repo, github.com/Deven1305/hexfence, starts on 6 Nov at 01:19 IST and contains no pre-event code.
> Separately, some of us built a private prototype, Pramaan, before the event (first commit 5 Nov 01:01 IST). We are **not** submitting it.
> 1. Can you confirm that HexFence as submitted is eligible for Finalist and partner prizes?
> 2. For information only: if we combined Pramaan into HexFence, would that require a Continuity track, and which prizes would remain open?

Question 1 is optional, because HexFence already discloses "No pre-event Pramaan code". Ask it only if the team wants certainty. Question 2 matters only for option B.
