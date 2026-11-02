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


    # ── liveness: the collector run ledger ──

    def write_snapshot_with_collector(
        self, collected_through: str, last_success_at, **collector: object
    ) -> Path:
        state = {
            "last_success_at": last_success_at,
            "last_run_at": last_success_at,
            "last_status": "ok" if last_success_at else "error",
            "last_records_upserted": 12,
        }
        state.update(collector)
        return self.write_snapshot(
            {"collected_through": collected_through, "collector": state}
        )

    def test_dead_collector_fails_even_though_the_data_looks_fresh(self) -> None:
        # THE hole DEV-343 closes: collected_through is only 4 days old, so the
        # staleness window is satisfied, but no successful run in 9 days means the
        # collector is dead and the next deploy ships numbers nobody refreshed.
        snapshot = self.write_snapshot_with_collector("2026-10-28", "2026-10-23")
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("collector run", result.stdout.lower())

    def test_recent_successful_run_passes(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-10-30", "2026-10-30")
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("live", result.stdout.lower())

    def test_exactly_max_collector_age_passes(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-10-24", "2026-10-24")
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_one_day_over_max_collector_age_fails(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-10-23", "2026-10-23")
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_empty_but_successful_run_counts_as_live(self) -> None:
        # A run that upserted nothing is still a run: the collector is alive and the
        # absence of new filings is a real answer, not a failure.
        snapshot = self.write_snapshot_with_collector(
            "2026-10-31", "2026-10-31", last_records_upserted=0
        )
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("records=0", result.stdout)

    def test_failed_latest_run_fails_even_though_the_last_good_run_is_recent(self) -> None:
        # The run that matters is the most recent one. A failed run leaves every
        # date in the snapshot written by the previous success, so both date
        # assertions pass while the newest attempt to collect is dead.
        snapshot = self.write_snapshot_with_collector(
            "2026-10-28",
            "2026-10-28",
            last_run_at="2026-10-31T06:45:00+00:00",
            last_status="error",
        )
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("collector run failed", result.stdout.lower())
        self.assertIn("status=error", result.stdout)

    def test_failed_first_run_fails_instead_of_falling_back_to_staleness(self) -> None:
        # A ledger that has recorded only failures has no good run to fall back to;
        # it must not be mistaken for a pre-ledger snapshot.
        snapshot = self.write_snapshot_with_collector(
            "2026-10-28", None, last_run_at="2026-10-31T06:45:00+00:00"
        )
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("collector run failed", result.stdout.lower())

    def test_in_flight_run_is_not_treated_as_a_failure(self) -> None:
        # A run still marked 'running' is in progress, not dead; the age of the last
        # success is what decides.
        snapshot = self.write_snapshot_with_collector(
            "2026-10-31",
            "2026-10-31",
            last_run_at="2026-11-01T06:45:00+00:00",
            last_status="running",
        )
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("OK (live)", result.stdout)

    def test_success_after_the_reference_date_is_treated_as_live(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-11-05", "2026-11-05")
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_max_collector_age_override_rejects_recent_run(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-10-30", "2026-10-30")
        result = run_checker(
            "--snapshot",
            str(snapshot),
            "--as-of",
            "2026-11-01",
            "--max-collector-age-days",
            "1",
        )
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_max_collector_age_override_allows_old_run(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-11-01", "2026-09-01")
        result = run_checker(
            "--snapshot",
            str(snapshot),
            "--as-of",
            "2026-11-01",
            "--max-collector-age-days",
            "90",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_pre_ledger_snapshot_falls_back_to_the_staleness_window(self) -> None:
        # No collector block at all: behave exactly as before DEV-343 so landing the
        # check never reddens a snapshot that used to pass.
        snapshot = self.write_snapshot({"collected_through": "2026-10-22"})
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("pre-ledger", result.stdout)

    def test_null_last_success_at_falls_back_to_the_staleness_window(self) -> None:
        snapshot = self.write_snapshot_with_collector(
            "2026-10-31", None, last_status="running", last_run_at=None
        )
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("pre-ledger", result.stdout)

    def test_malformed_last_success_at_fails(self) -> None:
        snapshot = self.write_snapshot_with_collector("2026-10-31", "last Monday")
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("last_success_at", result.stdout + result.stderr)

    def test_malformed_collector_block_falls_back_instead_of_crashing(self) -> None:
        snapshot = self.write_snapshot(
            {"collected_through": "2026-10-31", "collector": "nope"}
        )
        result = run_checker("--snapshot", str(snapshot), "--as-of", "2026-11-01")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("pre-ledger", result.stdout)


if __name__ == "__main__":
    unittest.main()
