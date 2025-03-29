from __future__ import annotations, division
import datetime
import json
import os
import time
import sys
from pathlib import Path
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
        self.year = year
    
    def add_division_info(self, division_id: DivisionId, division_json):
        di = DivisionInfo(division_id, division_json['div_name'])
        for team_json in division_json['teams']:
            di.team_names.append(team_json['name'])
        di.team_names.sort()
        self.id_to_division_info_dict[division_id] = di

    def __str__(self):
        return f"{str(self.id_to_division_info_dict)}"

    def __repr__(self):
        return str(self)

    @classmethod
    def get_metadata(cls, year: int, quiet: bool) -> MlbMetadata:
        # pick a day in the middle of the season (even in 2020)
        raw_data = get_raw_standings_data(datetime.date(year=year, month=8, day=1), quiet)
        metadata = cls(year)
        for division_id in raw_data:
            metadata.add_division_info(DivisionId(division_id), raw_data[division_id])
        metadata.year = year
        return metadata
    
    @classmethod
    def load_from_file(cls, year: int) -> Optional[MlbMetadata]:
        file_path = get_json_file_path(year)
        if not file_path.exists():
            return None
        try:
            with open(file_path, 'r') as f:
                j = json.load(f)
                metadata = cls(year)
                metadataJson = j['metadata']
                for division_id in metadataJson.keys():
                    divisionInfoJson = metadataJson[division_id]
                    divisionInfo = DivisionInfo(division_id, divisionInfoJson['name'])
                    divisionInfo.team_names = divisionInfoJson['teams']
                    metadata.id_to_division_info_dict[division_id] = divisionInfo
                return metadata
        except json.JSONDecodeError:
            return None


class TeamStanding:
    def __init__(self, team_id: Optional[TeamId], wins: int, losses: int):
        self.team_id = team_id
        self.wins = wins
        self.losses = losses
    
    def __str__(self):
        return f"{self.wins}-{self.losses}"

    def __repr__(self):
        return str(self)

    def eq(self, o: TeamStanding) -> bool:
        # don't worry about Nones
        if self.team_id is not None and o.team_id is not None and self.team_id != o.team_id:
            return False
        return self.wins == o.wins and self.losses == o.losses

def next_day(date: datetime.date) -> datetime.date:
    return datetime.date.fromordinal(date.toordinal() + 1)

def previous_day(date: datetime.date) -> datetime.date:
    return datetime.date.fromordinal(date.toordinal() - 1)

def data_is_empty(data: dict) -> bool:
    return len(data.keys()) == 0

def data_is_before_opening_day(data: dict) -> bool:
    if data_is_empty(data):
        return True
    # sometimes if you get data before opening day
    # you get the end of the season stats (like in 2005)
    first_division_id = list(data.keys())[0]
    first_team_data = data[first_division_id]['teams'][0]
    return first_team_data['w'] + first_team_data['l'] > 140

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

def get_json_file_path(year: int) -> Path:
    data_path = Path(os.path.realpath(__file__)).parent / "data"
    return data_path / f"{year}.json"

class MlbYearStandings:
    def __init__(self, metadata: MlbMetadata, quiet: bool):
        self.metadata = metadata
        self.quiet = quiet
        self.all_day_data : dict[datetime.date, dict[DivisionId, list[TeamStanding]]] = dict()
    
    def load_from_file(self):
        file_path = get_json_file_path(self.metadata.year)
        # if we're calling this we already know the file exists and is valid
        with open(file_path, 'r') as f:
            j = json.load(f)
            current_day = datetime.datetime.strptime(j['opening_day'], "%Y/%m/%d").date()
            for entry in j['standings']:
                day_data : dict[DivisionId, list[TeamStanding]] = {}
                for division_id in entry:
                    standings = [TeamStanding(None, wl[0], wl[1]) for wl in entry[division_id]]
                    day_data[DivisionId(int(division_id))] = standings
                self.all_day_data[current_day] = day_data
                current_day = next_day(current_day)

    def populate(self):
        if len(self.all_day_data) == 0:
            # first, find opening day
            opening_day = self._get_opening_day()
            if not self.quiet:
                print(f"Opening day is {opening_day}")
            self._add_before_opening_day_data(previous_day(opening_day))
            self._get_all_data(opening_day)
        else:
            # get all data starting at last day (because it might be out of date if more games happened)
            all_days = sorted(self.all_day_data.keys())
            last_day = all_days[-1]
            self._get_all_data(last_day)

    def write_to_json(self):
        file_path = get_json_file_path(self.metadata.year)
        os.makedirs(file_path.parent, exist_ok=True)
        j = {}
        j['metadata'] = { k: {"name": self.metadata.id_to_division_info_dict[k].name,
                              "teams": self.metadata.id_to_division_info_dict[k].team_names} for k in sorted(self.metadata.id_to_division_info_dict)}
        all_days = sorted(self.all_day_data.keys())
        opening_day = all_days[0]
        j['opening_day'] = opening_day.strftime("%Y/%m/%d")
        def day_data_to_json(day_data: dict[DivisionId, list[TeamStanding]]) -> dict:
            return {k:[[standing.wins, standing.losses] for standing in day_data[k]] for k in sorted(day_data.keys())}
        j['standings'] = [day_data_to_json(self.all_day_data[day]) for day in all_days]

        with open(file_path, 'w') as f:
            f.write(json.dumps(j))

    def _get_all_data(self, start_day: datetime.date, force_update: bool = False):
        current_day = start_day
        previous_day_data = []
        while True:
            if current_day >= datetime.date.today():
                return
            if current_day not in self.all_day_data or force_update:
                data = get_raw_standings_data(current_day, self.quiet)
                if not data_is_empty(data):
                    self._store_day_data(current_day, data)
                else:
                    return
            current_day_data = self.all_day_data[current_day]
            # need to look back at previous 10 days of data
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
        opening_day_data = get_raw_standings_data(opening_day_attempt, self.quiet)
        if not data_is_before_opening_day(opening_day_data):
            opening_day = self._search_backward_for_opening_day(opening_day_attempt, opening_day_data)
        else:
            opening_day = self._search_forward_for_opening_day(opening_day_attempt, opening_day_data)
        return opening_day

    def _search_backward_for_opening_day(self, opening_day_attempt: datetime.date, opening_day_data) -> datetime.date:
        while not data_is_before_opening_day(opening_day_data):
            if opening_day_attempt < datetime.date.today():
                self._store_day_data(opening_day_attempt, opening_day_data)
            opening_day_attempt = previous_day(opening_day_attempt)
            opening_day_data = get_raw_standings_data(opening_day_attempt, self.quiet)
        return next_day(opening_day_attempt)
    
    def _search_forward_for_opening_day(self, opening_day_attempt: datetime.date, opening_day_data) -> datetime.date:
        while data_is_before_opening_day(opening_day_data):
            opening_day_attempt = next_day(opening_day_attempt)
            opening_day_data = get_raw_standings_data(opening_day_attempt, self.quiet)
        self._store_day_data(opening_day_attempt, opening_day_data)
        return opening_day_attempt
    
    def _store_day_data(self, date: datetime.date, data: dict):
        days_stored_data : dict[DivisionId, list[TeamStanding]] = dict()
        for division_id in data:
            division_stored_data : list[tuple[str, TeamStanding]] = list()
            teams = data[division_id]['teams']
            all_teams = set(self.metadata.id_to_division_info_dict[division_id].team_names)
            for team in teams:
                division_stored_data.append((team['name'], TeamStanding(TeamId(team['team_id']), team['w'], team['l'])))
                all_teams.remove(team['name'])
            for unknown_team in all_teams:
                print(f"Missing team {unknown_team} for date {date}")
                division_stored_data.append((unknown_team, None))
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

    def validate_and_fix_data(self, already_fixed_beginning=False, is_update=False) -> bool:
        all_days = sorted(self.all_day_data.keys())
        opening_day = all_days[0]
        opening_day_data = self.all_day_data[opening_day]
        for division_id in opening_day_data:
            division_data = opening_day_data[division_id]
            if max([ts.wins + ts.losses for ts in division_data]) > 0:
                print(f"WARNING - opening_day {opening_day} has games played already: {division_data}")
                return False
        yesterday_data = opening_day_data
        for today in all_days[1:]:
            today_data = self.all_day_data[today]
            for division_id in yesterday_data:
                if division_id not in today_data:
                    print(f"No data for division {division_id} on {today}, just going to copy from yesterday")
                    today_data[division_id] = yesterday_data[division_id]
            for division_id in today_data:
                today_division_data = today_data[division_id]
                if division_id not in yesterday_data:
                    print(f"No data for division {division_id} the day before {today}, skipping validation")
                    continue
                yesterday_division_data = yesterday_data[division_id]
                if len(today_division_data) != len(yesterday_division_data):
                    print(f"Mismatched division size - today {today} division_id {division_id} , today_division_data {today_division_data} yesterday_division_data {yesterday_division_data}: trying to fix")
                    if len(today_division_data) < len(yesterday_division_data):
                        while len(today_division_data) < len(yesterday_division_data):
                            today_division_data.append(yesterday_division_data[len(today_division_data)])
                        print(f"Adjusted to {today_division_data}")
                    else:
                        print("Couldn't fix")
                        return False
                index = 0
                for (today_ts, yesterday_ts) in zip(today_division_data, yesterday_division_data):
                    if today_ts is None:
                        print(f"Missing data for team on {today}, fixing")
                        today_ts = TeamStanding(yesterday_ts.team_id, yesterday_ts.wins, yesterday_ts.losses)
                        today_division_data[index] = today_ts
                    if today_ts.team_id != yesterday_ts.team_id:
                        if not (is_update and (yesterday_ts.team_id is None or today_ts.team_id is None)):
                            print(f"Team IDs out of order - today {today} today_division_data {today_division_data} yesterday_division_data {yesterday_division_data}")
                            return False
                    game_diff = (today_ts.wins + today_ts.losses) - (yesterday_ts.wins + yesterday_ts.losses)
                    if game_diff > 2:
                        print(f"Jump in games played on {today} in {division_id} from {yesterday_ts} to {today_ts}! Attempting to fix.")
                        if yesterday_ts.wins == 0 and yesterday_ts.losses == 0:
                            if not already_fixed_beginning:
                                print(f"Weirdness is at beginning; trying to fix")
                                self.all_day_data[today] = self.all_day_data[previous_day(today)]
                                del self.all_day_data[previous_day(today)]
                                return self.validate_and_fix_data(already_fixed_beginning=True)
                            else:
                                print(f"Weirdness is at beginning but already tried to fix it; going to uneasily continue on")
                        else:
                            print(f"Nope, can't figure it out")
                            return False
                    if today_ts.wins < yesterday_ts.wins or today_ts.losses < yesterday_ts.losses:
                        print(f"Wins/losses went down on {today} in {division_id} from {yesterday_ts} to {today_ts}! Attempting to fix.")
                        if today_ts.wins - yesterday_ts.wins < -1:
                            print(f"Can't fix - wins drop too much!")
                            return False
                        elif today_ts.wins - yesterday_ts.wins == -1:
                            print(f"Resetting wins")
                            yesterday_ts.wins = today_ts.wins
                        if today_ts.losses - yesterday_ts.losses < -1:
                            print(f"Can't fix - losses drop too much!")
                            return False
                        elif today_ts.losses - yesterday_ts.losses == -1:
                            print(f"Resetting losses")
                            yesterday_ts.losses = today_ts.losses
                    index = index + 1
            yesterday_data = today_data
        if self.metadata.year != datetime.date.today().year:
            last_day_data = self.all_day_data[all_days[-1]]
            total_games = [[ts.wins + ts.losses for ts in last_day_data[division_id]] for division_id in last_day_data]
            flattened_total_games = [item for sublist in total_games for item in sublist]
            # can be game 163 for tiebreaker, etc.
            if max(flattened_total_games) - min(flattened_total_games) > 2:
                print(f"Mismatched number of games played! {flattened_total_games}")
                return False
        return True

    def __str__(self):
        s = f"{self.metadata}\n\n"
        for day in sorted(self.all_day_data.keys()):
            s += f"{day}:  " + str(self.all_day_data[day]) + "\n"
        return s

    def __repr__(self):
        return str(self)


def get_raw_standings_data(date: datetime.date, quiet: bool) -> dict:
    date_str = date.strftime('%m/%d/%Y')
    if not quiet:
        print(f"getting for {date_str}")
    # throttle
    time.sleep(0.3)
    standings : dict = statsapi.standings_data(leagueId="103,104", date=date_str)
    return standings

#standings = statsapi.standings_data(leagueId="103,104", date="06/19/2021")
#print(standings)
#standings = get_raw_standings_data(datetime.date(year=2021, month=7, day=18))
#print(standings)

#import pprint
#pp = pprint.PrettyPrinter(indent=2)
#pp.pprint(get_raw_standings_data(datetime.date(year=2005, month=4, day=3)))
#sys.exit(1)

if __name__ == '__main__':
    year = datetime.date.today().year
    update = False
    if len(sys.argv) > 1:
        if sys.argv[1] == '-u':
            update = True
            if len(sys.argv) > 2:
                year = int(sys.argv[2])
        else:
            year = int(sys.argv[1])
    import pprint
    pp = pprint.PrettyPrinter(indent=2)
    m = None
    if update:
        m = MlbMetadata.load_from_file(year)
    #pp.pprint(m)
    if m is None:
        update = False
        m = MlbMetadata.get_metadata(year, quiet=update)
    #sys.exit(1)
    s = MlbYearStandings(m, quiet=update)
    if update:
        s.load_from_file()
    s.populate()
    validated = s.validate_and_fix_data(is_update=update)
    if not validated:
        print("--------------")
        print("FAILED to validate data, writing anyway")
    s.write_to_json()
    #pp.pprint(s)
