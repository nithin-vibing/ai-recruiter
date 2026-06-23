# ADR 0001: Remove n8n — Call Claude Directly from Next.js API Routes

**Status:** Accepted  
**Date:** 2026-06-23

## Context

The app had two API routes (`generate-rubric`, `screen-resume`) that proxied requests through an n8n cloud workflow before reaching Claude. This introduced:
- A paid third-party dependency (n8n subscription)
- A network hop and failure point outside our control
- Indirection that made debugging harder (errors could originate in n8n, not just our code)

The workflows themselves were thin: receive input → build prompt → call Claude → return JSON. No branching logic, no state, no retry sophistication that justified a workflow engine.

A third route (`rescore`) already called Claude directly, proving the pattern worked.

## Decision

Replace both n8n-proxied routes with direct Anthropic SDK calls inside the Next.js API routes. No workflow engine. No external dependencies beyond Claude.

## Consequences

- Eliminates n8n subscription cost
- Reduces failure surface: errors are now either our code or Claude's API, nothing in between
- Prompts and model config live in the codebase — version-controlled, reviewable, testable
- We own retry logic if we need it (we can add it; n8n wasn't doing anything special here)
