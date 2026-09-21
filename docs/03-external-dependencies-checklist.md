# Moraki: External Dependencies Checklist (Makis)

This is everything that has to exist outside the repo before Claude Code can work through the phases without stopping to ask you for a missing account or key. Ordered by when it's needed. "Needed for P0" items block the very first commit — do those before you tell Claude Code to start.

Give Claude Code the credentials by putting them in a local `.env` file (never commit it — P0-01 adds it to `.gitignore` immediately) or by pasting them into the chat when it asks. Anything marked (secret) should never go in a doc, a commit, or Slack.

---

## Status (21 Sept)

| Item | Status |
|---|---|
| 1. GitHub repo | ✅ Done — https://github.com/codedesignseu/moraki.app |
| 2. Expo/EAS token | ⚠️ Generated, but pasted in plaintext chat — **revoke it and generate a fresh one**, then put only the new one in your local `.env` |
| 3. Second (Android) phone | Not available yet. Plan adjusted below — not a blocker |
| 4. Apple / Google accounts | Sequenced below: browser-first, no store account needed yet |
| 5. Supabase project | ✅ Created — send the project URL and anon key via `.env`, not chat |

---

## Needed for P0 (today, before the first commit)

### 1. GitHub repository — done
- https://github.com/codedesignseu/moraki.app, private.
- Nothing further needed here for P0.

### 2. Node and package manager
- Node 20 LTS installed locally (`node -v`).
- npm is fine; the SDD doesn't require pnpm or yarn. If you prefer one, say so, otherwise Claude Code will use npm.

### 3. Expo / EAS account
- Sign up at expo.dev (free) — done, token generated.
- ⚠️ **The token you generated needs to be revoked and replaced.** It was pasted into this chat in plaintext, so treat it as compromised even though nothing malicious happened — expo.dev → Account Settings → Access Tokens → revoke the old one → generate a new one.
- Put the new token only in your local `.env` (Claude Code's working directory, gitignored from commit one) — never in a chat message, a doc, or a commit. When CI needs it later, it goes in as a GitHub Actions secret named `EXPO_TOKEN`, set directly in the repo's Settings → Secrets, not pasted anywhere else.
- No payment needed at P0. EAS Build's free tier covers early dev builds; you may hit its monthly limit around P2 to P3 and need the $29/month plan. Not urgent.

### 4. Devices — revised for iPhone-only
- You have an iPhone, no Android device yet. That's fine for P0 and P1 — build and test iOS first.
- For P2 (two-phone sync), Claude Code will use an Android emulator as the second device to prove the sync logic itself works. That's enough to validate the code, but **not** enough to trust real-world notification delivery — Android phones from Xiaomi, Huawei and Samsung in particular are known to kill scheduled background notifications under their own battery-saving modes, and an emulator won't reveal that.
- Action: no rush, but before P3's dogfood period starts, borrow a real Android phone for a day (a friend's, a family member's) and let a feed reminder run on it undisturbed. If you know now you'll have a second caregiver with an Android phone anyway, that's your real-world test and nothing extra is needed.

### 5. Store accounts — sequenced to start free, in the browser
You asked to prove things out in a browser before creating paid accounts. Here's how that actually breaks down:

- **What needs no store account at all:** Expo can run this app as a normal web page (`expo start --web`) in Chrome, with zero Apple or Google involvement and no cost. That covers all of phase 0 (design tokens, colours, primitives) and most of phase 1's screens and forms, since those are UI and logic you can click through in a browser tab. Claude Code will use this for early visual review.
- **What can't be proven in a browser, ever:** the two things that are the actual point of the app — SQLite persisting data the way a real phone does, and a local notification firing while the screen is off. Those only exist in a real device build.
- **The catch:** a real iOS device build requires Apple's code signing no matter how it's installed on your phone, which means the $99 Apple Developer Program enrollment is unavoidable once you want to see the reminder actually fire — there's no free workaround for a non-expiring install on a real iPhone.
- **So: start Apple enrollment today anyway**, in parallel with the browser work, purely because it's a waiting-on-Apple step that costs you nothing while it processes. It doesn't block anything in phase 0. It only needs to have cleared by the time Claude Code reaches P1-14 (the local notification milestone), which is a few weeks out.
- **Google Play Console: genuinely defer.** Nothing before phase 4 touches it. Revisit this line when phase 3 wraps up.
- If Code Designs already has an Apple Developer account from client work, decide now: ship Moraki under that account, or enroll a fresh one. Separate is cleaner if you might spin this out later; reusing the agency account is faster today. Tell me which and I'll note it in the SDD.

### 7. Supabase account — project created
- One project created in the **EU (Frankfurt)** region — confirm the region if you didn't pick it explicitly, it matters for the GDPR posture in the SDD.
- Rename it `moraki-staging` if it isn't already, so the naming matches the SDD. `moraki-prod` can wait until P4.
- From Project Settings → API, put the **Project URL** and **anon public key** into your local `.env` (see the template file alongside this checklist). The **service_role key** goes in the same `.env` but is never used from the app itself — only from CI or edge functions later. None of these three go in chat, a doc, or a commit.
- Install the Supabase CLI locally (`brew install supabase/tap/supabase` or via npm) so Claude Code can run `supabase start` for local Postgres in Docker.
- **Docker Desktop** needs to be installed and running on your machine for local Supabase development. If you don't have it, get it now.

### 8. Domain (done)
- moraki.app is registered. Nothing else needed at P0 — DNS and any web landing page are a P4/P5 concern, not now.

---

## Needed by P2 (sync, households, invites) — start now, don't block on them

### 9. A second test phone or a willing second caregiver
- P2's gate is two phones, airplane mode, sync convergence. If you're testing this alone, you need two devices in hand, not one. A spare old phone works fine for the second device even if you're the only person logging on it.

### 10. Sentry account (only if you want it before P4)
- The SDD schedules this at P4-08, not urgent. Free tier is enough. EU data region must be selected at project creation — Sentry lets you pick this, don't skip it.

---

## Needed by P4 (beta)

### 11. Five beta households
- Named people, not "I'll find some." Recruiting takes weeks and this is explicitly called out in the SDD as a thing that can quietly become the critical path if you leave it late. Start asking now even though the software isn't ready — you're securing their agreement to try it in ~10 to 13 weeks, not asking them to use anything today.

### 12. A privacy/data protection lawyer contact in Cyprus, briefly
- Not for a drafted contract now — just identify who you'd call for a short review of the DPIA (P4-11) before the first outside household's data touches your system. Health data about an infant is a strong DPIA trigger per the SDD's compliance section, and this is not a step to skip because "it's just my own app."

### 13. App Store / Play Store listing assets (can wait, but plan for it)
- App icon, screenshots, a support email address, and a privacy policy URL are all required at submission time (P5), but the privacy policy in particular should be drafted alongside the DPIA at P4-11, not invented the week before submission.

---

## Not needed at all for the POC (P0–P3)

- Payment processing / Stripe. Pricing is deferred (ADR-008), not in scope until after beta.
- Apple/Google sign-in. Email OTP only through P4 (ADR-007).
- Any paid Supabase tier — the free tier's limits (500MB DB, 50k monthly active users) are nowhere close to being hit by a household POC.
- A company/legal entity for Moraki separate from Code Designs, unless you already know you want one. Can be decided post-beta.

---

## Quick summary: do these five things today

1. Create the GitHub repo.
2. Sign up for Expo/EAS, generate an access token.
3. **Start Apple Developer Program enrollment** — this is the slowest one and blocks iOS builds.
4. Start Google Play Console enrollment (fast, but do it now so it's not forgotten).
5. Sign up for Supabase, create `moraki-staging`, install the CLI and Docker Desktop.

Everything else on this list has a natural deadline later in the plan and I'll remind you when its phase gets close. Send me the Expo token and the Supabase staging project's URL/anon key when you have them (paste in chat or drop them as env vars) and Claude Code can start on P0-01 immediately with placeholders for anything still pending — Apple enrollment in particular doesn't need to be finished to start P0, only to reach P0-09.
