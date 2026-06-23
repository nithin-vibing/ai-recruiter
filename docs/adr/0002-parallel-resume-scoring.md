# ADR 0002: Score Resumes in Parallel with Concurrency Cap

**Status:** Accepted  
**Date:** 2026-06-23

## Context

Screening 100 resumes sequentially (one Claude call at a time) takes 3–5 minutes. Users are left waiting at a blank loading screen, which feels broken.

## Decision

Score resumes in parallel with a concurrency cap of 5 simultaneous Claude calls. Implemented as batched `Promise.all` — process 5 resumes, await, then the next 5.

## Consequences

- 100-resume job drops from ~5 min to ~1 min
- Stays within Claude's rate limits (5 concurrent is conservative)
- Cap is a single constant — easy to tune up or down
- Slightly more complex than a `for` loop, but the pattern is standard and readable
