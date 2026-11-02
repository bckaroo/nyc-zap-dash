import datetime as dt
import json
import runpy
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPORTER = REPO_ROOT / "scripts" / "export-public-dashboard-data.py"

SEED_TABLE = """
    CREATE TABLE zap_applications (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        project_name TEXT,
        project_brief TEXT,
        borough TEXT,
        community_district TEXT,
        public_status TEXT,
        ulurp_non TEXT,
        ceqr_number TEXT,
        ceqr_type TEXT,
        eas_eis TEXT,
        primary_applicant TEXT,
        applicant_type TEXT,
        flood_zone_a INTEGER,
        flood_zone_shadedx INTEGER,
        milestone_date TEXT,
        pipeline_start_date TEXT,
        certified_referred TEXT,
        first_seen_date TEXT,
        last_updated_date TEXT,
        newsletter_included TEXT,
        bbls_json TEXT,
        bbl_featurecollection_json TEXT,
        action_codes_json TEXT,
        geography_location_method TEXT,
        geography_location_source TEXT,
        geography_enriched_at TEXT,
        geography_status TEXT
    )
"""

SEED_ROW = """
    INSERT INTO zap_applications VALUES (
        '2026K0001', '2026K0001', 'Test Project', 'Public source brief',
        'Brooklyn', 'K08', 'Filed', 'ULURP', '26DCP001K', 'Unlisted',
        'EAS', 'Named Applicant LLC', 'Private', 0, 1,
        '2026-09-15', '2025-11-04', '2026-08-01', '2026-07-01', '2026-10-01',
        'internal-only', '["3012340056"]',
        '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"bbl":"3012340056"},"geometry":{"type":"Polygon","coordinates":[[[-73.96,40.67],[-73.95,40.67],[-73.95,40.68],[-73.96,40.67]]]}}]}',
        '["ZM"]', 'zap_bbl_polygon', 'ZAP bbl-featurecollection',
        '2026-10-02T12:00:00+00:00', 'located'
    )
"""


class PublicDashboardExportTest(unittest.TestCase):
    def _seed_db(self, db_path: Path) -> None:
        with sqlite3.connect(db_path) as connection:
            connection.execute(SEED_TABLE)
            connection.execute(SEED_ROW)

    def _make_snapshot(self, snapshot_path: Path) -> None:
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "generated_at": "2026-10-02T12:00:00+00:00",
            "collected_through": "2026-10-01",
            "source": {
                "name": "NYC Department of City Planning Zoning Application Portal",
                "url": "https://zap.planning.nyc.gov/projects",
                "api_url": "https://zap-api-production.herokuapp.com/projects",
            },
            "record_count": 1,
            "boundaries": {
                "boroughs": {"dataset_id": "gthc-hcne"},
                "community_districts": {"dataset_id": "5crt-au7u"},
            },
            "map": {
                "borough_counts": [{"id": "3", "name": "Brooklyn", "project_count": 1}],
                "community_district_counts": [{"id": "308", "borough": "Brooklyn", "project_count": 1}],
                "project_sites": {"type": "FeatureCollection", "features": []},
                "located_project_count": 0,
                "site_point_count": 0,
                "unmatched_project_count": 1,
            },
            "records": [
                {
                    "id": "2026K0001",
                    "project_id": "2026K0001",
                    "project_name": "Snapshot Project",
                    "project_brief": "Brief",
                    "borough": "Brooklyn",
                    "community_district": "K08",
                    "public_status": "Filed",
                    "ulurp_non": "ULURP",
                    "ceqr_number": "26DCP001K",
                    "ceqr_type": "Unlisted",
                    "eas_eis": "EAS",
                    "primary_applicant": "Named Applicant LLC",
                    "applicant_type": "Private",
                    "flood_zone_a": 0,
                    "flood_zone_shadedx": 1,
                    "milestone_date": "2026-09-15",
                    "pipeline_start_date": "2025-11-04",
                    "certified_referred": "2026-08-01",
                    "first_seen_date": "2026-07-01",
                    "last_updated_date": "2026-10-01",
                    "activity_date": "2026-09-15",
                    "source_url": "https://zap.planning.nyc.gov/projects/2026K0001",
                    "action_types": [],
                    "location_method": "",
                    "location_source": "",
                }
            ],
        }
        snapshot_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    def test_cli_builds_allowlisted_deterministic_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            output_path = tmp_path / "dashboard.json"
            self._seed_db(db_path)

            subprocess.run(
                [
                    "python3",
                    str(EXPORTER),
                    "--db",
                    str(db_path),
                    "--output",
                    str(output_path),
                    "--generated-at",
                    "2026-10-02T12:00:00+00:00",
                ],
                check=True,
                cwd=REPO_ROOT,
            )
            payload = json.loads(output_path.read_text())

            self.assertEqual(payload["generated_at"], "2026-10-02T12:00:00+00:00")
            self.assertEqual(payload["collected_through"], "2026-10-01")
            self.assertEqual(payload["record_count"], 1)
            self.assertEqual(
                set(payload),
                {"generated_at", "collected_through", "source", "record_count", "boundaries", "map", "records", "collector"},
            )
            self.assertEqual(payload["source"]["name"], "NYC Department of City Planning Zoning Application Portal")
            self.assertEqual(payload["source"]["url"], "https://zap.planning.nyc.gov/projects")
            record = payload["records"][0]
            self.assertEqual(
                set(record),
                {
                    "id", "project_id", "project_name", "project_brief", "borough",
                    "community_district", "public_status", "ulurp_non", "ceqr_number",
                    "ceqr_type", "eas_eis", "primary_applicant", "applicant_type",
                    "flood_zone_a", "flood_zone_shadedx", "milestone_date",
                    "pipeline_start_date",
                    "certified_referred", "first_seen_date", "last_updated_date",
                    "activity_date", "source_url", "action_types", "location_method", "location_source",
                },
            )
            self.assertEqual(record["activity_date"], "2026-09-15")
            self.assertEqual(record["pipeline_start_date"], "2025-11-04")
            self.assertEqual(record["source_url"], "https://zap.planning.nyc.gov/projects/2026K0001")
            self.assertEqual(record["action_types"], ["ZM"])
            self.assertEqual(record["location_method"], "zap_bbl_polygon")
            self.assertEqual(payload["map"]["site_point_count"], 1)
            self.assertNotIn("newsletter_included", record)
            self.assertNotIn(str(db_path), json.dumps(payload))

    def test_substantive_activity_dates_take_precedence_over_recent_discovery(self):
        activity_date = runpy.run_path(str(EXPORTER))["activity_date"]

        self.assertEqual(
            activity_date(
                {
                    "milestone_date": "2024-03-14",
                    "certified_referred": "2025-06-01",
                    "first_seen_date": "2026-10-12T09:30:00Z",
                }
            ),
            "2024-03-14",
        )
        self.assertEqual(
            activity_date(
                {
                    "milestone_date": "",
                    "certified_referred": "2025-06-01",
                    "first_seen_date": "2026-10-12T09:30:00Z",
                }
            ),
            "2025-06-01",
        )
        self.assertEqual(
            activity_date(
                {
                    "milestone_date": "",
                    "certified_referred": "",
                    "first_seen_date": "2026-10-12T09:30:00Z",
                }
            ),
            "2026-10-12",
        )

    def test_missing_database_falls_back_to_tracked_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            snapshot_path = tmp_path / "snapshot.json"
            output_path = tmp_path / "dashboard.json"
            self._make_snapshot(snapshot_path)

            result = subprocess.run(
                [
                    "python3",
                    str(EXPORTER),
                    "--db",
                    str(tmp_path / "missing.db"),
                    "--output",
                    str(output_path),
                    "--snapshot",
                    str(snapshot_path),
                ],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertEqual(
                output_path.read_text(encoding="utf-8"),
                snapshot_path.read_text(encoding="utf-8"),
            )
            self.assertIn("snapshot fallback", result.stdout.lower())

    def test_missing_database_and_snapshot_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            result = subprocess.run(
                [
                    "python3",
                    str(EXPORTER),
                    "--db",
                    str(tmp_path / "missing.db"),
                    "--output",
                    str(tmp_path / "dashboard.json"),
                    "--snapshot",
                    str(tmp_path / "missing-snapshot.json"),
                ],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
            )

            self.assertNotEqual(result.returncode, 0)
            combined = (result.stdout + result.stderr).lower()
            self.assertIn("zap-applications.db", combined)
            self.assertIn("snapshot", combined)

    def test_empty_database_exports_zero_record_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            output_path = tmp_path / "dashboard.json"
            with sqlite3.connect(db_path) as connection:
                connection.execute(SEED_TABLE)

            subprocess.run(
                [
                    "python3",
                    str(EXPORTER),
                    "--db",
                    str(db_path),
                    "--output",
                    str(output_path),
                    "--generated-at",
                    "2026-10-02T12:00:00+00:00",
                    "--no-snapshot-update",
                ],
                check=True,
                cwd=REPO_ROOT,
            )
            payload = json.loads(output_path.read_text())

            self.assertEqual(payload["record_count"], 0)
            self.assertEqual(payload["records"], [])
            self.assertEqual(payload["collected_through"], "")

    def test_snapshot_update_writes_tracked_snapshot_alongside_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            output_path = tmp_path / "dashboard.json"
            snapshot_path = tmp_path / "snapshot.json"
            self._seed_db(db_path)

            subprocess.run(
                [
                    "python3",
                    str(EXPORTER),
                    "--db",
                    str(db_path),
                    "--output",
                    str(output_path),
                    "--snapshot",
                    str(snapshot_path),
                    "--update-snapshot",
                    "--generated-at",
                    "2026-10-02T12:00:00+00:00",
                ],
                check=True,
                cwd=REPO_ROOT,
            )

            snapshot_payload = json.loads(snapshot_path.read_text())
            output_payload = json.loads(output_path.read_text())
            self.assertEqual(snapshot_payload, output_payload)
            self.assertEqual(snapshot_payload["generated_at"], "2026-10-02T12:00:00+00:00")


RUNS_TABLE = """
    CREATE TABLE zap_collector_runs (
        run_id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        records_upserted INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'running',
        error TEXT
    )
"""


class CollectorStateExportTest(unittest.TestCase):
    """The export must carry the run ledger so the gate can tell a dead collector
    from a quiet week."""

    def _seed(self, db_path: Path, runs: list[tuple]) -> None:
        with sqlite3.connect(db_path) as connection:
            connection.execute(SEED_TABLE)
            connection.execute(SEED_ROW)
            connection.execute(RUNS_TABLE)
            for run in runs:
                connection.execute(
                    "INSERT INTO zap_collector_runs"
                    " (started_at, finished_at, records_upserted, status, error)"
                    " VALUES (?, ?, ?, ?, ?)",
                    run,
                )

    def _export(self, db_path: Path, output_path: Path) -> dict:
        subprocess.run(
            [
                "python3",
                str(EXPORTER),
                "--db",
                str(db_path),
                "--output",
                str(output_path),
                "--generated-at",
                "2026-11-02T12:00:00+00:00",
            ],
            check=True,
            cwd=REPO_ROOT,
        )
        return json.loads(output_path.read_text())

    def test_exports_last_successful_run_and_latest_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            self._seed(
                db_path,
                [
                    ("2026-10-26T06:45:00+00:00", "2026-10-26T07:02:00+00:00", 240, "ok", None),
                    ("2026-11-02T06:45:00+00:00", "2026-11-02T06:45:30+00:00", 0, "error",
                     "ZAP API unreachable (probe 2026M0366 failed)"),
                ],
            )
            payload = self._export(db_path, tmp_path / "dashboard.json")
            collector = payload["collector"]
            self.assertEqual(collector["last_success_at"], "2026-10-26T07:02:00+00:00")
            self.assertEqual(collector["last_run_at"], "2026-11-02T06:45:30+00:00")
            self.assertEqual(collector["last_status"], "error")
            self.assertEqual(collector["last_records_upserted"], 0)

    def test_empty_successful_run_is_exported_as_success(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            self._seed(
                db_path,
                [("2026-11-02T06:45:00+00:00", "2026-11-02T07:01:00+00:00", 0, "ok", None)],
            )
            collector = self._export(db_path, tmp_path / "dashboard.json")["collector"]
            self.assertEqual(collector["last_success_at"], "2026-11-02T07:01:00+00:00")
            self.assertEqual(collector["last_records_upserted"], 0)

    def test_crashed_run_is_not_a_success(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            self._seed(
                db_path,
                [("2026-11-02T06:45:00+00:00", None, 0, "running", None)],
            )
            collector = self._export(db_path, tmp_path / "dashboard.json")["collector"]
            self.assertIsNone(collector["last_success_at"])
            self.assertEqual(collector["last_status"], "running")
            self.assertEqual(collector["last_run_at"], "2026-11-02T06:45:00+00:00")

    def test_database_without_the_ledger_exports_nulls(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            with sqlite3.connect(db_path) as connection:
                connection.execute(SEED_TABLE)
                connection.execute(SEED_ROW)
            collector = self._export(db_path, tmp_path / "dashboard.json")["collector"]
            self.assertEqual(
                collector,
                {
                    "last_success_at": None,
                    "last_run_at": None,
                    "last_status": None,
                    "last_records_upserted": None,
                },
            )

    def test_collector_block_publishes_four_summary_fields_and_no_run_history(self) -> None:
        # Ops' call, final: the block is the four summary fields. Run history is a
        # query against the ledger, not a published field -- it would be a permanent
        # commitment to every consumer for a diagnostic the gate already encodes in
        # its own failure message.
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            self._seed(
                db_path,
                [
                    ("2026-10-26T06:45:00+00:00", "2026-10-26T07:02:00+00:00", 240, "ok", None),
                    ("2026-11-02T06:45:00+00:00", "2026-11-02T07:01:00+00:00", 0, "ok", None),
                ],
            )
            collector = self._export(db_path, tmp_path / "dashboard.json")["collector"]
            self.assertEqual(
                set(collector),
                {"last_success_at", "last_run_at", "last_status", "last_records_upserted"},
            )
            self.assertNotIn("recent_runs", collector)
            self.assertNotIn("exported_at", collector)

    def test_hung_run_is_visible_alongside_the_last_success(self) -> None:
        # ops' case: the newest row never finished. The payload shows a newest run in
        # 'running' with last_success_at a cycle back, which is the whole signal -- the
        # gate measures the last success, so no per-row history is needed to see it.
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            self._seed(
                db_path,
                [
                    ("2026-10-26T06:45:00+00:00", "2026-10-26T07:02:00+00:00", 240, "ok", None),
                    ("2026-11-02T06:45:00+00:00", None, 0, "running", None),
                ],
            )
            collector = self._export(db_path, tmp_path / "dashboard.json")["collector"]
            self.assertEqual(collector["last_status"], "running")
            self.assertEqual(collector["last_success_at"], "2026-10-26T07:02:00+00:00")
            self.assertEqual(collector["last_run_at"], "2026-11-02T06:45:00+00:00")
            self.assertEqual(collector["last_records_upserted"], 0)

    def test_swept_row_cannot_pass_for_activity(self) -> None:
        # The sweep writes the *next* run's start into the swept row's finished_at, so a
        # run that hung is declared dead a week later. The payload publishes that
        # declaration time as last_run_at, which therefore looks freshly touched while
        # the work behind it is a cycle old. Recency must be read off last_success_at,
        # which only ever comes from a row that recorded 'ok' -- never off last_run_at.
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "zap.db"
            self._seed(
                db_path,
                [
                    ("2026-10-19T06:45:00+00:00", "2026-10-19T07:02:00+00:00", 240, "ok", None),
                    (
                        "2026-10-26T06:45:00+00:00",
                        "2026-11-02T06:45:00+00:00",
                        0,
                        "error",
                        "run did not finish (no completion record)",
                    ),
                    ("2026-11-02T06:45:00+00:00", None, 0, "running", None),
                ],
            )
            collector = self._export(db_path, tmp_path / "dashboard.json")["collector"]
            # last_run_at is the newest run's start, i.e. the sweeping run -- fresh.
            self.assertEqual(collector["last_run_at"], "2026-11-02T06:45:00+00:00")
            # The last success is two cycles back, behind the swept row. That is the
            # only field that carries recency, and it cannot be fooled by the sweep.
            self.assertEqual(collector["last_success_at"], "2026-10-19T07:02:00+00:00")
            self.assertEqual(collector["last_status"], "running")
            # Two cycles of gap: last_run_at is fresh, the work behind it is not.
            gap_days = (
                dt.datetime.fromisoformat(collector["last_run_at"])
                - dt.datetime.fromisoformat(collector["last_success_at"])
            ).total_seconds() / 86400.0
            self.assertGreater(gap_days, 13)


class CollectorBlockValidationTest(unittest.TestCase):
    """The collector block is optional provenance, and must be an object when present."""

    def setUp(self) -> None:
        self.validate = runpy.run_path(str(EXPORTER))["validate_payload"]

    def _payload(self, **collector: object) -> dict:
        state = {
            "last_success_at": "2026-11-02T07:01:00+00:00",
            "last_run_at": "2026-11-02T07:01:00+00:00",
            "last_status": "ok",
            "last_records_upserted": 3,
        }
        state.update(collector)
        return {
            "generated_at": "2026-11-02T12:00:00+00:00",
            "collected_through": "2026-11-01",
            "source": {"name": "n", "url": "https://example.test"},
            "record_count": 0,
            "boundaries": {},
            "map": {
                "project_sites": {"type": "FeatureCollection", "features": []},
                "site_point_count": 0,
            },
            "records": [],
            "collector": state,
        }

    def test_well_formed_collector_passes(self) -> None:
        self.validate(self._payload())

    def test_rejects_collector_metadata_that_is_not_an_object(self) -> None:
        payload = self._payload()
        payload["collector"] = ["last_status"]
        with self.assertRaises(ValueError):
            self.validate(payload)

    def test_accepts_a_payload_with_no_collector_block(self) -> None:
        # An older snapshot still validates: the block is provenance, not a
        # prerequisite, and its absence must not turn into an export failure.
        payload = self._payload()
        payload.pop("collector")
        self.validate(payload)


if __name__ == "__main__":
    unittest.main()