#!/usr/bin/env python3
"""Resolve Google Photos shared album links into direct image URLs for config.js."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "js" / "config.js"
USER_AGENT = "Mozilla/5.0 (compatible; digital-frame/1.0)"
IMAGE_URL_PATTERN = re.compile(r"https://lh3\.googleusercontent\.com/[^\s\"'\\]+")
AF_INIT_PATTERN = re.compile(
    r"AF_initDataCallback\(\{key:\s*'([^']*)',\s*hash:\s*'[^']*',\s*data:(.*?),\s*sideChannel:",
    re.DOTALL,
)
ALBUM_URLS_PATTERN = re.compile(r"albumUrls:\s*\[(.*?)\]", re.DOTALL)
PHOTOS_PATTERN = re.compile(r"photos:\s*\[.*?\],", re.DOTALL)
STRING_LITERAL_PATTERN = re.compile(r"'([^']+)'|\"([^\"]+)\"")


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        final_url = response.geturl()
        html = response.read().decode("utf-8", errors="replace")
    if final_url != url:
        print(f"  Redirected to {final_url}")
    return html


def parse_json_blob(raw: str) -> Any:
    depth = 0
    in_string = False
    escape = False
    quote = ""

    for index, char in enumerate(raw):
        if in_string:
            if escape:
                escape = False
                continue
            if char == "\\":
                escape = True
                continue
            if char == quote:
                in_string = False
            continue

        if char in {"'", '"'}:
            in_string = True
            quote = char
            continue

        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(raw[: index + 1])
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(raw[: index + 1])

    raise ValueError("Could not find balanced JSON in AF_initDataCallback payload")


def extract_urls_from_data(data: Any) -> list[str]:
    urls: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, list):
            if (
                len(node) >= 2
                and isinstance(node[0], str)
                and isinstance(node[1], list)
                and len(node[1]) >= 3
                and isinstance(node[1][0], str)
                and node[1][0].startswith("https://lh3.googleusercontent.com/")
            ):
                urls.append(node[1][0])
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)

    walk(data)
    return urls


def extract_urls_from_html(html: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    for match in AF_INIT_PATTERN.finditer(html):
        try:
            data = parse_json_blob(match.group(2))
        except (ValueError, json.JSONDecodeError):
            continue
        for url in extract_urls_from_data(data):
            if url not in seen:
                seen.add(url)
                found.append(url)

    if found:
        return found

    for url in IMAGE_URL_PATTERN.findall(html):
        cleaned = url.rstrip("\\")
        if cleaned not in seen:
            seen.add(cleaned)
            found.append(cleaned)

    return found


def read_config_text() -> str:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Missing config file: {CONFIG_PATH}")
    return CONFIG_PATH.read_text(encoding="utf-8")


def parse_album_urls(config_text: str) -> list[str]:
    match = ALBUM_URLS_PATTERN.search(config_text)
    if not match:
        raise ValueError("Could not find albumUrls array in config.js")

    urls: list[str] = []
    for single, double in STRING_LITERAL_PATTERN.findall(match.group(1)):
        value = single or double
        if value.startswith("http"):
            urls.append(value)
    return urls


def format_photos_array(urls: list[str]) -> str:
    if not urls:
        return "photos: [],"
    lines = ["photos: ["]
    for url in urls:
        lines.append(f"    '{url}',")
    lines.append("  ],")
    return "\n  ".join(lines)


def update_config_photos(config_text: str, photos: list[str]) -> str:
    replacement = format_photos_array(photos)
    updated, count = PHOTOS_PATTERN.subn(replacement, config_text, count=1)
    if count != 1:
        raise ValueError("Could not update photos array in config.js")
    return updated


def resolve_album(album_url: str) -> list[str]:
    print(f"Fetching {album_url}")
    html = fetch_html(album_url)
    urls = extract_urls_from_html(html)
    print(f"  Found {len(urls)} photo URLs")
    return urls


def main() -> int:
    try:
        config_text = read_config_text()
        album_urls = parse_album_urls(config_text)
    except (FileNotFoundError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    if not album_urls:
        print("No album URLs found in js/config.js.")
        print("Add shared Google Photos links to albumUrls, then run this script again.")
        return 1

    all_photos: list[str] = []
    seen: set[str] = set()

    for album_url in album_urls:
        try:
            album_photos = resolve_album(album_url)
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            print(f"  Failed: {error}", file=sys.stderr)
            continue

        for url in album_photos:
            if url not in seen:
                seen.add(url)
                all_photos.append(url)

    if not all_photos:
        print("No photos resolved. Check that albums are shared publicly.", file=sys.stderr)
        return 1

    updated_config = update_config_photos(config_text, all_photos)
    CONFIG_PATH.write_text(updated_config, encoding="utf-8")
    print(f"Updated {CONFIG_PATH} with {len(all_photos)} photos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
