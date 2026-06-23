# ADR 0006: Model Selection by Task Complexity

**Status:** Accepted  
**Date:** 2026-06-23

## Context

Two distinct AI tasks with different complexity and frequency profiles. Using the same model for both either overpays for repetitive work or underperforms on reasoning-heavy work.

## Decision

- **Rubric generation → `claude-sonnet-4-6`**: One-time per project, reasoning-heavy (infer criteria from unstructured JD). Quality of rubric directly determines quality of all downstream scoring.
- **Resume screening → `claude-haiku-4-5-20251001`**: Runs N times per job (once per resume). Output format is fixed JSON. Speed and cost matter at scale.

## Consequences

- Rubric quality is maximised — it's the foundation everything else is scored against
- Screening cost scales cheaply: Haiku is ~20× cheaper than Sonnet per token
- Clear rule for future tasks: one-time reasoning → Sonnet, repetitive extraction → Haiku
