"""Build an immutable private company layer from a pinned local checkout."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import shutil
import subprocess
from urllib.parse import urlsplit

WINDOWS = dict(zip(['1. Thirty Days', '2. Three Months', '3. Six Months', '4. More Than Six Months', '5. All'], ['30d', '3m', '6m', 'gt6m', 'all']))
HEADER = ['Difficulty', 'Title', 'Frequency', 'Acceptance Rate', 'Link', 'Topics']
UPSTREAM = 'https://github.com/liquidslr/leetcode-company-wise-problems'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def slug(link):
    u = urlsplit(link.strip())
    if u.scheme.lower() != 'https' or u.netloc.lower() != 'leetcode.com':
        raise ValueError('invalid problem URL')
    m = re.fullmatch(r'/problems/([a-z0-9-]+)/?', u.path.lower())
    if not m:
        raise ValueError('invalid problem path')
    return m[1]


def build(upstream, commit, catalog, output, version):
    upstream, catalog, output = map(Path, (upstream, catalog, output))
    if not re.fullmatch(r"company-v[1-9][0-9]*", version):
        raise ValueError("invalid company layer version")
    def git(*args):
        return subprocess.check_output(['git', '-C', str(upstream), *args], text=True).strip()
    if git('rev-parse', 'HEAD') != commit:
        raise ValueError('upstream HEAD mismatch')
    if git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('upstream must be clean')
    receipt = json.loads(catalog.with_name('receipt.json').read_text())
    catalog_hash = sha(catalog)
    if receipt['output_sha256'] != catalog_hash:
        raise ValueError('catalog hash mismatch')
    stamp = git('show', '-s', '--format=%cI', 'HEAD')
    source = sqlite3.connect(catalog.resolve().as_uri() + '?mode=ro&immutable=1', uri=True)
    try:
        problems = dict(source.execute("SELECT problem_key, difficulty_value FROM problems WHERE platform='leetcode'"))
        aliases = dict(source.execute('SELECT alias_key, canonical_key FROM aliases'))
    finally:
        source.close()
    output.mkdir(parents=True, exist_ok=False)
    dbpath = output / (version + '.sqlite3')
    db = sqlite3.connect(dbpath)
    report = dict(companies=0, files=0, empty_files=0, malformed_rows=0, duplicate_rows=0)
    matched, unmatched, disagreements = set(), set(), set()
    try:
        db.executescript("""BEGIN IMMEDIATE;
CREATE TABLE company_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE companies(company_id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE company_problems(company_id TEXT NOT NULL REFERENCES companies,window TEXT NOT NULL CHECK(window IN ('30d','3m','6m','gt6m','all')),problem_key TEXT NOT NULL,rank INTEGER NOT NULL,frequency REAL,PRIMARY KEY(company_id,window,problem_key));
CREATE TABLE company_unmatched(company_id TEXT NOT NULL,window TEXT NOT NULL,slug TEXT NOT NULL,rank INTEGER NOT NULL,PRIMARY KEY(company_id,window,slug));
CREATE TABLE company_files(path TEXT PRIMARY KEY,sha256 TEXT NOT NULL,rows INTEGER NOT NULL,empty INTEGER NOT NULL);
""")
        with db:
            for folder in sorted(upstream.iterdir()):
                if folder.is_symlink():
                    raise ValueError('symlink input is not allowed')
                if not folder.is_dir() or folder.name.startswith('.'):
                    continue
                company = re.sub(r'[^a-z0-9]+', '-', folder.name.lower()).strip('-')
                if not company:
                    raise ValueError('empty company identifier')
                db.execute('INSERT INTO companies VALUES (?,?)', (company, folder.name))
                report['companies'] += 1
                for file in sorted(folder.glob('*.csv')):
                    if file.is_symlink():
                        raise ValueError('symlink input is not allowed')
                    if file.stem not in WINDOWS:
                        raise ValueError('unsupported CSV filename: ' + file.name)
                    window = WINDOWS[file.stem]
                    with file.open(newline='', encoding='utf-8') as handle:
                        rows = list(csv.reader(handle))
                    if not rows or rows[0] not in (HEADER, HEADER[:-1]):
                        raise ValueError('unsupported CSV header: ' + file.name)
                    body = rows[1:]
                    report['files'] += 1
                    report['empty_files'] += int(not body)
                    db.execute('INSERT INTO company_files VALUES (?,?,?,?)', (file.relative_to(upstream).as_posix(), sha(file), len(body), int(not body)))
                    seen = set()
                    for rank, row in enumerate(body, 1):
                        try:
                            if len(row) != len(rows[0]):
                                raise ValueError('row width')
                            s = slug(row[4])
                            frequency = float(row[2]) if row[2].strip() else None
                            if frequency is not None and not math.isfinite(frequency):
                                raise ValueError('nonfinite frequency')
                        except ValueError:
                            report['malformed_rows'] += 1
                            continue
                        key = aliases.get('leetcode:' + s, 'leetcode:' + s)
                        if key in seen:
                            report['duplicate_rows'] += 1
                            continue
                        seen.add(key)
                        if key in problems:
                            matched.add(s)
                            if {'EASY': 1, 'MEDIUM': 2, 'HARD': 3}.get(row[0].upper()) != problems[key]:
                                disagreements.add(s)
                            db.execute('INSERT INTO company_problems VALUES (?,?,?,?,?)', (company, window, key, rank, frequency))
                        else:
                            unmatched.add(s)
                            db.execute('INSERT INTO company_unmatched VALUES (?,?,?,?)', (company, window, s, rank))
            if git('rev-parse', 'HEAD') != commit or git('status', '--porcelain', '--untracked-files=all'):
                raise ValueError('upstream changed during build')
            if sha(catalog) != catalog_hash:
                raise ValueError('catalog changed during build')
            report.update(matched=len(matched), unmatched=len(unmatched), slugs=len(matched | unmatched), difficulty_disagreements=len(disagreements))
            meta = dict(version=version, upstream_url=UPSTREAM, commit=commit, commit_date=stamp, built_at=stamp, builder_version='2', catalog_version=receipt['version'], catalog_sha256=catalog_hash, report=report)
            db.executemany('INSERT INTO company_meta VALUES (?,?)', [(k, json.dumps(v, sort_keys=True) if isinstance(v, dict) else v) for k, v in sorted(meta.items())])
    except BaseException:
        db.close()
        shutil.rmtree(output)
        raise
    finally:
        db.close()
    result = dict(meta, output_sha256=sha(dbpath), executed_at=datetime.now(timezone.utc).isoformat(), build_time_policy='database timestamp uses upstream commit time; executed_at is actual build time')
    try:
        (output / 'receipt.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    except BaseException:
        shutil.rmtree(output)
        raise
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('upstream', 'commit', 'catalog', 'output', 'version'):
        p.add_argument('--' + name, required=True)
    print(json.dumps(build(**vars(p.parse_args())), indent=2, sort_keys=True))
