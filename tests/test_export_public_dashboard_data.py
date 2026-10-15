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
        '2026-09-15', '2026-08-01', '2026-07-01', '2026-10-01',
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
                {"generated_at", "collected_through", "source", "record_count", "boundaries", "map", "records"},
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
                    "certified_referred", "first_seen_date", "last_updated_date",
                    "activity_date", "source_url", "action_types", "location_method", "location_source",
                },
            )
            self.assertEqual(record["activity_date"], "2026-09-15")
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


if __name__ == "__main__":
    unittest.main()