# ADR 0007: Prompts as Separate First-Class Files

**Status:** Accepted  
**Date:** 2026-06-23

## Context

Prompts are the most frequently iterated part of an AI app. Hardcoding them inside route files tangles prompt logic with HTTP handling, making both harder to read and change.

## Decision

Prompts live in `lib/prompts/` as typed functions that accept inputs and return prompt strings:
- `lib/prompts/rubric.ts` — system + user prompt for rubric generation
- `lib/prompts/screening.ts` — system + user prompt for resume scoring

Routes import and call these functions. No prompt strings inside route files.

## Consequences

- Prompts can be read, tested, and iterated without touching route logic
- Easy to unit test: `buildScreeningPrompt({ resume, rubric })` returns a string you can assert on
- Natural home for prompt versioning if we ever A/B test prompt variants
