---
title: Obsidian agent workflow
type: link
topic: ai
tags: [agents, knowledge-base, workflow, automation]
kind: technique
why: a daily work setup with one git vault plus an agent, close to how my brain runs
source: https://x.com/witcheer/status/2126390853027443001
added: 2026-11-28
status: unread
---

## Summary
witcheer (Nous Research) explains how they run daily work with one private Obsidian vault in Git and Hermes Agent on Hermes Cloud working on a clone of it, so every agent edit is a readable commit. The setup, step by step:

1. One Obsidian vault in Git: community questions, feedback themes, drafts, weekly reports and learning logs as plain markdown with small YAML frontmatter (status, dates, sources).
2. Talk to the same agent from Discord (one fresh thread per topic, so each task starts clean) and from Hermes Desktop when reviewing files and edits side by side.
3. Split memory, skills and notes: memory stays small (who I am, preferences, a few global rules), repeatable workflows live in skills loaded on demand and patched whenever a workflow is corrected, everything else stays in the vault and is searched only when needed.
4. Daily loop: scheduled jobs drop fresh posts and release notes into an inbox folder overnight, the agent reads yesterday's results and the learning log and drafts the day's plan, spawns parallel subagents for multi-part checks, and real results go back into the vault to tighten the skills.
5. Hard human gates: the agent researches, verifies commands against live docs and stages drafts, but never posts, replies, DMs or opens issues itself. Old notes get `archived` in frontmatter instead of deleted.

## Raw
https://x.com/witcheer/status/2126390853027443001?a=DHbC-_fV20U6WadtUKQ&s=46

## Notes
- [[second-brain-repo]]: almost the same shape as this brain (markdown + frontmatter in git, inbox, threads per day)
- [[agent-mistakes-to-checks]]: same idea of turning corrections into durable skills and checks
- [[try-orchestrator-workflow]]: also about parallel subagents bringing back summaries
