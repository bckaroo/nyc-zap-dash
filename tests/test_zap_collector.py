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


if __name__ == "__main__":
    unittest.main()
