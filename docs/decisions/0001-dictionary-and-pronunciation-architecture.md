# ADR 0001: Persistent dictionary on the VPS with cached Google Iapetus audio

Status: accepted product direction; implementation details and rollout pending.

Date: 29 October 2026.

## Context

The user wants to preserve Word Atlas’s redesigned interface while greatly expanding word and idiom coverage, retaining concise source-authored definitions, moving saves/history out of localStorage, and hearing clear pronunciation promptly. The user selected US English Iapetus after auditioning six Google voices and requires no additional spending. The mini PC should not be required. The VPS has spare CPU/RAM but needs disk preparation before a large corpus import.

## Decision

Use the existing React/Express/Caddy stack and VPS PostgreSQL service. Import a versioned English Wiktionary/Kaikki corpus into a dedicated Word Atlas database. Make phrases, forms, and pronunciation variants first-class lookup data. Preserve source-specific definitions, examples, attribution, and stable identities across corpus releases.

Continue Learner’s and Collegiate as optional live editorial sources, completing the current adapters and fallback behavior. Do not assume permission to build a permanent proprietary corpus. Every submitted term and the user’s own saves/history are persistent, including unresolved searches; proprietary text is not implicitly included in that promise.

Use `en-US-Chirp3-HD-Iapetus` at normal speed, with verified pronunciation guidance for heteronyms. Generate on demand through one bounded worker, store compressed audio on persistent VPS storage, and reference it from PostgreSQL. Share assets across users by pronunciation/configuration identity and preload on entry open. Use durable allowance reservations and fail closed when free-tier capacity is unknown or exhausted. No spending or welcome-credit use is authorized by this design.

The VPS also performs bounded streaming imports. Keep a recoverable copy of personal data outside the VPS without relying on the mini PC. Exact backup destination and production identity are deployment checks, not reasons to change the selected voice or buy infrastructure automatically.

## Alternatives considered

- Mini-PC import or speech worker: adds an availability dependency the user does not want; unnecessary with bounded VPS imports and Google synthesis.
- Local Piper/Kokoro as the default: superseded by the user’s explicit Iapetus selection. Do not silently switch voice to avoid a limit.
- External APIs as the only dictionary: retains missing-word and availability problems and cannot provide an owned broad corpus.
- Paid Oxford corpus or AI-written definitions: outside the cost direction and source-authored editorial requirement.
- Audio bytes in PostgreSQL or regeneration on every click: unnecessary database/backup pressure or repeated provider requests. Use durable files plus transactional metadata.
- Extra search/queue infrastructure: PostgreSQL indexes and a small job table are sufficient for the initial personal-use scope; revisit only with measurements.

## Consequences

Coverage becomes independent of one provider, and repeats avoid synthesis calls. Attribution, import quality, sense mapping, backup recovery, and free-allowance accounting become explicit responsibilities. First-time generation remains network-dependent. A local ledger cannot control unrelated consumers of the same Google billing allowance; uncertain shared usage must stop new generation. The exact indexed corpus size and supported concurrent load must be measured before rollout.

## References

- [Implementation architecture](../../tasks/plan.md)
- [Execution checklist](../../tasks/todo.md)
- [Dictionary research](../research/dictionary-sources-2026-10-26.md)
- [VPS reassessment](../research/vps-only-feasibility-2026-10-29.md)
- [Voice audition and user selection](../research/audio-comparison/google-free-tier-2026-10-29/README.md)
