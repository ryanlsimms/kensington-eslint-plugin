---
name: Changelog entries go under Unreleased
description: Always add new changelog entries under an [Unreleased] heading, not a versioned heading
type: feedback
---

Always add new changelog entries under `## [Unreleased]`, not a dated version heading like `## [0.2.0] - 2026-05-21`.

**Why:** User corrected this explicitly — versioning is a separate step done at publish time.

**How to apply:** Any time a changelog entry is needed, prepend it under `## [Unreleased]` at the top of the changelog body.
