"""Classifier response validation; no database or model calls."""
import json
import sys
import unittest
from unittest.mock import MagicMock, patch

try:
    import psycopg2  # noqa: F401
except ImportError:
    sys.modules['psycopg2'] = MagicMock()
import luna_iggys_bridge as bridge


class ClassificationTests(unittest.TestCase):
    def classify(self, verdict):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.rowcount = 1
        rows = [(1, 'Guest', 'guest@example.com', 'Subject', 'Body')]
        with patch.object(bridge, 'ask_luna', return_value=json.dumps([{'id': 1, **verdict}])), patch.object(bridge, 'log'):
            bridge.classify_batch(connection, rows)
        return cursor.execute.call_args.args

    def test_string_false_does_not_mean_true(self):
        _, params = self.classify({'importance': 'high', 'category': 'inquiry', 'needs_reply': 'false'})
        self.assertEqual(params[:3], ('normal', 'inquiry', False))

    def test_sales_pitch_cannot_be_an_urgent_reply(self):
        _, params = self.classify({'importance': 'high', 'category': 'solicitation', 'needs_reply': True})
        self.assertEqual(params[:3], ('normal', 'solicitation', False))

    def test_preserves_manual_corrections_and_existing_metadata(self):
        sql, params = self.classify({'category': 'entertainment', 'needs_reply': True})
        self.assertIn("luna_classification->>'by', '') <> 'manager'", sql)
        self.assertIn("coalesce(luna_classification, '{}'::jsonb) ||", sql)
        self.assertEqual(params[:3], ('high', 'entertainment', True))


if __name__ == '__main__':
    unittest.main()
