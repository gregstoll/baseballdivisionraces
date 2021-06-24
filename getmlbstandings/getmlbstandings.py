from __future__ import annotations, division
import statsapi
import datetime
import time
from typing import NewType, Optional

def get_opening_day_guess(year: int) -> datetime.date:
    if year == 2020:
        return datetime.date(year=year, month=7, day=20)
    else:
        return datetime.date(year=year, month=4, day=1)

DivisionId = NewType('DivisionId', int)
TeamId = NewType('TeamId', int)

class DivisionInfo:
    def __init__(self, division_id: DivisionId, name: str):
        self.division_id = division_id
        self.name = name
        self.team_names : list[str] = []

    def __str__(self):
        return f"{self.name} ({self.division_id}) with teams: {self.team_names}"

    def __repr__(self):
        return str(self)

class MlbMetadata:
    def __init__(self, year: int):
        self.id_to_division_info_dict : dict[int, DivisionInfo] = dict()
        self.id_to_team_name_dict : dict[TeamId, str] = dict()
        self.team_name_to_id_dict : dict[str, TeamId] = dict()
        self.year = year
    
    def add_division_info(self, division_id: DivisionId, division_json):
        di = DivisionInfo(division_id, division_json['div_name'])
        for team_json in division_json['teams']:
            di.team_names.append(team_json['name'])
            self.add_team_info(team_json)
        di.team_names.sort()
        self.id_to_division_info_dict[division_id] = di

    def add_team_info(self, team_json):
        team_id = TeamId(team_json['team_id'])
        team_name : str = team_json['name']
        self.id_to_team_name_dict[team_id] = team_name
        self.team_name_to_id_dict[team_name] = team_id

    def __str__(self):
        return f"{str(self.id_to_division_info_dict)}\n{str(self.id_to_team_name_dict)}"

    def __repr__(self):
        return str(self)

    @classmethod
    def get_metadata(cls, year: int) -> MlbMetadata:
        # pick a day in the middle of the season (even in 2020)
        raw_data = get_raw_standings_data(datetime.date(year=year, month=8, day=1))
        metadata = cls(year)
        for division_id in raw_data:
            metadata.add_division_info(DivisionId(division_id), raw_data[division_id])
        metadata.year = year
        return metadata

class TeamStanding:
    def __init__(self, team_id: TeamId, wins: int, losses: int):
        self.team_id = team_id
        self.wins = wins
        self.losses = losses
    
    def __str__(self):
        return f"{self.wins}-{self.losses}"

    def __repr__(self):
        return str(self)

def next_day(date: datetime.date) -> datetime.date:
    return datetime.date.fromordinal(date.toordinal() + 1)

def previous_day(date: datetime.date) -> datetime.date:
    return datetime.date.fromordinal(date.toordinal() - 1)

def data_is_empty(data: dict) -> bool:
    return len(data.keys()) == 0

class MlbYearStandings:
    def __init__(self, metadata: MlbMetadata):
        self.metadata = metadata
        self.all_day_data : dict[datetime.date, dict[DivisionId, list[TeamStanding]]] = dict()
    
    def populate(self):
        # first, find opening day
        opening_day = self.get_opening_day()
        self.add_before_opening_day_data(previous_day(opening_day))
        self._get_all_data(opening_day)

    def _get_all_data(self, opening_day: datetime.date):
        current_day = next_day(opening_day)
        while True:
            if current_day >= datetime.date.today():
                return
            if current_day not in self.all_day_data:
                data = get_raw_standings_data(current_day)
                if not data_is_empty(data):
                    self.store_day_data(current_day, data)
                else:
                    return
            current_day = next_day(current_day)

    def get_opening_day(self) -> datetime.date:
        opening_day_attempt = get_opening_day_guess(self.metadata.year)
        opening_day_data = get_raw_standings_data(opening_day_attempt)
        if not data_is_empty(opening_day_data):
            opening_day = self.search_backward_for_opening_day(opening_day_attempt, opening_day_data)
        else:
            opening_day = self.search_forward_for_opening_day(opening_day_attempt, opening_day_data)
        return opening_day

    def search_backward_for_opening_day(self, opening_day_attempt: datetime.date, opening_day_data) -> datetime.date:
        while not data_is_empty(opening_day_data):
            self.store_day_data(opening_day_attempt, opening_day_data)
            opening_day_attempt = previous_day(opening_day_attempt)
            opening_day_data = get_raw_standings_data(opening_day_attempt)
        return next_day(opening_day_attempt)
    
    def search_forward_for_opening_day(self, opening_day_attempt: datetime.date, opening_day_data) -> datetime.date:
        while data_is_empty(opening_day_data):
            opening_day_attempt = next_day(opening_day_attempt)
            opening_day_data = get_raw_standings_data(opening_day_attempt)
        self.store_day_data(opening_day_attempt, opening_day_data)
        return opening_day_attempt
    
    def store_day_data(self, date: datetime.date, data: dict):
        days_stored_data : dict[DivisionId, list[TeamStanding]] = dict()
        for division_id in data:
            division_stored_data : list[tuple[str, TeamStanding]] = list()
            teams = data[division_id]['teams']
            for team in teams:
                division_stored_data.append((team['name'], TeamStanding(TeamId(team['team_id']), team['w'], team['l'])))
            division_stored_data.sort()
            days_stored_data[division_id] = [x[1] for x in division_stored_data]
        self.all_day_data[date] = days_stored_data

    def add_before_opening_day_data(self, date_before_opening_day: datetime.date):
        opening_day_data = self.all_day_data[next_day(date_before_opening_day)]
        before_opening_day_data : dict[DivisionId, list[TeamStanding]] = dict()
        for division_id in opening_day_data:
            division_data = [TeamStanding(x.team_id, 0, 0) for x in opening_day_data[division_id]]
            before_opening_day_data[division_id] = division_data
        self.all_day_data[date_before_opening_day] = before_opening_day_data

    def __str__(self):
        s = f"{self.metadata}\n\n"
        for day in sorted(self.all_day_data.keys()):
            s += f"{day}:  " + str(self.all_day_data[day]) + "\n"
        return s

    def __repr__(self):
        return str(self)


def get_raw_standings_data(date: datetime.date) -> dict:
    date_str = date.strftime('%m/%d/%Y')
    print(f"getting for {date_str}")
    # throttle
    time.sleep(0.5)
    standings : dict = statsapi.standings_data(leagueId="103,104", date=date_str)
    return standings

#standings = statsapi.standings_data(leagueId="103,104", date="06/19/2021")
#print(standings)
#standings = get_raw_standings_data(datetime.date(year=2021, month=7, day=18))
#print(standings)

m = MlbMetadata.get_metadata(2021)
import pprint
pp = pprint.PrettyPrinter(indent=2)
#pp.pprint(m)
#pp.pprint(get_raw_standings_data(datetime.date(year=2021, month=4, day=1)))
s = MlbYearStandings(m)
s.populate()
pp.pprint(s)