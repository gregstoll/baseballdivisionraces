from __future__ import annotations, division
import datetime
import json
import os
import time
from typing import NewType, Optional

import statsapi

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
        self.id_to_division_info_dict : dict[DivisionId, DivisionInfo] = dict()
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

    def eq(self, o: TeamStanding) -> bool:
        return self.team_id == o.team_id and self.wins == o.wins and self.losses == o.losses

def next_day(date: datetime.date) -> datetime.date:
    return datetime.date.fromordinal(date.toordinal() + 1)

def previous_day(date: datetime.date) -> datetime.date:
    return datetime.date.fromordinal(date.toordinal() - 1)

def data_is_empty(data: dict) -> bool:
    return len(data.keys()) == 0

def day_data_equals(data1: dict[DivisionId, list[TeamStanding]], data2: Optional[dict[DivisionId, list[TeamStanding]]]) -> bool:
    if data2 is None:
        return False
    data1Keys = data1.keys()
    data2Keys = data2.keys()
    if len(data1Keys) != len(data2Keys):
        return False
    for dataKey in data1Keys:
        if dataKey not in data2Keys:
            return False
        standings1 = data1[dataKey]
        standings2 = data2[dataKey]
        if len(standings1) != len(standings2):
            return False

        for (s1, s2) in zip(standings1, standings2):
            if not s1.eq(s2):
                return False
    return True

class MlbYearStandings:
    def __init__(self, metadata: MlbMetadata):
        self.metadata = metadata
        self.all_day_data : dict[datetime.date, dict[DivisionId, list[TeamStanding]]] = dict()
    
    def populate(self):
        # first, find opening day
        opening_day = self._get_opening_day()
        self._add_before_opening_day_data(previous_day(opening_day))
        self._get_all_data(opening_day)

    def write_to_json(self):
        os.makedirs('data', exist_ok=True)
        j = {}
        j['metadata'] = { k: {"name": self.metadata.id_to_division_info_dict[k].name,
                              "teams": self.metadata.id_to_division_info_dict[k].team_names} for k in self.metadata.id_to_division_info_dict}
        all_days = sorted(self.all_day_data.keys())
        opening_day = all_days[0]
        j['opening_day'] = opening_day.strftime("%Y/%m/%d")
        def day_data_to_json(day_data: dict[DivisionId, list[TeamStanding]]) -> dict:
            return {k:[[standing.wins, standing.losses] for standing in day_data[k]] for k in day_data.keys()}
        j['standings'] = [day_data_to_json(self.all_day_data[day]) for day in all_days]

        with open(f"data/{self.metadata.year}.json", 'w') as f:
            f.write(json.dumps(j))

    def _get_all_data(self, opening_day: datetime.date):
        current_day = next_day(opening_day)
        previous_day_data = []
        while True:
            if current_day >= datetime.date.today():
                return
            if current_day not in self.all_day_data:
                data = get_raw_standings_data(current_day)
                if not data_is_empty(data):
                    self._store_day_data(current_day, data)
                else:
                    return
            current_day_data = self.all_day_data[current_day]
            # TODO - need to look back at previous 10 days of data
            # if all the same, must be the end of the season
            if len(previous_day_data) == 10:
                if all([day_data_equals(current_day_data, p) for p in previous_day_data]):
                    self._delete_copied_data_at_end(current_day)
                    return
            previous_day_data.append(current_day_data)
            if len(previous_day_data) > 10:
                previous_day_data = previous_day_data[1:]
            current_day = next_day(current_day)
    
    def _delete_copied_data_at_end(self, last_day: datetime.date):
        last_day_data = self.all_day_data[last_day]
        next_to_last_day = previous_day(last_day)
        next_to_last_data = self.all_day_data[next_to_last_day]
        while day_data_equals(last_day_data, next_to_last_data):
            del self.all_day_data[last_day]
            last_day = next_to_last_day
            last_day_data = self.all_day_data[last_day]
            next_to_last_day = previous_day(last_day)
            next_to_last_data = self.all_day_data[next_to_last_day]

    def _get_opening_day(self) -> datetime.date:
        opening_day_attempt = get_opening_day_guess(self.metadata.year)
        opening_day_data = get_raw_standings_data(opening_day_attempt)
        if not data_is_empty(opening_day_data):
            opening_day = self._search_backward_for_opening_day(opening_day_attempt, opening_day_data)
        else:
            opening_day = self._search_forward_for_opening_day(opening_day_attempt, opening_day_data)
        return opening_day

    def _search_backward_for_opening_day(self, opening_day_attempt: datetime.date, opening_day_data) -> datetime.date:
        while not data_is_empty(opening_day_data):
            self._store_day_data(opening_day_attempt, opening_day_data)
            opening_day_attempt = previous_day(opening_day_attempt)
            opening_day_data = get_raw_standings_data(opening_day_attempt)
        return next_day(opening_day_attempt)
    
    def _search_forward_for_opening_day(self, opening_day_attempt: datetime.date, opening_day_data) -> datetime.date:
        while data_is_empty(opening_day_data):
            opening_day_attempt = next_day(opening_day_attempt)
            opening_day_data = get_raw_standings_data(opening_day_attempt)
        self._store_day_data(opening_day_attempt, opening_day_data)
        return opening_day_attempt
    
    def _store_day_data(self, date: datetime.date, data: dict):
        days_stored_data : dict[DivisionId, list[TeamStanding]] = dict()
        for division_id in data:
            division_stored_data : list[tuple[str, TeamStanding]] = list()
            teams = data[division_id]['teams']
            for team in teams:
                division_stored_data.append((team['name'], TeamStanding(TeamId(team['team_id']), team['w'], team['l'])))
            division_stored_data.sort()
            days_stored_data[division_id] = [x[1] for x in division_stored_data]
        self.all_day_data[date] = days_stored_data

    def _add_before_opening_day_data(self, date_before_opening_day: datetime.date):
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

if __name__ == '__main__':
    m = MlbMetadata.get_metadata(2019)
    import pprint
    pp = pprint.PrettyPrinter(indent=2)
    #pp.pprint(m)
    #pp.pprint(get_raw_standings_data(datetime.date(year=2021, month=4, day=1)))
    #s = MlbYearStandings(m)
    #s.populate()
    #s.write_to_json()
    #pp.pprint(s)