import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER = REPO_ROOT / "scripts" / "check-snapshot-freshness.py"


def run_checker(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(CHECKER), *args],
        capture_output=True,
        text=True,
        timeout=60,
    )


class SnapshotFreshnessTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp_path = Path(self._tmp.name)

    def write_snapshot(self, payload: dict, name: str = "snapshot.json") -> Path:
        path = self.tmp_path / name
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def test_stale_snapshot_fails(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "2026-10-01"})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("stale", result.stdout.lower())

    def test_fresh_snapshot_passes(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "2026-10-29"})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("fresh", result.stdout.lower())

    def test_exactly_max_days_passes(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "2026-10-22"})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_one_day_over_max_days_fails(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "2026-10-21"})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_missing_collected_through_fails(self) -> None:
        snapshot = self.write_snapshot({"record_count": 242, "collected_through": None})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("collected_through", result.stdout + result.stderr)

    def test_absent_key_fails(self) -> None:
        snapshot = self.write_snapshot({"record_count": 0})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_max_days_override_allows_older_snapshot(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "2026-09-20"})
        result = run_checker(
            "--snapshot", str(snapshot), "--as-of", "2026-11-01", "--max-days", "60"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_max_days_override_rejects_recent_snapshot(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "2026-10-25"})
        result = run_checker(
            "--snapshot", str(snapshot), "--as-of", "2026-11-01", "--max-days", "3"
        )
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_iso_timestamp_as_of_is_accepted(self) -> None:
        # GitHub's github.event.head_commit.timestamp is a full ISO-8601 instant.
        snapshot = self.write_snapshot({"collected_through": "2026-10-29"})
        result = run_checker(
            "--snapshot", str(snapshot), "--as-of", "2026-11-01T07:14:22Z"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rerun_of_old_commit_compares_against_commit_date(self) -> None:
        # A snapshot that is stale today must still PASS when --as-of is its commit date:
        # this is the property that keeps a re-run of an old workflow honest.
        snapshot = self.write_snapshot({"collected_through": "2026-10-15"})
        as_committed = run_checker(
            "--snapshot", str(snapshot), "--as-of", "2026-10-16"
        )
        self.assertEqual(as_committed.returncode, 0, as_committed.stdout)
        as_rerun = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(as_rerun.returncode, 1, as_rerun.stdout)

    def test_missing_snapshot_file_fails(self) -> None:
        result = run_checker(
            "--snapshot", str(self.tmp_path / "nope.json"), "--as-of", "2026-11-01"
        )
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("not found", (result.stdout + result.stderr).lower())

    def test_malformed_collected_through_fails(self) -> None:
        snapshot = self.write_snapshot({"collected_through": "last Tuesday"})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_default_snapshot_is_the_tracked_file(self) -> None:
        # No --snapshot: the checker must resolve the tracked snapshot and read a real
        # collected_through from it. --as-of is pinned to that value so the assertion
        # stays true as the calendar moves.
        tracked = REPO_ROOT / "src" / "data" / "public-dashboard-data.json"
        collected_through = json.loads(tracked.read_text(encoding="utf-8"))[
            "collected_through"
        ]
        result = run_checker("--as-of", collected_through)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"collected_through={collected_through}", result.stdout)


if __name__ == "__main__":
    unittest.main()
