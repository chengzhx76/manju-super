# Notes: Flow Optimization Batch (1,3,6)

## Scope
- 1) Incremental rerun: rerun only changed slices/steps where possible.
- 3) Shot quality validator: detect and repair consistency/structure issues after shot generation.
- 6) UTF-8 guardrails: enforce/verify encoding to avoid mojibake.

## Findings
- Existing pipeline already supports step checkpoint resume, but not cross-run incremental decisions.
- ScriptData had no persistent generation fingerprints; added `generationMeta` to support stale-step detection.
- `generateShotList` originally regenerated all scenes serially; now supports scene-level reuse via signature matching.
- Added deterministic shot quality evaluation and repair directly in generation output.
- Added `.editorconfig`, `.gitattributes`, and `scripts/check-utf8.mjs` with `npm run check:utf8`.

## Implemented Behavior
- Analyze step now computes `structureKey/visualsKey/shotsKey` and only reruns stale stages.
- Structure rerun reuses prior character/scene/prop visual data where compatible, then visual pass can run in `onlyMissing` mode.
- Shot generation can reuse unchanged scenes from previous results and remap old asset IDs to new IDs.
- Post-generation quality pipeline scores each shot and applies targeted deterministic repairs for weak shots.
- Build now runs UTF-8 check before Vite build.

## Validation
- `npm run check:utf8` ✅
- `npm run build` ✅
