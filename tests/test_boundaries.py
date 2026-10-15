import runpy
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "scripts" / "fetch-map-boundaries.py"


class BoundaryPreparationTest(unittest.TestCase):
    def test_filters_joint_interest_areas_and_retains_authoritative_ids(self):
        module = runpy.run_path(str(SCRIPT))
        prepare = module["prepare_feature_collection"]
        geometry = {
            "type": "Polygon",
            "coordinates": [[[-74.0, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.0, 40.7]]],
        }
        source = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "geometry": geometry, "properties": {"boro_cd": "101"}},
                {"type": "Feature", "geometry": geometry, "properties": {"boro_cd": "164"}},
            ],
        }

        result = prepare(source, "community_districts", "2026-10-14", 0)

        self.assertEqual(len(result["features"]), 1)
        self.assertEqual(result["features"][0]["id"], "101")
        self.assertEqual(result["features"][0]["properties"]["boro_cd"], "101")
        self.assertEqual(result["metadata"]["dataset_id"], "5crt-au7u")
        self.assertEqual(result["metadata"]["feature_count"], 1)


if __name__ == "__main__":
    unittest.main()
