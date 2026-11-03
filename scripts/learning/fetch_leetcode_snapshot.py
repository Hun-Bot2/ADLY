"""Fetch a private LeetCode snapshot for the user's own research (specs/leetcode-statement-research).

Network access happens only when the user runs this script. Two phases:

  list     problem metadata (id, title, slug, difficulty, paid-only, tags) -> problems.jsonl
  content  one statement per free problem, one request at a time          -> statements.jsonl

Both are resumable. Outputs stay under private-learning/ and are never committed.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "private-learning" / "leetcode-snapshots" / "v2"
# The 2026-01 snapshot (asset-pinned, read only). Its statements are reused so only new problems are requested.
OLD_SNAPSHOT = ROOT / "data" / "raw" / "leetcode_raw_data.jsonl"
OLD_SOURCE = "snapshot-2026-01"
ENDPOINT = "https://leetcode.com/graphql"
USER_AGENT = "AlgorithmRAGEngine-research/1.0 (private snapshot)"
MIN_GAP = 2.0
PAGE = 100
MAX_CONSECUTIVE_ERRORS = 5

LIST_QUERY = """query questionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data { questionFrontendId title titleSlug difficulty isPaidOnly topicTags { name slug } }
  }
}"""
CONTENT_QUERY = """query questionContent($titleSlug: String!) {
  question(titleSlug: $titleSlug) { questionFrontendId titleSlug isPaidOnly content }
}"""


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def http_post(payload, timeout=15):
    """POST one GraphQL request. No cookies or credentials are sent."""
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), method="POST", headers={
        "Content-Type": "application/json", "User-Agent": USER_AGENT, "Referer": "https://leetcode.com/problemset/"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def graphql(post, query, variables):
    status, body = post({"query": query, "variables": variables})
    if status != 200:
        raise RuntimeError(f"http {status}")
    data = json.loads(body)
    if data.get("errors"):
        raise RuntimeError("graphql error: " + str(data["errors"][0].get("message", "unknown"))[:200])
    return data["data"]


def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def append_jsonl(path, row):
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()


def write_receipt(out, phase, receipt):
    (out / f"receipt-{phase}.json").write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def fetch_list(out, post=http_post, sleep=time.sleep, gap=MIN_GAP):
    """Phase 1: all problem metadata. Refuses to overwrite an existing list."""
    target = out / "problems.jsonl"
    if target.exists():
        raise FileExistsError(f"{target} exists; use a new --output version to refresh the list")
    started, rows, skip, total, requests = now_iso(), [], 0, None, 0
    while total is None or skip < total:
        if requests:
            sleep(gap)
        data = graphql(post, LIST_QUERY, {"categorySlug": "", "limit": PAGE, "skip": skip, "filters": {}})["questionList"]
        requests += 1
        total = int(data["total"])
        page = data["questions"] or []
        for q in page:
            rows.append({"frontend_id": str(q["questionFrontendId"]), "title": q["title"], "slug": q["titleSlug"],
                         "difficulty": q["difficulty"], "paid_only": bool(q["isPaidOnly"]),
                         "tags": [t["name"] for t in q.get("topicTags") or []],
                         "tag_slugs": [t["slug"] for t in q.get("topicTags") or []]})
        if not page:
            break
        skip += len(page)
    slugs = [r["slug"] for r in rows]
    if len(set(slugs)) != len(slugs):
        raise ValueError("duplicate slugs in list response")
    tmp = target.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows), encoding="utf-8")
    tmp.rename(target)
    receipt = {"phase": "list", "started_at": started, "finished_at": now_iso(), "requests": requests, "reported_total": total,
               "rows": len(rows), "paid_only": sum(r["paid_only"] for r in rows), "sha256": sha256(target)}
    write_receipt(out, "list", receipt)
    return receipt


def load_old_statements(path):
    """slug -> statement from the 2026-01 snapshot. Read only; the file itself is never modified."""
    if path is None or not Path(path).exists():
        return {}
    return {r["titleSlug"]: r["content"] for r in read_jsonl(Path(path)) if r.get("titleSlug") and r.get("content")}


def fetch_content(out, post=http_post, sleep=time.sleep, gap=MIN_GAP, limit=None, log=print, reuse=None):
    """Phase 2: one statement per free problem. Resumable; an error row is retried on the next run.

    With `reuse` (the 2026-01 snapshot), problems already there are copied without a request (source snapshot-2026-01);
    only problems added since then are fetched (source live)."""
    old = load_old_statements(reuse)
    problems = read_jsonl(out / "problems.jsonl")
    if not problems:
        raise FileNotFoundError("run the list phase first")
    target = out / "statements.jsonl"
    done = {}
    for row in read_jsonl(target):
        done[row["slug"]] = row
    stored = {slug for slug, row in done.items() if row["reason"] in ("ok", "paid_only", "not_found")}
    started, requests, written, errors, consecutive, reused = now_iso(), 0, 0, 0, 0, 0
    stopped = None
    for problem in problems:
        slug = problem["slug"]
        if slug in stored:
            continue
        base = {"slug": slug, "frontend_id": problem["frontend_id"]}
        if slug in old:
            append_jsonl(target, {**base, "content": old[slug], "reason": "ok", "source": OLD_SOURCE, "fetched_at": None})
            written += 1
            reused += 1
            continue
        if problem["paid_only"]:
            append_jsonl(target, {**base, "content": None, "reason": "paid_only", "source": "list", "fetched_at": None})
            written += 1
            continue
        if limit is not None and requests >= limit:
            break
        if requests:
            sleep(gap)
        requests += 1
        try:
            question = graphql(post, CONTENT_QUERY, {"titleSlug": slug})["question"]
            if question is None:
                row = {**base, "content": None, "reason": "not_found"}
            elif not question.get("content"):
                row = {**base, "content": None, "reason": "paid_only" if question.get("isPaidOnly") else "empty"}
            else:
                row = {**base, "content": question["content"], "reason": "ok"}
            consecutive = 0
        except (RuntimeError, ValueError, OSError) as error:
            row = {**base, "content": None, "reason": "error", "error": str(error)[:200]}
            errors += 1
            consecutive += 1
        append_jsonl(target, {**row, "source": "live", "fetched_at": now_iso()})
        written += 1
        if requests % 50 == 0:
            log(f"{requests} requests, {errors} errors, last {slug}")
        if consecutive >= MAX_CONSECUTIVE_ERRORS:
            stopped = f"stopped after {consecutive} consecutive errors (last: {row.get('error')}); rerun the same command later to resume"
            break
    latest = {}
    for row in read_jsonl(target):
        latest[row["slug"]] = row
    counts = {}
    for row in latest.values():
        counts[row["reason"]] = counts.get(row["reason"], 0) + 1
    remaining = sum(1 for p in problems if latest.get(p["slug"], {}).get("reason") not in ("ok", "paid_only", "not_found"))
    sources = {}
    for row in latest.values():
        if row["reason"] == "ok":
            sources[row.get("source", "live")] = sources.get(row.get("source", "live"), 0) + 1
    receipt = {"phase": "content", "started_at": started, "finished_at": now_iso(), "requests": requests, "rows_written": written,
               "reused_this_run": reused, "ok_by_source": dict(sorted(sources.items())),
               "errors_this_run": errors, "by_reason": dict(sorted(counts.items())), "remaining": remaining, "stopped": stopped,
               "gap_seconds": gap, "sha256": sha256(target)}
    write_receipt(out, "content", receipt)
    return receipt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("phase", choices=["list", "content"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT, help="snapshot folder (default: %(default)s)")
    parser.add_argument("--gap", type=float, default=MIN_GAP, help="seconds between requests (minimum 2)")
    parser.add_argument("--limit", type=int, default=None, help="content phase: fetch at most N statements, then stop")
    parser.add_argument("--dry-run", action="store_true", help="print what would be requested and exit")
    parser.add_argument("--no-reuse", action="store_true", help="fetch every statement again instead of reusing the 2026-01 snapshot")
    args = parser.parse_args(argv)
    if args.gap < MIN_GAP:
        raise ValueError(f"--gap must be at least {MIN_GAP} seconds")
    out = args.output.resolve()
    if out == (ROOT / "data").resolve() or (ROOT / "data") in out.parents:
        raise ValueError("refusing to write under data/: the 2026-01 snapshot there is asset-pinned")
    if args.dry_run:
        problems = read_jsonl(out / "problems.jsonl")
        stored = {r["slug"] for r in read_jsonl(out / "statements.jsonl") if r["reason"] in ("ok", "paid_only", "not_found")}
        old = {} if args.no_reuse else load_old_statements(OLD_SNAPSHOT)
        pending = [p for p in problems if p["slug"] not in stored]
        reusable = [p for p in pending if p["slug"] in old]
        todo = [p for p in pending if p["slug"] not in old and not p["paid_only"]]
        print(f"{args.phase}: output {out}")
        print(f"list: {'present' if problems else 'missing'} ({len(problems)} rows); reused from 2026-01: {len(reusable)}; to fetch: {len(todo)}")
        print(f"estimated time at {args.gap}s per request: {len(todo) * args.gap / 60:.0f} min")
        return 0
    out.mkdir(parents=True, exist_ok=True, mode=0o700)
    reuse = None if args.no_reuse else OLD_SNAPSHOT
    receipt = fetch_list(out, gap=args.gap) if args.phase == "list" else fetch_content(out, gap=args.gap, limit=args.limit, reuse=reuse)
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 1 if receipt.get("stopped") else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        sys.exit(f"error: {exc}")
