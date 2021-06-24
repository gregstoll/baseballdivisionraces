import datetime
import unittest
from getmlbstandings import *

class TestUtilityMethods(unittest.TestCase):
    def test_previousday_lastdayofmonth(self):
        self.assertEqual(previous_day(datetime.date(year=2021, month=6, day=30)), datetime.date(year=2021, month=6, day=29))

    def test_previousday_firstdayofmonth(self):
        self.assertEqual(previous_day(datetime.date(year=2021, month=6, day=1)), datetime.date(year=2021, month=5, day=31))

    def test_previousday_middledayofmonth(self):
        self.assertEqual(previous_day(datetime.date(year=2021, month=6, day=15)), datetime.date(year=2021, month=6, day=14))

    def test_nextday_lastdayofmonth(self):
        self.assertEqual(next_day(datetime.date(year=2021, month=6, day=30)), datetime.date(year=2021, month=7, day=1))

    def test_nextday_firstdayofmonth(self):
        self.assertEqual(next_day(datetime.date(year=2021, month=6, day=1)), datetime.date(year=2021, month=6, day=2))

    def test_nextday_middledayofmonth(self):
        self.assertEqual(next_day(datetime.date(year=2021, month=6, day=15)), datetime.date(year=2021, month=6, day=16))



if __name__ == '__main__':
    unittest.main()