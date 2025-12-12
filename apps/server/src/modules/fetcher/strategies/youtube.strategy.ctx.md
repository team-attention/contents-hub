---
target: /apps/server/src/modules/fetcher/strategies/youtube.strategy.ts
what: YouTube transcript fetching strategy using youtube-transcript-plus library
when:
  - When modifying YouTube transcript fetching logic
  - When debugging YouTube-related fetch failures
  - When adding support for new YouTube URL formats
  - When handling transcript language preferences
not_when:
  - When working on HTTP/article fetching (see http.strategy.ts)
  - When working on RSS feeds
future:
  - Add video metadata (title, author) fetching
  - Consider caching Innertube sessions for performance
  - Add support for age-restricted videos
---

# Context for youtube.strategy.ts

## Overview

YouTube fetching strategy that extracts video transcripts for summarization. Uses `youtube-transcript-plus` library which leverages YouTube's InnerTube API.

## Library Selection History

We tried multiple libraries before settling on `youtube-transcript-plus`:

1. **youtube-transcript** (original): Broken due to YouTube HTML structure changes (see [GitHub Issue #45](https://github.com/Kakulukian/youtube-transcript/issues/45))
2. **youtubei.js**: `getTranscript()` method returns 400 errors; direct caption track URL fetch returns empty body
3. **youtube-transcript-plus**: Works reliably via 3-step process:
   - `videoFetch` (GET): Retrieves YouTube page
   - `playerFetch` (POST): Calls InnerTube API for caption metadata
   - `transcriptFetch` (GET): Downloads actual transcript

## Key Implementation Details

### HTML Entity Decoding Order

YouTube returns double-encoded entities like `&amp;#39;`. **Must decode `&amp;` first**:

```typescript
.replace(/&amp;/g, "&")   // First: &amp;#39; → &#39;
.replace(/&#39;/g, "'")   // Then:  &#39; → '
.replace(/&quot;/g, '"')
.replace(/&lt;/g, "<")
.replace(/&gt;/g, ">")
```

### Language Fallback Logic

Transcript language preference order:
1. Default (auto-detect)
2. English (`en`)
3. Korean (`ko`)

### URL Patterns Supported

- `youtube.com/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `youtube.com/embed/VIDEO_ID`
- `youtube.com/v/VIDEO_ID`
- Raw video ID (11 chars: `[a-zA-Z0-9_-]{11}`)

## Error Types

| Error | Meaning |
|-------|---------|
| `INVALID_URL` | Could not extract video ID from URL |
| `TRANSCRIPT_DISABLED` | Video has transcripts disabled |
| `NOT_FOUND` | Video doesn't exist or is private |
| `EXTRACTION_ERROR` | No transcript available in any language |
| `TIMEOUT` | Request exceeded 60s timeout |

## Performance

- Default timeout: 60 seconds (transcripts can be slow)
- Typical fetch time: 1-2 seconds
- Returns ~40k characters for a 1-hour video

## Related Files

- `fetcher.service.ts`: Routes URLs to this strategy via `isYouTubeUrl()`
- `http.strategy.ts`: Alternative strategy for non-YouTube URLs
- `@contents-hub/shared`: FetchResult type definition
