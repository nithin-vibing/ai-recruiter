# ADR 0004: Mark Failed Resumes, Don't Skip Silently

**Status:** Accepted  
**Date:** 2026-06-23

## Context

With parallel Claude calls, some will fail (network errors, malformed PDF text, non-JSON response). The existing `rescore` route swallows errors silently — failed candidates simply don't appear in results.

## Decision

Add a `status` field to the `candidates` table (`pending | scored | failed`). If a Claude call fails after one attempt, set `status: "failed"` and surface it in the UI as "Could not score — review manually."

## Consequences

- No silent data loss — user always knows the full picture
- Simple to implement: just a `.update({ status: 'failed' })` in the catch block
- No retry logic (adds complexity; failures are rare and the user can re-run)
- Progress bar counts `scored + failed` toward completion so it always reaches 100%
