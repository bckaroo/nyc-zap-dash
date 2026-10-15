import json
import runpy
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPORTER = REPO_ROOT / "scripts" / "export-public-dashboard-data.py"


def polygon(x: float, y: float):
    return [[
        [x, y],
        [x + 0.01, y],
        [x + 0.01, y + 0.01],
        [x, y + 0.01],
        [x, y],
    ]]


def record(record_id: str, project_id: str, borough: str, district: str, polygons, bbls, actions):
    return {
        "id": record_id,
        "project_id": project_id,
        "project_name": f"Project {project_id}",
        "borough": borough,
        "community_district": district,
        "source_url": f"https://zap.planning.nyc.gov/projects/{record_id}",
        "bbls_json": json.dumps(bbls),
        "bbl_featurecollection_json": json.dumps({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "MultiPolygon", "coordinates": polygons},
            }],
        }),
        "action_codes_json": json.dumps(actions),
        "geography_location_method": "zap_bbl_polygon" if polygons else "",
        "geography_location_source": "ZAP bbl-featurecollection" if polygons else "",
        "geography_status": "located" if polygons else "unmatched",
    }


class MapExportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = runpy.run_path(str(EXPORTER))

    def test_counts_distinct_projects_even_when_project_rows_or_sites_repeat(self):
        build_map_payload = self.module["build_map_payload"]
        rows = [
            record("2026K0001-A", "2026K0001", "Brooklyn", "K08", [polygon(-73.96, 40.67)], ["301"], ["ZM"]),
            record("2026K0001-B", "2026K0001", "Brooklyn", "K08", [polygon(-73.95, 40.68)], ["302"], ["ZM"]),
            record("2026K0002", "2026K0002", "Brooklyn", "K08", [polygon(-73.94, 40.69)], ["303"], ["ZA"]),
        ]

        payload = build_map_payload(rows)

        self.assertEqual(payload["borough_counts"], [{"id": "3", "name": "Brooklyn", "project_count": 2}])
        self.assertEqual(payload["community_district_counts"], [{"id": "308", "borough": "Brooklyn", "project_count": 2}])
        self.assertEqual(payload["located_project_count"], 2)
        self.assertEqual(payload["site_point_count"], 3)
        self.assertEqual([f["properties"]["project_id"] for f in payload["project_sites"]["features"]].count("2026K0001"), 2)

    def test_multibbl_geometry_produces_authoritative_point_per_polygon(self):
        build_map_payload = self.module["build_map_payload"]
        payload = build_map_payload([
            record(
                "2025Q0151",
                "2025Q0151",
                "Queens",
                "Q12",
                [polygon(-73.81, 40.70), polygon(-73.80, 40.71)],
                ["4099860073", "4099880040"],
                ["MM", "ZM"],
            )
        ])

        features = payload["project_sites"]["features"]
        self.assertEqual(len(features), 2)
        self.assertEqual([feature["properties"]["bbl"] for feature in features], ["4099860073", "4099880040"])
        for feature in features:
            self.assertEqual(feature["geometry"]["type"], "Point")
            self.assertEqual(feature["properties"]["location_method"], "point_on_zap_bbl_polygon")
            self.assertEqual(feature["properties"]["location_source"], "ZAP bbl-featurecollection")
            self.assertEqual(feature["properties"]["action_types"], ["MM", "ZM"])

    def test_empty_and_unlocated_records_stay_unmatched_without_fake_points(self):
        build_map_payload = self.module["build_map_payload"]
        payload = build_map_payload([
            record("2026M0001", "2026M0001", "Manhattan", "M05", [], [], []),
            record("2026X0001", "2026X0001", "Bronx", "X03", [], [], ["ZS"]),
        ])

        self.assertEqual(payload["project_sites"]["features"], [])
        self.assertEqual(payload["located_project_count"], 0)
        self.assertEqual(payload["site_point_count"], 0)
        self.assertEqual(payload["unmatched_project_count"], 2)
        self.assertEqual(payload["borough_counts"], [
            {"id": "1", "name": "Manhattan", "project_count": 1},
            {"id": "2", "name": "Bronx", "project_count": 1},
        ])


if __name__ == "__main__":
    unittest.main()
