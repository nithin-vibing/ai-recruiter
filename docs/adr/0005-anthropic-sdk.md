# ADR 0005: Use Official Anthropic SDK Instead of Raw Fetch

**Status:** Accepted  
**Date:** 2026-06-23

## Context

The existing `rescore` route called Claude via raw `fetch` with manual header construction and error parsing. No automatic retries on rate limits or overload (HTTP 529).

## Decision

Use `@anthropic-ai/sdk` across all Claude-calling routes.

## Consequences

- Typed responses — no manual JSON parsing or type assertions
- Automatic retries on 529 (API overloaded) out of the box
- Cleaner error handling via typed error classes
- One additional dependency, but it's Anthropic's own — stable and maintained
- `rescore` route will be updated to match for consistency
