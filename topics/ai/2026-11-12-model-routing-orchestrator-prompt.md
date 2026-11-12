---
title: Orchestrator subagent prompt
type: link
topic: ai
tags: [agents, claude, prompting, workflow, to-try]
kind: technique
why: I need to test this workflow on one of my next
source: https://x.com/Ash_uxi/status/2120440737703825767
added: 2026-11-12
status: unread
---

## Summary
An X post from Ashish (@Ash_uxi) on using Claude Fable 5.2 as an orchestrator: it splits a task into subtasks, sends hard reasoning and judgment calls to Opus subagents and fast, well-defined execution to Sonnet subagents, gives each one a complete blueprint, then reviews, merges and fixes their work into one result. He says the output was "insane". The value is the reusable prompt below.

Prompt:

> You're the orchestrator. Split this task into subtasks. Send deep reasoning and hard judgment calls to Opus, and fast, well-defined execution to Sonnet. Give each subagent a complete blueprint: the goal, full context, exact steps, constraints, the output format and what 'done' looks like. They should never have to guess. Then review their work, merge it and fix it into one final result.

## Raw
https://x.com/Ash_uxi/status/2120440737703825767?a=h1y8v9hoHmMoD0kJEc0&s=20

I need to test this workflow on one of my next

## Notes
- Read via Social Reader (text post, no media).
- To-do: [[2026-11-12-try-orchestrator-workflow]]
