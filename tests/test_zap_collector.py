import datetime as dt
import runpy
import sqlite3
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
COLLECTOR = REPO_ROOT / "scripts" / "zap-collector.py"


class ZapGeographyCollectorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = runpy.run_path(str(COLLECTOR))

    def test_extracts_authoritative_bbl_geometry_and_action_codes(self):
        extract = self.module["extract_project_data"]
        api_data = {
            "data": {
                "attributes": {
                    "dcp-projectname": "Mapped project",
                    "dcp-borough": "Queens",
                    "dcp-validatedcommunitydistricts": "Q12",
                    "bbls": ["4099860073", "4099880040"],
                    "bbl-featurecollection": {
                        "type": "FeatureCollection",
                        "features": [
                            {
                                "type": "Feature",
                                "properties": {"bbl": "4099860073"},
                                "geometry": {
                                    "type": "MultiPolygon",
                                    "coordinates": [[[[-73.81, 40.70], [-73.80, 40.70], [-73.80, 40.71], [-73.81, 40.70]]]],
                                },
                            }
                        ],
                    },
                }
            },
            "included": [
                {"type": "actions", "attributes": {"dcp-action-value": "MM"}},
                {"type": "actions", "attributes": {"dcp-action-value": "ZM"}},
                {"type": "actions", "attributes": {"dcp-action-value": "MM"}},
            ],
        }

        row = extract("2025Q0151", api_data)

        self.assertEqual(row["bbls"], ["4099860073", "4099880040"])
        self.assertEqual(row["bbl_featurecollection"]["type"], "FeatureCollection")
        self.assertEqual(row["action_codes"], ["MM", "ZM"])
        self.assertEqual(row["geography_location_method"], "zap_bbl_polygon")
        self.assertEqual(row["geography_location_source"], "ZAP bbl-featurecollection")
        self.assertEqual(row["geography_status"], "located")

    def test_db_only_enrichment_candidates_do_not_scan_nonexistent_ids(self):
        init_db = self.module["init_db"]
        enrichment_ids = self.module["build_enrichment_ids"]
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "zap.db"
            with sqlite3.connect(db_path) as connection:
                init_db(connection)
                connection.executemany(
                    "INSERT INTO zap_applications (id, public_status) VALUES (?, ?)",
                    [("2025Q0151", "Filed"), ("2019K0383", "Completed")],
                )
                self.assertEqual(enrichment_ids(connection), ["2019K0383", "2025Q0151"])

    def test_unlocated_api_record_is_stored_without_guessed_geometry(self):
        extract = self.module["extract_project_data"]
        row = extract(
            "2026M0001",
            {"data": {"attributes": {"dcp-projectname": "Unlocated"}}, "included": []},
        )
        self.assertEqual(row["bbls"], [])
        self.assertEqual(row["bbl_featurecollection"], {"type": "FeatureCollection", "features": []})
        self.assertEqual(row["action_codes"], [])
        self.assertEqual(row["geography_location_method"], "")
        self.assertEqual(row["geography_status"], "unmatched")
        self.assertEqual(row["pipeline_start_date"], "")

    def test_pipeline_start_date_is_the_earliest_actual_milestone(self):
        extract = self.module["extract_project_data"]
        row = extract(
            "2026M0002",
            {
                "data": {"attributes": {"dcp-projectname": "Trend project"}},
                "included": [
                    {
                        "type": "milestones",
                        "attributes": {
                            "display-name": "Certified / Referred",
                            "dcp-actualstartdate": "2026-06-02T13:00:00.000Z",
                            "dcp-actualenddate": "2026-06-09T13:00:00.000Z",
                            "statuscode": "Completed",
                        },
                    },
                    {
                        "type": "milestones",
                        "attributes": {
                            "display-name": "Land Use Application Filed",
                            "dcp-actualstartdate": "2025-11-04T09:00:00.000Z",
                            "dcp-actualenddate": "2025-11-07T09:00:00.000Z",
                            "statuscode": "Completed",
                        },
                    },
                    {
                        # Planned-only milestones must not set the entry month.
                        "type": "milestones",
                        "attributes": {
                            "display-name": "Prepare Filed Land Use Application",
                            "dcp-plannedstartdate": "2025-10-01T09:00:00.000Z",
                            "dcp-actualstartdate": "",
                            "dcp-actualenddate": "",
                            "statuscode": "Not Started",
                        },
                    },
                ],
            },
        )
        self.assertEqual(row["milestone_date"], "2026-06-09")
        self.assertEqual(row["pipeline_start_date"], "2025-11-04")
        self.assertEqual(len(row["milestones"]), 2)


class ZapCollectorRunLedgerTest(unittest.TestCase):
    """The ledger is what makes an empty-but-successful run distinguishable from a
    collector that never ran. These tests pin the state machine."""

    @classmethod
    def setUpClass(cls):
        cls.module = runpy.run_path(str(COLLECTOR))

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.db_path = Path(self._tmp.name) / "zap.db"
        self.conn = sqlite3.connect(self.db_path)
        self.addCleanup(self.conn.close)
        self.module["init_db"](self.conn)

    def rows(self):
        return self.conn.execute(
            "SELECT started_at, finished_at, records_upserted, status, error"
            " FROM zap_collector_runs ORDER BY run_id"
        ).fetchall()

    def test_init_db_creates_the_ledger(self):
        tables = {
            row[0]
            for row in self.conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        self.assertIn("zap_collector_runs", tables)

    def test_start_run_opens_a_running_row(self):
        run_id = self.module["start_run"](self.conn, "2026-11-02T06:45:00+00:00")
        self.assertIsInstance(run_id, int)
        self.assertEqual(
            self.rows(), [("2026-11-02T06:45:00+00:00", None, 0, "running", None)]
        )

    def test_finish_run_records_success_and_upsert_count(self):
        run_id = self.module["start_run"](self.conn, "2026-11-02T06:45:00+00:00")
        self.module["finish_run"](
            self.conn, run_id, "2026-11-02T07:02:00+00:00", 241, "ok"
        )
        self.assertEqual(
            self.rows(),
            [("2026-11-02T06:45:00+00:00", "2026-11-02T07:02:00+00:00", 241, "ok", None)],
        )

    def test_empty_successful_run_is_recorded_as_ok(self):
        # Zero upserts must still be a success: the collector ran and found nothing new.
        run_id = self.module["start_run"](self.conn, "2026-11-02T06:45:00+00:00")
        self.module["finish_run"](
            self.conn, run_id, "2026-11-02T06:46:00+00:00", 0, "ok"
        )
        self.assertEqual(self.rows()[0][3], "ok")
        self.assertEqual(self.rows()[0][2], 0)

    def test_start_run_reclassifies_a_crashed_run_as_error(self):
        # Simulate a run killed mid-flight: the row stays 'running'. The next run must
        # convert it to an error rather than leave a phantom live run behind.
        self.conn.execute(
            "INSERT INTO zap_collector_runs (started_at, status) VALUES (?, 'running')",
            ("2026-10-26T06:45:00+00:00",),
        )
        self.conn.commit()
        self.module["start_run"](self.conn, "2026-11-02T06:45:00+00:00")
        rows = self.rows()
        self.assertEqual(rows[0][3], "error")
        self.assertEqual(rows[0][1], "2026-11-02T06:45:00+00:00")
        self.assertIn("did not finish", rows[0][4])
        self.assertEqual(rows[1][3], "running")

    def test_a_swept_runs_finished_at_is_the_declaration_time_not_the_death_time(self):
        # The sweep stamps the hung row with the *sweeping* run's start, so a Monday run
        # that hangs and is swept the next Monday shows a finished_at a week after its
        # started_at. That is how long it went unnoticed, not how long it ran: a consumer
        # computing a duration would read 604800s and believe it. Pinned here so nobody
        # "fixes" the sweep into writing a death time it cannot know.
        self.conn.execute(
            "INSERT INTO zap_collector_runs (started_at, status) VALUES (?, 'running')",
            ("2026-10-26T06:45:00+00:00",),
        )
        self.conn.commit()
        self.module["start_run"](self.conn, "2026-11-02T06:45:00+00:00")
        swept_started_at, swept_finished_at, _, swept_status, _ = self.rows()[0]
        self.assertEqual(swept_status, "error")
        self.assertEqual(swept_finished_at, "2026-11-02T06:45:00+00:00")
        self.assertEqual(
            (dt.datetime.fromisoformat(swept_finished_at)
             - dt.datetime.fromisoformat(swept_started_at)).total_seconds(),
            7 * 24 * 3600,
        )
        # And the sweep must not manufacture a success: the newest 'ok' row is still the
        # previous week's, which is the only thing liveness may key on.
        self.assertEqual([r for r in self.rows() if r[3] == "ok"], [])

    def test_a_new_run_does_not_disturb_the_previous_success(self):
        first = self.module["start_run"](self.conn, "2026-10-26T06:45:00+00:00")
        self.module["finish_run"](
            self.conn, first, "2026-10-26T07:02:00+00:00", 240, "ok"
        )
        self.module["start_run"](self.conn, "2026-11-02T06:45:00+00:00")
        successes = [
            row for row in self.rows() if row[3] == "ok"
        ]
        self.assertEqual(successes, [("2026-10-26T06:45:00+00:00", "2026-10-26T07:02:00+00:00", 240, "ok", None)])


if __name__ == "__main__":
    unittest.main()