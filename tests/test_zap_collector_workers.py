"""--workers must not change what the collector records, only how fast it runs."""

import importlib.util
import json
import shutil
import sqlite3
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COLLECTOR = REPO_ROOT / "scripts" / "zap-collector.py"


def load_collector():
    spec = importlib.util.spec_from_file_location("zap_collector_under_test", COLLECTOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fake_response(pid: str, status: str) -> dict:
    recent = (date.today() - timedelta(days=1)).isoformat()
    return {
        "data": {
            "attributes": {
                "dcp-projectname": f"Project {pid}",
                "dcp-borough": "Manhattan",
                "dcp-publicstatus": status,
                "dcp-projectbrief": "brief",
                "dcp-ulurp-nonulurp": "ULURP",
                "dcp-certifiedreferred": recent,
                "dcp-noticeddate": recent,
                "dcp-applicant-customer-value": "Applicant LLC",
                "dcp-validatedcommunitydistricts": "MN-01",
                "dcp-ceqrnumber": "24CEQR0001M",
                "dcp-ceqrtype": "Type I",
                "dcp-easeis": "EIS",
                "bbls": ["1000010001"],
                "bbl-featurecollection": {
                    "type": "FeatureCollection",
                    "features": [],
                },
            }
        },
        "included": [
            {"type": "milestones",
             "attributes": {"statuscode": "Completed",
                            "display-name": "Certified",
                            "dcp-actualstartdate": recent,
                            "dcp-actualenddate": recent}},
            {"type": "actions",
             "attributes": {"dcp-action-value": "zr"}},
        ],
    }


TIMESTAMP_KEYS = ("first_seen", "last_seen", "enriched_at", "last_updated")


def stable(rows):
    cleaned = []
    for row in rows:
        cleaned.append({
            k: v for k, v in row.items()
            if not any(key in k for key in TIMESTAMP_KEYS)
        })
    return cleaned


class WorkerParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # init_db issues one ALTER TABLE per column and each is an fsync on this
        # filesystem (~0.2s), so build the schema once and copy it per run: the
        # test then measures the collector, not SQLite's disk sync.
        cls._template_tmp = tempfile.TemporaryDirectory()
        cls.template_db = Path(cls._template_tmp.name) / "template.db"
        conn = sqlite3.connect(cls.template_db)
        load_collector().init_db(conn)
        conn.close()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._template_tmp.cleanup()

    def setUp(self) -> None:
        self.module = load_collector()
        self.module.SLEEP_BETWEEN_CALLS = 0  # keep the test fast
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp = Path(self._tmp.name)
        self.template_db = type(self).template_db

    def install_fake_api(self):
        """Deterministic synthetic API: mixed active/completed/404/error outcomes."""
        calls = []

        def fake_fetch(pid, verbose=False):
            calls.append(pid)
            if pid == "2026M0366":  # the reachability probe
                return fake_response(pid, "In Public Review")
            last = pid[-1]
            if last in ("3", "5"):
                return None  # 404 scan miss
            if last == "7":
                return "ERR"  # transient failure
            if last in ("0", "9"):
                return fake_response(pid, "Completed")
            return fake_response(pid, f"In Public Review {last}")

        self.module.fetch_project = fake_fetch
        return calls

    def collect(self, workers: int, suffix: str):
        self.install_fake_api()
        db = self.tmp / f"db-{suffix}.db"
        shutil.copyfile(self.template_db, db)
        out = self.tmp / f"out-{suffix}.json"
        result = self.module.run(
            str(db), str(out), [2026], 10, 60, False, workers=workers
        )
        conn = sqlite3.connect(db)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM zap_applications ORDER BY id").fetchall()]
        conn.close()
        return result, rows, json.loads(out.read_text())

    def test_workers_two_matches_serial(self):
        serial_result, serial_rows, serial_out = self.collect(1, "serial")
        parallel_result, parallel_rows, parallel_out = self.collect(2, "parallel")

        self.assertTrue(serial_rows, "fake API should have produced records")
        self.assertEqual(
            [r["id"] for r in serial_rows], [r["id"] for r in parallel_rows]
        )
        # Wall-clock stamps (first_seen/last_seen/enriched_at) legitimately differ
        # between two runs; everything else must be byte-identical.
        self.assertEqual(stable(serial_rows), stable(parallel_rows))
        self.assertEqual(serial_result["totals"], parallel_result["totals"])
        self.assertEqual(
            [p["id"] for p in serial_out["week_projects"]],
            [p["id"] for p in parallel_out["week_projects"]],
        )

    def test_counts_reflect_misses_and_errors(self):
        result, _, _ = self.collect(2, "counts")
        totals = result["totals"]
        # scan_range=10 x 5 borough prefixes = 50 IDs; last digit decides the outcome,
        # so each prefix contributes 2 misses, 1 error, 2 completed, 5 active.
        self.assertEqual(totals["candidates"], 50)
        self.assertEqual(totals["fetched"], 50)
        self.assertEqual(totals["api_errors"], 5)
        self.assertEqual(totals["completed_seen"], 10)
        self.assertEqual(totals["active_tracked"], 25)
        self.assertEqual(
            totals["active_tracked"] + totals["completed_seen"]
            + totals["api_errors"],
            totals["fetched"] - 10,  # the 404 scan misses are fetched but not recorded
        )

    def test_run_defaults_to_serial(self):
        # workers must be keyword-only optional; a 6-arg call keeps working.
        self.install_fake_api()
        db = self.tmp / "db-default.db"
        shutil.copyfile(self.template_db, db)
        result = self.module.run(
            str(db),
            str(self.tmp / "out-default.json"),
            [2026], 2, 60, False,
        )
        self.assertEqual(result["totals"]["candidates"], 10)


if __name__ == "__main__":
    unittest.main()
