# Social Reader

Read X/Twitter posts and Instagram posts/reels in Claude from a pasted link. It's free: no API keys and no accounts.

| Link | What Claude gets |
|---|---|
| x.com / twitter.com `/status/…` | Text, author, stats, quoted post, the **full thread**, photos (as images), videos (downloaded, with frames sampled so Claude can see them) |
| instagram.com `/p/`, `/reel/`, `/reels/`, `/tv/` | Caption, author, views/likes/comments, thumbnail, video (downloaded, with frames sampled), carousel items |

Sources: the public [FxTwitter API](https://github.com/FixTweet/FxTwitter) and Instagram's own public embed page.
Videos are saved to `~/Downloads/social-reader/` (override with the `SOCIAL_READER_DIR` env var).

Requirements: [`uv`](https://docs.astral.sh/uv/) (it installs Python and the dependencies automatically), plus `ffmpeg` for video frames.

## Install: Claude Code / Code tab (plugin, with auto-trigger skill)

```bash
claude plugin marketplace add /path/to/social-reader
claude plugin install social-reader@social-reader-local
```

## Install: Claude Desktop chat (connector)

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` under `mcpServers`, then restart Claude:

```json
"social-reader": {
  "command": "/opt/homebrew/bin/uv",
  "args": ["run", "--quiet", "--script", "/path/to/social-reader/server/social_reader.py"]
}
```

## Install: claude.ai (web, mobile and Projects): hosted connector

Host it free on Vercel, then add it to Claude as a custom connector.

1. Make up a long random password for it (e.g. from a password manager). This is
   your `MCP_TOKEN`. Anyone with the full URL can use your reader, so keep it secret.
2. On vercel.com: **Add New → Project**, import the GitHub repo that holds this
   folder. Set **Root Directory** to this folder (in a second-brain copy that's
   `tools/social-reader`). Framework preset: **Other**.
3. Before deploying, open **Environment Variables** and add `MCP_TOKEN` with your
   password. Click **Deploy**.
4. Your connector URL is `https://<your-project>.vercel.app/mcp/<MCP_TOKEN>`.
   Requests without the token get a 404.
5. In claude.ai, open **Settings → Connectors → Add custom connector**, name it
   `Social Reader`, paste the full URL, and click **Add** (no OAuth needed).
6. Start a new chat or project thread. Connectors only appear in threads started
   after you add them.

To redeploy after you change the code (`server/reader_core.py` is shared by both versions):

```bash
npx vercel@latest deploy --prod
```

To rotate the secret: `npx vercel@latest env rm MCP_TOKEN production`, then `env add MCP_TOKEN production` with a new value, redeploy, and update the URL in claude.ai.

Files: `api/mcp.py` (HTTP MCP endpoint), `vercel.json`, `pyproject.toml`, `requirements.txt`.

## Limits
- Private, protected or deleted posts can't be read. Age-restricted Instagram posts usually fail.
- Instagram comments aren't included, only the caption.
- Audio isn't transcribed. Claude sees sampled frames.
- Free third-party/embed sources can change. If one breaks, the fix is in `server/reader_core.py`.
