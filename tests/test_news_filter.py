"""Reject known headline metaphors while preserving actual disaster reporting."""

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET


spec = importlib.util.spec_from_file_location(
    "update_content", Path(__file__).resolve().parents[1] / "scripts" / "update_content.py"
)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class NewsFilterTests(unittest.TestCase):
    def test_known_political_metaphors_are_not_news_rows(self):
        titles = [
            "Earthquake as Trump dooms GOP in red state stronghold he won 3 times",
            "The Political Earthquake From Germany’s China Shock",
            "If the Democrats Win These Three Senate Seats, an Earthquake Happened",
            "Earthquake as Canada negotiates with the EU to join as associate member",
        ]
        for title in titles:
            with self.subTest(title=title):
                item = ET.Element("item")
                ET.SubElement(item, "title").text = title + " - Example News"
                ET.SubElement(item, "link").text = "https://example.com/article"
                ET.SubElement(item, "source").text = "Example News"
                self.assertIsNone(updater.news_row(item, ""))

    def test_actual_earthquake_reports_and_research_are_kept(self):
        for title in [
            "Magnitude 6.2 earthquake strikes offshore Japan",
            "Earthquake as parliament debates aid for earthquake survivors",
            "Democrats call for earthquake relief funding",
            "Election delayed after earthquake",
            "New study maps an active fault",
            "Improving seismic networks and early warning",
            "Earthquake recovery needs $21 billion, UN says",
        ]:
            with self.subTest(title=title):
                self.assertTrue(updater.is_earthquake_headline(title))

    def test_stored_metaphors_are_removed_even_without_new_news(self):
        keep = {"id": "real", "title": "Magnitude 5 earthquake strikes Japan"}
        drop = {"id": "metaphor", "title": "A political earthquake changes parliament"}
        with patch.object(updater, "read_json", return_value={"items": [keep, drop]}), \
             patch.object(updater, "google_news", return_value=[]), \
             patch.object(updater, "fetch", return_value=None), \
             patch.object(updater, "write_json") as write:
            self.assertTrue(updater.refresh_news())
        saved = write.call_args.args[1]
        self.assertEqual(saved["items"], [keep])
        self.assertEqual(saved["count"], 1)


if __name__ == "__main__":
    unittest.main()
