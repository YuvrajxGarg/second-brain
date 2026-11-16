"""
Social Reader core: reads X/Twitter posts & threads (via the free FxTwitter API)
and Instagram posts/reels (via Instagram's public embed page). No API keys.

Returns a list of parts: plain strings (text) and `Image` objects.
Shared by the local stdio server (social_reader.py) and the hosted HTTP server (api/mcp.py).
"""

from __future__ import annotations

import html
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx

UA = "social-reader-mcp/1.0 (personal link reader)"
MEDIA_DIR = Path(os.environ.get("SOCIAL_READER_DIR", Path.home() / "Downloads" / "social-reader"))
HIDE_PATHS = os.environ.get("SOCIAL_READER_HIDE_PATHS") == "1"
MAX_VIDEO_MB = float(os.environ.get("SOCIAL_READER_MAX_VIDEO_MB", "80"))

TWEET_RE = re.compile(r"(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)/(?:[^/]+|i/web|i)/status(?:es)?/(\d+)", re.I)
IG_RE = re.compile(r"instagram\.com/(?:[^/]+/)?(p|reel|reels|tv)/([A-Za-z0-9_-]+)", re.I)



class Image:
    """Plain image part (bytes + format); servers convert it to MCP image content."""
    __slots__ = ("data", "format")

    def __init__(self, data: bytes, format: str = "jpeg"):
        self.data, self.format = data, format

    @property
    def mime(self) -> str:
        return f"image/{self.format}"


def _ffmpeg_path() -> str | None:
    p = shutil.which("ffmpeg") or next((p for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg") if Path(p).exists()), None)
    if p:
        return p
    try:
        import imageio_ffmpeg  # bundled static ffmpeg (hosted version)
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _client() -> httpx.Client:
    return httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=30)


# ---------------------------------------------------------------- media utils

def _fetch_image(client: httpx.Client, url: str) -> Image | None:
    try:
        r = client.get(url)
        r.raise_for_status()
        ctype = r.headers.get("content-type", "image/jpeg")
        fmt = "png" if "png" in ctype else "webp" if "webp" in ctype else "jpeg"
        return Image(data=r.content, format=fmt)
    except Exception:
        return None


def _small_twimg(url: str) -> str:
    """Ask pbs.twimg.com for a medium-sized rendition to keep context small."""
    if "pbs.twimg.com/media/" in url:
        return re.sub(r"name=\w+", "name=medium", url) if "name=" in url else url + ("&" if "?" in url else "?") + "name=medium"
    return url


def _download(client: httpx.Client, url: str, dest: Path) -> Path | None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    try:
        with client.stream("GET", url) as r:
            r.raise_for_status()
            size = int(r.headers.get("content-length") or 0)
            if size and size > MAX_VIDEO_MB * 1024 * 1024:
                return None
            tmp = dest.with_suffix(dest.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes(1 << 16):
                    f.write(chunk)
            tmp.rename(dest)
        return dest
    except Exception:
        return None


def _video_frames(video: Path, count: int, duration: float | None) -> list[Image]:
    """Grab `count` evenly spaced frames (768px wide) with ffmpeg."""
    ffmpeg = _ffmpeg_path()
    if not ffmpeg or count <= 0:
        return []
    if not duration:
        # ffmpeg prints "Duration: HH:MM:SS.xx" on stderr; works without ffprobe
        try:
            err = subprocess.run([ffmpeg, "-i", str(video)], capture_output=True, text=True, timeout=30).stderr
            h, m_, sec = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err).groups()
            duration = int(h) * 3600 + int(m_) * 60 + float(sec)
        except Exception:
            duration = None
    frames: list[Image] = []
    with tempfile.TemporaryDirectory() as td:
        for i in range(count):
            t = (duration * (i + 0.5) / count) if duration else i * 2
            out = Path(td) / f"f{i}.jpg"
            subprocess.run([ffmpeg, "-v", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                            "-vf", "scale=768:-2", "-q:v", "4", "-y", str(out)], capture_output=True, timeout=60)
            if out.exists():
                frames.append(Image(data=out.read_bytes(), format="jpeg"))
    return frames


def _pick_mp4(video: dict) -> str | None:
    """Prefer a mid-quality mp4 (<= 720p) over the 4K original to save bandwidth."""
    mp4s = [f for f in video.get("formats") or [] if f.get("container") == "mp4" and f.get("url")]
    if mp4s:
        def height(f):
            m = re.search(r"/(\d+)x(\d+)/", f["url"])
            return min(int(m.group(1)), int(m.group(2))) if m else f.get("bitrate", 0)
        ok = [f for f in mp4s if height(f) <= 720]
        best = max(ok, key=height) if ok else min(mp4s, key=height)
        return best["url"]
    return video.get("url")


# ---------------------------------------------------------------- X / Twitter

def _fmt_tweet(s: dict, idx: int | None = None) -> str:
    a = s.get("author") or {}
    head = f"[{idx}] " if idx is not None else ""
    lines = [f"{head}@{a.get('screen_name')} ({a.get('name')}) — {s.get('created_at')}",
             f"URL: {s.get('url')}"]
    if s.get("replying_to"):
        lines.append(f"Replying to: @{s.get('replying_to', {}).get('screen_name') if isinstance(s.get('replying_to'), dict) else s.get('replying_to')}")
    lines.append("")
    lines.append(s.get("text") or "")
    media = (s.get("media") or {}).get("all") or []
    for m in media:
        if m.get("type") == "photo":
            lines.append(f"  📷 photo: {m.get('url')}" + (f"  (alt: {m['altText']})" if m.get("altText") else ""))
        elif m.get("type") in ("video", "gif"):
            lines.append(f"  🎬 {m.get('type')} ({m.get('duration', '?')}s): {_pick_mp4(m)}")
    card = s.get("embed_card") or s.get("card")
    if isinstance(card, dict) and card.get("title"):
        lines.append(f"  🔗 link card: {card.get('title')} — {card.get('url') or ''}")
    q = s.get("quote")
    if isinstance(q, dict) and q.get("text") is not None:
        qa = q.get("author") or {}
        lines.append(f"  ↪ quoting @{qa.get('screen_name')}: {q.get('text')}  ({q.get('url')})")
    lines.append(f"  ♥ {s.get('likes')}  🔁 {s.get('reposts', s.get('retweets'))}  💬 {s.get('replies')}  👁 {s.get('views')}")
    return "\n".join(lines)


def read_tweet(url: str, include_images: bool, video_frames: int, download_videos: bool) -> list:
    m = TWEET_RE.search(url)
    if not m:
        return ["Could not find a tweet ID in that URL."]
    tid = m.group(1)
    with _client() as c:
        r = c.get(f"https://api.fxtwitter.com/2/thread/{tid}")
        if r.status_code != 200:
            r = c.get(f"https://api.fxtwitter.com/2/status/{tid}")
        if r.status_code != 200:
            return [f"FxTwitter returned HTTP {r.status_code}. The tweet may be deleted, private, or age-restricted."]
        d = r.json()
        thread = d.get("thread") or []
        main = d.get("status") or {}
        posts = thread if len(thread) > 1 else [main]

        out: list = []
        if len(posts) > 1:
            a = (posts[0].get("author") or {}).get("screen_name")
            out.append(f"🧵 THREAD by @{a} — {len(posts)} posts (requested post id {tid})\n")
        out.append("\n\n".join(_fmt_tweet(p, i + 1 if len(posts) > 1 else None) for i, p in enumerate(posts)))

        saved: list[str] = []
        for p in posts:
            for mm in (p.get("media") or {}).get("all") or []:
                if mm.get("type") == "photo" and include_images:
                    img = _fetch_image(c, _small_twimg(mm["url"]))
                    if img:
                        out.append(img)
                elif mm.get("type") in ("video", "gif"):
                    if include_images and mm.get("thumbnail_url") and (video_frames <= 0 or not download_videos):
                        img = _fetch_image(c, mm["thumbnail_url"])
                        if img:
                            out.append(img)
                    if download_videos:
                        vurl = _pick_mp4(mm)
                        if vurl:
                            dest = MEDIA_DIR / "x" / tid / f"{mm.get('id', 'video')}.mp4"
                            path = _download(c, vurl, dest)
                            if path:
                                saved.append(str(path))
                                frames = _video_frames(path, video_frames, mm.get("duration"))
                                if frames:
                                    out.append(f"🎞 {len(frames)} frames sampled from video {mm.get('id')} (evenly spaced):")
                                    out.extend(frames)
        if saved and not HIDE_PATHS:
            out.append("Saved videos:\n" + "\n".join(saved))
        return out


# ---------------------------------------------------------------- Instagram

def _ig_unescape(s: str) -> str:
    return json.loads(f'"{s}"') if s else s


def read_instagram(url: str, include_images: bool, video_frames: int, download_videos: bool) -> list:
    m = IG_RE.search(url)
    if not m:
        return ["Could not find an Instagram post/reel code in that URL."]
    code = m.group(2)
    with _client() as c:
        r = c.get(f"https://www.instagram.com/p/{code}/embed/captioned/")
        if r.status_code != 200:
            return [f"Instagram embed returned HTTP {r.status_code}. The post may be private, deleted or not embeddable."]
        page = r.text

        media: dict = {}
        mj = re.search(r'"contextJSON":"((?:[^"\\]|\\.)*)"', page)
        if mj:
            try:
                ctx = json.loads(_ig_unescape(mj.group(1)))
                media = ((ctx.get("gql_data") or {}).get("shortcode_media")) or {}
            except Exception:
                media = {}

        caption = ""
        edges = ((media.get("edge_media_to_caption") or {}).get("edges")) or []
        if edges:
            caption = edges[0].get("node", {}).get("text", "")
        if not caption:  # fall back to the rendered caption HTML
            cm = re.search(r'class="Caption">(.*?)<div class="CaptionComments"', page, re.S)
            if cm:
                txt = re.sub(r"<br\s*/?>", "\n", cm.group(1))
                txt = re.sub(r'<a class="CaptionUsername"[^>]*>.*?</a>', "", txt, flags=re.S)
                caption = html.unescape(re.sub(r"<[^>]+>", "", txt)).strip()

        owner = (media.get("owner") or {}).get("username")
        if not owner:
            om = re.search(r'class="UsernameText">([^<]+)<', page) or re.search(r'class="CaptionUsername"[^>]*>([^<]+)<', page)
            owner = om.group(1) if om else "?"

        if not caption and not media:
            return [f"Couldn't read Instagram post {code}. It may be private, age-restricted, or Instagram blocked the embed. "
                    "Try opening it in a browser."]

        kind = media.get("__typename", "")
        lines = [f"Instagram {'reel/video' if media.get('is_video') else 'post'} by @{owner}",
                 f"URL: https://www.instagram.com/{'reel' if media.get('is_video') else 'p'}/{code}/"]
        if media.get("taken_at_timestamp"):
            import datetime as _dt
            lines.append("Posted: " + _dt.datetime.utcfromtimestamp(media["taken_at_timestamp"]).strftime("%Y-%m-%d %H:%M UTC"))
        stats = []
        if media.get("video_view_count") is not None:
            stats.append(f"👁 {media['video_view_count']} views")
        likes = (media.get("edge_liked_by") or media.get("edge_media_preview_like") or {}).get("count")
        if likes is not None:
            stats.append(f"♥ {likes}")
        comments = (media.get("edge_media_to_comment") or {}).get("count")
        if comments is not None:
            stats.append(f"💬 {comments}")
        if stats:
            lines.append("  ".join(stats))
        lines += ["", "CAPTION:", caption or "(no caption)"]

        out: list = []
        items = [e["node"] for e in ((media.get("edge_sidecar_to_children") or {}).get("edges") or [])] or ([media] if media else [])
        if len(items) > 1:
            lines.append(f"\nCarousel with {len(items)} items.")
        for it in items:
            if it.get("video_url"):
                lines.append(f"  🎬 video: {it['video_url']}")
        out.append("\n".join(lines))

        saved: list[str] = []
        for n, it in enumerate(items):
            thumb = it.get("display_url")
            if it.get("is_video") and it.get("video_url") and download_videos:
                path = _download(c, it["video_url"], MEDIA_DIR / "instagram" / code / f"{n}.mp4")
                if path:
                    saved.append(str(path))
                    frames = _video_frames(path, video_frames, it.get("video_duration"))
                    if frames:
                        out.append(f"🎞 {len(frames)} frames sampled from the video (evenly spaced):")
                        out.extend(frames)
                        continue
            if include_images and thumb:
                img = _fetch_image(c, thumb)
                if img:
                    out.append(img)
        if not items and include_images:
            im = re.search(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', page)
            if im:
                img = _fetch_image(c, html.unescape(im.group(1)))
                if img:
                    out.append(img)
        if saved and not HIDE_PATHS:
            out.append("Saved videos:\n" + "\n".join(saved))
        return out


# ---------------------------------------------------------------- entry point

TOOL_DESCRIPTION = """Read an X/Twitter post or Instagram post/reel from its URL.

- X/Twitter (x.com / twitter.com status links): returns the post text, author,
  stats, quoted post, and the FULL THREAD if the author threaded it. Attached
  photos are returned as images; videos are downloaded and `video_frames`
  still frames are returned so you can see the content.
- Instagram (/p/, /reel/, /reels/, /tv/ links): returns the caption, author,
  stats, and the thumbnail or sampled video frames.

Use this instead of fetching x.com / instagram.com pages directly (they need login)."""


def read_social_link(url: str, include_images: bool = True, video_frames: int = 4, download_videos: bool = True) -> list:
    """Read an X/Twitter post or Instagram post/reel from its URL.

    - X/Twitter (x.com / twitter.com status links): returns the post text, author,
      stats, quoted post, and the FULL THREAD if the author threaded it. Attached
      photos are returned as images; videos are downloaded and `video_frames`
      still frames are returned so you can see the content.
    - Instagram (/p/, /reel/, /reels/, /tv/ links): returns the caption, author,
      stats, and the thumbnail or sampled video frames.

    Args:
        url: The tweet or Instagram link.
        include_images: Return photos/thumbnails as images (default True).
        video_frames: How many frames to sample from each video (0 = none, default 4).
        download_videos: Save videos to ~/Downloads/social-reader (default True).
    """
    url = url.strip()
    if TWEET_RE.search(url):
        return read_tweet(url, include_images, video_frames, download_videos)
    if IG_RE.search(url):
        return read_instagram(url, include_images, video_frames, download_videos)
    if re.search(r"(x\.com|twitter\.com)/", url):
        return ["That X link isn't a post link (needs /status/<id>)."]
    return ["Unsupported link. I can read x.com / twitter.com status links and instagram.com /p/, /reel/ links."]
