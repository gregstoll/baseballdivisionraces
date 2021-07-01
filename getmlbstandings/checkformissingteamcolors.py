import json
import os
import sys

if __name__ == '__main__':
    teamNames = set()
    for fileName in os.listdir('data'):
        if fileName.endswith(".json"):
            with open('data/' + fileName, 'r') as file:
                data_json = json.load(file)
                for divisionId in data_json['metadata'].keys():
                    teamNames.update(data_json['metadata'][divisionId]['teams'])
    
    print(teamNames)
    with open('../showdivisionraces/src/app.ts', 'r') as file:
        lines = file.readlines()
        for teamName in teamNames:
            searchString = f'"{teamName}"'
            if len([line for line in lines if searchString in line]) == 0:
                print(f"MISSING TEAM: {teamName}")