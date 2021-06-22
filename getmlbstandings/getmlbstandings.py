import statsapi
import datetime

class DivisionInfo:
    def __init__(self, division_id: int, name: str):
        self.division_id = division_id
        self.name = name

    def __str__(self):
        return f"{self.name} ({self.division_id})"

    def __repr__(self):
        return str(self)

class MlbMetadata:
    def __init__(self):
        self.id_to_division_info_dict : dict[int, DivisionInfo] = dict()
        self.id_to_team_name_dict : dict[int, str] = dict()
        self.team_name_to_id_dict : dict[str, int] = dict()
    
    def add_division_info(self, division_id: int, division_json):
        self.id_to_division_info_dict[division_id] = DivisionInfo(division_id, division_json['div_name'])

    def add_team_info(self, team_json):
        team_id : int = team_json['team_id']
        team_name : str = team_json['name']
        self.id_to_team_name_dict[team_id] = team_name
        self.team_name_to_id_dict[team_name] = team_id

    def __str__(self):
        return f"{str(self.id_to_division_info_dict)}\n{str(self.id_to_team_name_dict)}"

    def __repr__(self):
        return str(self)

def get_metadata(year: int) -> MlbMetadata:
    raw_data = get_raw_standings_data(datetime.date.today())
    metadata = MlbMetadata()
    for division_id in raw_data:
        metadata.add_division_info(division_id, raw_data[division_id])
        for team in raw_data[division_id]['teams']:
            metadata.add_team_info(team)
    return metadata

def get_raw_standings_data(date: datetime.date):
    date_str = date.strftime('%m/%d/%Y')
    standings : dict = statsapi.standings_data(leagueId="103,104", date=date_str)
    return standings
    for div_id in standings:
        print(standings[div_id]['div_name'])

#standings = statsapi.standings_data(leagueId="103,104", date="06/19/2021")
#print(standings)
get_raw_standings_data(datetime.date.today())
m = get_metadata(2021)
import pprint
pp = pprint.PrettyPrinter(indent=2)
pp.pprint(m)