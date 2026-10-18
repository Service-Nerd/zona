# Exercise demo media — suppliers researched (STRENGTH-ENGINE-01 Phase 3)

**Asked:** founder, 2026-10-18: *"research online to find me suppliers that we can use. Ideally I want this free."*
**Status:** research only. **Decision is the founder's** (supplier, spend); the SLT prices it if it is paid. Nothing
signed up for, downloaded or accepted. **Constraints already ruled:** licensed media, **no embedded YouTube**
(developer-policy risk in a paid tier), self-hosted or CDN, no watermark. **Our list:** 99 exercises in
`packages/strength/catalogue.ts`.

## Comparison (licences read on each source's own site, 2026-10-18)

| Source | Format | Licence | Paid app? | Credit | Restyle | Est. coverage | Verdict |
|---|---|---|---|---|---|---|---|
| free-exercise-db (yuhonas) | 2 JPG photos each | Unlicense (public domain) | On paper | No | Yes | ~35–45% | 🔴 Photo provenance unknown: a PD stamp from someone who may not own them protects nobody. Dated look |
| wger | PNG/SVG | per image, sampled CC-BY-SA 3.0 | Yes | **Visible credit** | Share-alike | Low (383 images site-wide) | Thin on rehab and plyometrics |
| Everkinetic | SVG drawings | CC-BY-SA-4.0 | Yes | Yes | Share-alike | ~20–30% | Clean line art; no Pallof, Copenhagen, pogo |
| ExerciseDB v1 (free API) | GIF, 1,500 | **none published** | Unknown | Unknown | Unknown | Probably high | 🔴 No licence anywhere; GIF provenance questioned publicly |
| MuscleWiki API | Video | API terms, $10–200/mo | Paid plans | ToS credit | **No** | High | 🔴 No re-hosting, branding must stay: fails two of our rules |
| Wikimedia / Openverse | Mixed | per file, mostly CC-BY-SA | Usually | Yes | Share-alike | ~0 | Not workable at scale |
| Pexels / Pixabay / Mixkit | Stock video | free licences (Mixkit has a non-commercial variant) | Mostly | No | Yes | ~5–15% | Lifestyle footage, not consistent demos |
| LottieFiles free | Lottie JSON | Lottie Simple License | Yes | No | Same licence | <10% | Generic, not exercise-accurate |
| RepDB free tier | flat WebP, 2 poses | **GitHub says commercial OK; pricing page says CC BY-NC** | ⚠️ contradictory | Yes | Yes | ~60% | Do not rely on it without written confirmation |

## Recommendation
- **No free source is good enough to ship as the main one.** The clean free licences (Everkinetic, wger) need visible
  credit and share-alike on edited images and cover about a quarter of the list, with almost no running-specific moves.
  The high-coverage free ones have no provable licence.
- **Best value if paid:** **RepDB Standard, $499 one-time** (repdb.co): 643 looping animations, transparent
  background, no watermark, commercial iOS and subscriptions covered, FAQ allows colour adjustment (read the full
  licence before buying: the recolour right was seen only in the FAQ). Starter (stills) $299; female character +$99.
  Spot check: ~22 of 37 of our names matched (~60%); misses are the running-specific ones (Copenhagen plank, pogo
  hops, soleus raise, 90/90 switch, skater squat, drop jump, bounding, A-skip, Y-T-W, band pull-apart, half-kneeling
  chop, squat jump).
- **Other paid fallbacks:** WorkoutLabs (≈$1.5–2.5k for 99 illustrations perpetual; animation extra, unpublished);
  Upwork 3D packs ($95–195 for 100–130; licence and quality vary by seller).
- **Realistic plan if media goes ahead:** RepDB for ~60%, commission the ~40 running-specific gaps in the same style.

## What would block use
ExerciseDB v1 and free-exercise-db (no confirmed owner of the media) · MuscleWiki (no self-hosting, branding) · RepDB
free tier (contradictory pages). Coverage figures other than RepDB's are estimates, not full counts.
