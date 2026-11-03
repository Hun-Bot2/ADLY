# LeetCode statement research: design

## Snapshot fetcher (`scripts/learning/fetch_leetcode_snapshot.py`, stdlib only)

```
phase list     POST https://leetcode.com/graphql  questionList(categorySlug:"", limit:100, skip:n)   ~40 requests
               -> <out>/problems.jsonl            one row per problem (metadata only)
phase content  POST https://leetcode.com/graphql  question(titleSlug)                                one per free problem
               -> <out>/statements.jsonl          {slug, frontend_id, content|null, reason, fetched_at}
               -> <out>/receipt-<phase>.json      counts, sha256, timings, errors
```

- Resume: `content` reads `statements.jsonl`, skips stored slugs (an error row is retried on the next run; the latest row wins in
  readers). `list` refuses to overwrite an existing `problems.jsonl` unless `--refresh-list` writes a new file name.
- Pacing: `--gap 2.0` seconds minimum (lower values are refused), 15 s timeout, stop after 5 consecutive errors (HTTP 429/403
  included) and print how to resume.
- No cookies, no login, fixed User-Agent naming the project. Paid-only rows are written with `reason: "paid_only"` without a request.
- `--limit N` fetches only N statements (a quick first check). `--dry-run` prints what would be requested and exits.
- Reuse (D-7): statements of slugs present in `data/raw/leetcode_raw_data.jsonl` are copied (source `snapshot-2026-01`, no request);
  only new slugs are fetched (source `live`). The receipt reports `ok_by_source`. A renamed slug counts as new and is fetched.

## Representations (study 2)

| id | text given to the encoder | notes |
|---|---|---|
| R0 | none: multi-hot tag vector | baseline |
| R1 | tag vector + difficulty one-hot | no text |
| R2 | MiniLM(title) concatenated with the tag vector | research only |
| R3 | MiniLM(cleaned statement) concatenated with the tag vector | truncation reported |
| R4 | R3 + difficulty one-hot | |

Concatenation weights are fixed and reported (each block L2-normalized, equal weight), not tuned. Maps: UMAP and t-SNE with fixed
seeds and one thread (AGENTS.md reproducibility notes). Code goes in a new `research/leetcode_statements/` package; existing pinned
research files are not edited.

## Tradeoffs

- Concatenating a tag block into R2-R4 keeps every representation comparable to R0 but means R2-R4 differ only by the text block.
  A text-only variant can be added later if the user wants it.
- MiniLM truncates long statements (median about 2,000 characters in the 2026-01 snapshot). Chunk-and-average is a possible
  follow-up; the first run reports the truncated share instead.
