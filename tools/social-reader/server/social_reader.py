# /// script
# requires-python = ">=3.10"
# dependencies = ["mcp>=1.2,<2", "httpx>=0.27"]
# ///
"""Local (stdio) Social Reader MCP server — used by Claude Desktop and the Claude Code plugin.
All the reading logic lives in reader_core.py (shared with the hosted version)."""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
logging.getLogger("httpx").setLevel(logging.WARNING)

from mcp.server.fastmcp import FastMCP, Image  # noqa: E402

import reader_core  # noqa: E402

mcp = FastMCP("social-reader")


@mcp.tool(description=reader_core.TOOL_DESCRIPTION)
def read_social_link(url: str, include_images: bool = True, video_frames: int = 4, download_videos: bool = True) -> list:
    parts = reader_core.read_social_link(url, include_images, video_frames, download_videos)
    return [Image(data=p.data, format=p.format) if isinstance(p, reader_core.Image) else p for p in parts]


if __name__ == "__main__":
    mcp.run()
