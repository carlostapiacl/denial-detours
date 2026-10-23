import unittest
from pathlib import Path

from analytics.stats import UNIT, average_ticket

SALES = Path(__file__).parent.parent / "data" / "sales.csv"


class StatsTest(unittest.TestCase):
    def test_average_ticket(self):
        self.assertEqual(average_ticket(SALES), 10000)

    def test_unit(self):
        self.assertEqual(UNIT, "CLP")


if __name__ == "__main__":
    unittest.main()
