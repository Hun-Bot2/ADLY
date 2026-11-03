"""Offline tests for the LeetCode snapshot fetcher: authored fake responses only, no network."""
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('fetch_snapshot', ROOT / 'scripts/learning/fetch_leetcode_snapshot.py')
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)

PROBLEMS = [
    {'questionFrontendId': str(i), 'title': f'Authored {i}', 'titleSlug': f'authored-{i}', 'difficulty': 'Easy',
     'isPaidOnly': i % 50 == 0, 'topicTags': [{'name': 'Array', 'slug': 'array'}]}
    for i in range(1, 151)
]


class FakeLeetCode:
    def __init__(self, fail_slugs=(), fail_all=False):
        self.payloads, self.fail_slugs, self.fail_all = [], set(fail_slugs), fail_all

    def __call__(self, payload):
        self.payloads.append(payload)
        variables = payload['variables']
        if 'questionList' in payload['query']:
            page = PROBLEMS[variables['skip']:variables['skip'] + variables['limit']]
            return 200, json.dumps({'data': {'questionList': {'total': len(PROBLEMS), 'questions': page}}}).encode()
        slug = variables['titleSlug']
        if self.fail_all or slug in self.fail_slugs:
            return 429, b'{}'
        if slug == 'authored-7':
            return 200, json.dumps({'data': {'question': None}}).encode()
        return 200, json.dumps({'data': {'question': {'titleSlug': slug, 'isPaidOnly': False, 'content': f'<p>statement {slug}</p>'}}}).encode()


def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


class FetchSnapshotTest(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.out = Path(self.tmp.name)
        self.sleeps = []

    def tearDown(self):
        self.tmp.cleanup()

    def test_list_pages_and_refuses_overwrite(self):
        fake = FakeLeetCode()
        receipt = fetcher.fetch_list(self.out, post=fake, sleep=self.sleeps.append)
        self.assertEqual(receipt['rows'], 150)
        self.assertEqual(receipt['paid_only'], 3)
        self.assertEqual(receipt['requests'], 2)
        self.assertEqual(self.sleeps, [2.0])
        first = rows(self.out / 'problems.jsonl')[0]
        self.assertEqual(first, {'frontend_id': '1', 'title': 'Authored 1', 'slug': 'authored-1', 'difficulty': 'Easy',
                                 'paid_only': False, 'tags': ['Array'], 'tag_slugs': ['array']})
        with self.assertRaises(FileExistsError):
            fetcher.fetch_list(self.out, post=fake, sleep=self.sleeps.append)

    def test_content_paid_rows_need_no_request_and_resume_skips_stored(self):
        fetcher.fetch_list(self.out, post=FakeLeetCode(), sleep=lambda s: None)
        fake = FakeLeetCode()
        first = fetcher.fetch_content(self.out, post=fake, sleep=self.sleeps.append, limit=10, log=lambda m: None)
        self.assertEqual(first['requests'], 10)
        self.assertEqual(len(self.sleeps), 9, 'one gap between consecutive requests')
        self.assertEqual(first['remaining'], 150 - 10, 'the run stopped before reaching the paid problems')
        rest = fetcher.fetch_content(self.out, post=fake, sleep=lambda s: None, log=lambda m: None)
        self.assertEqual(rest['requests'], 147 - 10, 'no stored slug is requested twice')
        self.assertEqual(rest['remaining'], 0)
        self.assertEqual(rest['by_reason'], {'not_found': 1, 'ok': 146, 'paid_only': 3})
        requested = [p['variables']['titleSlug'] for p in fake.payloads]
        self.assertEqual(len(requested), len(set(requested)))
        self.assertNotIn('authored-50', requested, 'paid-only problems are not requested')
        again = fetcher.fetch_content(self.out, post=fake, sleep=lambda s: None, log=lambda m: None)
        self.assertEqual(again['requests'], 0)

    def test_errors_are_retried_and_consecutive_errors_stop_the_run(self):
        fetcher.fetch_list(self.out, post=FakeLeetCode(), sleep=lambda s: None)
        bad = fetcher.fetch_content(self.out, post=FakeLeetCode(fail_all=True), sleep=lambda s: None, log=lambda m: None)
        self.assertEqual(bad['requests'], 5)
        self.assertIn('consecutive errors', bad['stopped'])
        good = fetcher.fetch_content(self.out, post=FakeLeetCode(), sleep=lambda s: None, log=lambda m: None)
        self.assertEqual(good['remaining'], 0)
        self.assertEqual(good['by_reason']['ok'], 146, 'earlier error rows were retried and replaced')
        single = FakeLeetCode(fail_slugs={'authored-3'})
        out2 = Path(self.tmp.name) / 'second'
        out2.mkdir()
        fetcher.fetch_list(out2, post=single, sleep=lambda s: None)
        one = fetcher.fetch_content(out2, post=single, sleep=lambda s: None, log=lambda m: None)
        self.assertIsNone(one['stopped'])
        self.assertEqual(one['by_reason']['error'], 1)
        self.assertEqual(one['remaining'], 1)

    def test_cli_guards(self):
        with self.assertRaises(ValueError):
            fetcher.main(['content', '--gap', '0.5', '--output', str(self.out)])
        with self.assertRaises(ValueError):
            fetcher.main(['list', '--output', str(ROOT / 'data' / 'raw')])
        self.assertEqual(fetcher.main(['content', '--dry-run', '--output', str(self.out)]), 0)


if __name__ == '__main__':
    unittest.main()
