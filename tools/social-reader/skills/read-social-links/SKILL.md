---
name: read-social-links
description: Use whenever the user shares an X/Twitter link (x.com or twitter.com /status/), or an Instagram post/reel link (instagram.com/p/, /reel/, /reels/, /tv/) — even with no instructions. Reads the post text, full thread, images, video frames, and Instagram captions via the social-reader MCP tool instead of web fetching (those sites block plain fetches).
---

# Reading social links

When a message contains an X/Twitter status link or an Instagram post/reel link:

1. Call the `read_social_link` tool (social-reader MCP server) once per link. Do not use WebFetch for these sites — they require login and return nothing useful.
   - Defaults are fine: images on, 4 frames per video, videos saved to `~/Downloads/social-reader/`.
   - For long videos where the visuals matter, raise `video_frames` (e.g. 8). For text-only questions, pass `video_frames: 0` to save time.
2. If the result is a 🧵 thread, treat all posts as one piece of content, in order.
3. Look at the returned images/frames — they are the attached media — and describe or use them when relevant.
4. Then do what the user asked (summarize, extract, critique, save to notes…). If they sent only the link, give a short summary: who posted it, what it says, what the media shows, and notable stats.

Limits to mention only if they come up: private/protected accounts, deleted posts, and age-restricted Instagram posts can't be read. Instagram gives the caption and video but not comments. There's no audio transcription — frames only.
