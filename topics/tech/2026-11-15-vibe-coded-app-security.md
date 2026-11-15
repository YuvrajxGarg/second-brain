---
title: Vibe-coded app security
type: video
topic: tech
tags: [security, web-app, reference]
kind: advice
why: 15 ways a vibe-coded app gets hacked, to check my own apps against
source: https://www.instagram.com/reel/Dfvvp0DtB_W/
added: 2026-11-15
status: unread
---

## Summary
@softwarebyjoe lists 15 common holes in vibe-coded apps, each with a one-line fix:
1. Script in username (XSS)
2. Changing the URL id to open someone else's record (IDOR: check the record belongs to them)
3. Typing /admin
4. API key exposed in the browser
5. Prompt injection
6. Making yourself admin at sign-up
7. Editing the price in the request (look prices up on the server)
8. Faking a payment
9. Redeeming a code 100 times
10. Ordering -1 items
11. Guessing a login code (rate limit and lock out attempts)
12. Uploading something that isn't a photo
13. .env committed to git
14. Someone hitting your AI endpoint 10k times
15. Querying your whole database (turn on Supabase row level security)

The caption offers a prompt that audits an app for all 15 if you comment SECURITY; that prompt isn't in the reel.

![screenshot](./2026-11-15-vibe-coded-app-security.jpg)
The frame shows the full 15-item list next to the speaker, with a code card reading `supabase.from("users").select("*") // every user, every row` under "Turn on row level security".

## Raw
https://www.instagram.com/reel/Dfvvp0DtB_W/?exln=MWl0N2VuZXMwZDVkdg==
