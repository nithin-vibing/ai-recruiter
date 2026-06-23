# ADR 0003: Progress via Supabase Polling (Not Streaming)

**Status:** Accepted  
**Date:** 2026-06-23

## Context

With parallel scoring, a 100-resume job takes ~1 minute. The user needs feedback that work is happening, and ideally how far along it is.

## Decision

Poll Supabase every 2 seconds from the client. Count candidates with a non-null `score` for this project. Render as `X / N scored` with a progress bar.

## Consequences

- No websockets, no SSE — just a `setInterval` fetch against Supabase
- Reuses the existing Supabase client already in the frontend
- Slightly laggy (up to 2s behind reality) — acceptable for this use case
- Client must know total N upfront (set when ZIP is uploaded, before scoring starts)
