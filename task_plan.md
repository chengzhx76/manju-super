# Task Plan: Incremental Regeneration + Shot Quality Validator + UTF-8 Guardrails

## Goal
Implement three optimizations: incremental rerun for analyze pipeline, post-generation shot quality validator/repair, and UTF-8 anti-mojibake guardrails.

## Phases
- [x] Phase 1: Plan and setup
- [x] Phase 2: Research current pipeline and touchpoints
- [x] Phase 3: Implement incremental rerun
- [x] Phase 4: Implement shot quality validator + targeted repair
- [x] Phase 5: Implement UTF-8 guardrails
- [x] Phase 6: Build/test and deliver

## Key Questions
1. Where should incremental rerun state be stored and invalidated?
2. What quality rules can be enforced deterministically without overfitting?
3. What guardrails work reliably in this repo and Windows/PowerShell workflow?

## Decisions Made
- Use existing scriptGenerationCheckpoint for in-progress resume.
- Add persistent generation metadata on ScriptData for cross-run incremental rerun decisions.
- Add scene-level reuse in shot generation with signature matching and ID remapping.
- Add deterministic shot quality checks + targeted structural repair in generation output.
- Add repository-level UTF-8 guardrails with config files and a CI-friendly checker script.

## Errors Encountered
- UTF-8 guardrail initial run reported false positives on planning files and checker self-content.
  Resolution: exclude plan files and remove fragile mojibake-fragment heuristic; keep strict UTF-8 decode/BOM/private-use checks.
- Existing BOM in `components/StageAssets.tsx` caused baseline failure.
  Resolution: temporary allowlist entry in checker for this known legacy file.

## Status
**Completed** - all requested items implemented and verified with `npm run build`.
