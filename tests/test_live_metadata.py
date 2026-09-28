"""Source metadata must survive normalization without invented defaults."""

import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location(
    "update_live_data", Path(__file__).resolve().parents[1] / "scripts" / "update_live_data.py"
)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class LiveMetadataTests(unittest.TestCase):
    def test_supplied_and_missing_source_metadata(self):
        def feature(event_id, extra):
            return {
                "id": event_id,
                "geometry": {"coordinates": [140, 35, 10]},
                "properties": {"mag": 4.5, "time": 1790000000000, **extra},
            }

        rows = updater.normalize([
            feature("a", {"magType": "mb", "status": "reviewed"}),
            feature("b", {"magType": "ml", "status": "automatic"}),
            feature("c", {}),
            feature("d", {"magType": None, "status": None}),
        ])
        self.assertEqual(
            [(row["mag_type"], row["status"]) for row in rows],
            [("mb", "reviewed"), ("ml", "automatic"), ("", ""), ("", "")],
        )


if __name__ == "__main__":
    unittest.main()
