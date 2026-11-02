"""Authored synthetic inputs; no upstream data."""
import csv
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from research.company_prep.build_company_layer import build, sha, HEADER


class BuilderTest(unittest.TestCase):
    def test_build_and_guards(self):
        with tempfile.TemporaryDirectory(prefix='company 한 # % ') as tmp:
            root = Path(tmp)
            upstream = root / 'source'
            folder = upstream / 'Example Inc'
            folder.mkdir(parents=True)
            with (folder / '5. All.csv').open('w', newline='') as f:
                w = csv.writer(f)
                w.writerow(HEADER)
                for link, difficulty in [('HTTPS://LEETCODE.COM/problems/ONE/?x=1#x', 'HARD'), ('https://leetcode.com/problems/old/', 'EASY'), ('https://leetcode.com/problems/missing/', 'EASY')]:
                    w.writerow([difficulty, 'Authored', '10', 'secret-rate', link, 'secret-topic'])
                w.writerow(['broken'])
            with (folder / '1. Thirty Days.csv').open('w', newline='') as f:
                csv.writer(f).writerow(HEADER[:-1])
            def git(*args):
                return subprocess.check_output(['git', '-C', str(upstream), *args], text=True).strip()
            git('init', '-q')
            git('add', '.')
            git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
            commit = git('rev-parse', 'HEAD')
            catalog = root / 'catalog.sqlite3'
            with sqlite3.connect(catalog) as db:
                db.executescript("CREATE TABLE problems(problem_key, difficulty_value, platform); CREATE TABLE aliases(alias_key,canonical_key); INSERT INTO problems VALUES ('leetcode:one',1,'leetcode'); INSERT INTO aliases VALUES ('leetcode:old','leetcode:one');")
            receipt = dict(version='catalog-fixture', output_sha256=sha(catalog))
            catalog.with_name('receipt.json').write_text(json.dumps(receipt))
            a = build(upstream, commit, catalog, root / 'a', 'company-v1')
            b = build(upstream, commit, catalog, root / 'b', 'company-v1')
            self.assertEqual(a['output_sha256'], b['output_sha256'])
            self.assertEqual(a['report'], dict(companies=1, files=2, empty_files=1, malformed_rows=1, duplicate_rows=1, matched=1, unmatched=1, slugs=2, difficulty_disagreements=1))
            payload = (root / 'a/company-v1.sqlite3').read_bytes()
            self.assertNotIn(b'secret-rate', payload)
            self.assertNotIn(b'secret-topic', payload)
            with self.assertRaises(FileExistsError):
                build(upstream, commit, catalog, root / 'a', 'company-v1')
            with self.assertRaisesRegex(ValueError, 'HEAD mismatch'):
                build(upstream, 'wrong', catalog, root / 'c', 'company-v1')
            with self.assertRaisesRegex(ValueError, 'invalid company layer version'):
                build(upstream, commit, catalog, root / 'escape', '../escape')
            bad = folder / '5. All.csv'
            original = bad.read_bytes()
            bad.write_text('unsupported,header\n')
            git('add', '.')
            git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'invalid fixture')
            bad_commit = git('rev-parse', 'HEAD')
            with self.assertRaisesRegex(ValueError, 'unsupported CSV header'):
                build(upstream, bad_commit, catalog, root / 'retry', 'company-v2')
            self.assertFalse((root / 'retry').exists())
            bad.write_bytes(original)
            git('add', '.')
            git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'repair fixture')
            commit = git('rev-parse', 'HEAD')
            repaired = build(upstream, commit, catalog, root / 'retry', 'company-v2')
            self.assertEqual(repaired['report']['matched'], 1)
            receipt['output_sha256'] = 'wrong'
            catalog.with_name('receipt.json').write_text(json.dumps(receipt))
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                build(upstream, commit, catalog, root / 'c', 'company-v1')
