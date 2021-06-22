import statsapi

standings = statsapi.standings_data(leagueId="103,104", date="06/19/2021")
print(standings)