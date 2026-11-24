# Guides section: plan and sample (draft)

Status: sample design for owner review, 24 November 2026. Not linked from live pages; not for upload until approved.

## Why

The site is technically sound (fast, structured data, hreflang) but has little content that answers what parents search for. Brand searches find it; "baby feeding tracker" or «εφαρμογή για ταΐσματα μωρού» hardly do. A small set of genuinely useful guides fixes that for Google and for AI answer engines, without risking Google's spam policies.

## Rules for every guide

- One real question per guide, answered in the first paragraph.
- Written or reviewed line by line by the founder; real experience. Greek written in Greek, not machine-translated.
- No medical advice (same rules as the app, `src/i18n/copyRules.test.ts`). Health questions point to the midwife or doctor; facts about health cite official sources (NHS, WHO, national health services).
- Every claim about the app checked against the app (labels, night mode 21:00–06:00, sharing needs an account).
- 600–1,000 words, 3–6 sections, a tip, "How Moraki helps", the notice, related guides, store badges.
- Byline (Makis), published and updated dates, `Article` + `BreadcrumbList` JSON-LD, canonical and hreflang EN/EL, entry in sitemap and llms.txt.
- Cadence: 1–2 a month. Quality over count.

## Structure

- `/guides/` and `/el/guides/`: hub with a card per guide, plus the existing age guides.
- `/guides/<slug>/` and `/el/guides/<slug>/`: same slug in both languages so hreflang pairs cleanly.
- Main nav: "Age guides" becomes "Guides" (the age guides stay, linked from the hub).

## First six topics

| #   | Slug                        | EN title                                        | EL title                                                    | Question it answers                                                           |
| --- | --------------------------- | ----------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | night-feeds-two-parents     | Night feeds with two parents: a simple handover | Νυχτερινά ταΐσματα με δύο γονείς: μια απλή παράδοση βάρδιας | How do we share nights without waking each other to ask? (**sample written**) |
| 2   | handover-grandparents-nanny | Handing over to a grandparent or a nanny        | Όταν το μωρό μένει με τη γιαγιά ή τη νταντά                 | What do I write down before going back to work?                               |
| 3   | notes-before-check-up       | Notes to bring to a check-up                    | Σημειώσεις για το ραντεβού με τον παιδίατρο                 | How do I remember my questions in the room?                                   |
| 4   | logging-one-handed          | Logging with one hand at 4 a.m.                 | Καταγραφή με το ένα χέρι στις 4 το πρωί                     | How do I keep track when I'm exhausted?                                       |
| 5   | paper-notes-or-app          | Paper, phone notes or an app?                   | Χαρτί, σημειώσεις στο κινητό ή εφαρμογή;                    | What do other parents actually use? (uses the Instagram poll)                 |
| 6   | first-week-home             | The first week at home: what to keep track of   | Η πρώτη εβδομάδα στο σπίτι: τι να καταγράφεις               | Where do I start? (careful: points to midwife for any health question)        |

### Outlines (2–6)

2. Handover: what changes when someone else takes over · the one-page handover (routine times, where things are, who to call) · invite as Caregiver or Viewer · checking in without calling every hour · tip: a trial day before work starts.
3. Check-up notes: write questions when you think of them · what to bring (the summary report, appointment entry) · during the visit: one person asks, one writes · after: add the answers to the appointment · notice: Moraki doesn't interpret numbers.
4. One-handed logging: put the app on the home screen dock · two taps and prefilled amounts · undo if you mis-tap · night mode · log later is fine: fix the time in History.
5. Paper vs phone vs app: honest pros and cons of each · what breaks when two people share · what to look for in an app (privacy, offline, sharing) · results of our poll.
6. First week: keep it simple, log what you'll be asked about · one notebook for everyone from day one · don't chase numbers · notice and links to official newborn care pages.

## Sample

Built by `tools/guides/build.py` (content in `tools/guides/content.py`) from the age-guides page template: `public/guides/`, `public/el/guides/`, and the guide `night-feeds-two-parents` in both languages. Cards 2–6 are shown faded as placeholders; they must not go live as empty pages (thin content). Before publishing: OG images per guide, sitemap and llms.txt entries, nav change on every page, footer link.
