import Plotly from 'plotly.js-basic-dist-min';

const MIN_YEAR = 1995;
const MAX_YEAR = 2025;

function next_day(d: Date) : Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}
function prev_day(d: Date) : Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
}

class TeamColors {
    _light: string;
    _dark: string;

    constructor(light: string, dark: string|undefined = undefined) {
        this._light = light;
        this._dark = dark ?? light;
    }
    // Color used in light mode
    get light() { 
        return this._light;
    }
    // Color used in dark mode
    get dark() { 
        return this._dark;
    }
}

const TEAM_NAMES_TO_COLORS : Map<string, TeamColors> = new Map([
    ["Houston Astros", new TeamColors("#eb6e1f")],
    ["Athletics", new TeamColors("#003831", "#efb21e")],
    // Lighten #005c5c to #00a0a0
    ["Seattle Mariners", new TeamColors("#00a0a0", "#005c5c")],
    ["Los Angeles Angels", new TeamColors("#862633")],
    ["Texas Rangers", new TeamColors("#c0111f")],

    // NYY blue #134a8e is too close to Blue Jays, use black for pinstripes
    ["New York Yankees", new TeamColors("#000000", "#c4ced3")],
    ["Baltimore Orioles", new TeamColors("#df4601")],
    // Lighten #134a8e to #1d71d9
    ["Toronto Blue Jays", new TeamColors("#134a8e", "#1d71d9")],
    ["Tampa Bay Rays", new TeamColors("#f5d130")],
    ["Boston Red Sox", new TeamColors("#bd3039")],

    // Darken #c4ced4 to #9dadb7
    ["Chicago White Sox", new TeamColors("#9dadb7", "#c4ced4")],
    ["Cleveland Guardians", new TeamColors("#e31937")],
    ["Detroit Tigers", new TeamColors("#f26722")],
    ["Kansas City Royals", new TeamColors("#7bb2dd")],
    ["Minnesota Twins", new TeamColors("#002b5c", "#cfac7a")],

    ["San Francisco Giants", new TeamColors("#fd5a1e")],
    ["Los Angeles Dodgers", new TeamColors("#005a9c")],
    ["San Diego Padres", new TeamColors("#847464", "#5c666f")],
    ["Colorado Rockies", new TeamColors("#33006f", "#c4ced4")],
    ["Arizona Diamondbacks", new TeamColors("#a71930")],

    // Lighten #002d72 to #005ce9
    ["New York Mets", new TeamColors("#002d72", "#005ce9")],
    ["Washington Nationals", new TeamColors("#ab0003")],
    ["Atlanta Braves", new TeamColors("#eaaa00")],
    ["Philadelphia Phillies", new TeamColors("#e81828", "#284898")],
    ["Miami Marlins", new TeamColors("#ff6600")],

    ["Milwaukee Brewers", new TeamColors("#b6922e")],
    // Lighten #0e3386 to #1650d3
    ["Chicago Cubs", new TeamColors("#1650d3")],
    ["Cincinnati Reds", new TeamColors("#c6011f")],
    // Lighten #c41e3a to #e03552
    ["St. Louis Cardinals", new TeamColors("#e03552", "#e03552")],
    ["Pittsburgh Pirates", new TeamColors("#000000", "#fdb827")]
]);
TEAM_NAMES_TO_COLORS.set("Cleveland Indians", TEAM_NAMES_TO_COLORS.get("Cleveland Guardians"));
TEAM_NAMES_TO_COLORS.set("California Angels", TEAM_NAMES_TO_COLORS.get("Los Angeles Angels"));
TEAM_NAMES_TO_COLORS.set("Anaheim Angels", TEAM_NAMES_TO_COLORS.get("Los Angeles Angels"));
TEAM_NAMES_TO_COLORS.set("Tampa Bay Devil Rays", TEAM_NAMES_TO_COLORS.get("Tampa Bay Rays"));
TEAM_NAMES_TO_COLORS.set("Florida Marlins", TEAM_NAMES_TO_COLORS.get("Miami Marlins"));
TEAM_NAMES_TO_COLORS.set("Montreal Expos", TEAM_NAMES_TO_COLORS.get("Washington Nationals"));
TEAM_NAMES_TO_COLORS.set("Oakland Athletics", TEAM_NAMES_TO_COLORS.get("Athletics"));

TEAM_NAMES_TO_COLORS.set("2025 Rockies", TEAM_NAMES_TO_COLORS.get("Colorado Rockies"));
TEAM_NAMES_TO_COLORS.set("2024 White Sox", TEAM_NAMES_TO_COLORS.get("Chicago White Sox"));
// Irritatingly these two teams have very similar dark colors
let rockies = TEAM_NAMES_TO_COLORS.get("2025 Rockies");
rockies = new TeamColors(rockies.light, "#87629d");
TEAM_NAMES_TO_COLORS.set("2025 Rockies", rockies);
// Returns the plots in reverse order so team plots with a better record get drawn
// on top of team plots with a worse record.
// Callers must set legend.traceorder to "reversed" to reverse the order the plots
// show up in the legend.
function get_plot_datas(all_standings: Array<Array<number[]>>, team_names: string[], date_values: Date[]) : any[] {
    let plot_datas = [];
    const isDark = isDarkMode();
    const division_leader_games_above_500 = get_division_leader_games_over_500(all_standings);
    for (let i = 0; i < team_names.length; ++i) {
        const team_standings = all_standings.map(x => x[i]).filter(v => v !== undefined);
        const games_above_500 = team_standings.map(x => x[0] - x[1]);
        const hover_texts = team_standings.map((x, i) => `${x[0]}-${x[1]}\n${get_games_back_string(x, division_leader_games_above_500[i])}`);
        const team_colors = useTeamColors ? TEAM_NAMES_TO_COLORS.get(team_names[i]) : null;
        let team_date_values = date_values.slice(0, games_above_500.length);
        plot_datas.push({
            x: team_date_values,
            y: games_above_500,
            text: hover_texts,
            hoverinfo: "text+x",
            name: team_names[i],
            line: {
                color: isDark ? team_colors?.dark : team_colors?.light,
                width: 2
            }
        });
    }
    plot_datas.sort((data1, data2) => data2.y[data2.y.length - 1] - data1.y[data1.y.length - 1]);
    plot_datas.reverse();
    return plot_datas;
}

function get_games_back_string(team_standing: number[], leader_games_above_500: number): string {
    if (leader_games_above_500 === undefined) {
        return "";
    }
    const games_back = leader_games_above_500 - (team_standing[0] - team_standing[1]);
    return games_back === 0 ? "-" : `${games_back/2} GB`;
}

function get_division_leader_games_over_500(all_standings: Array<Array<number[]>>): number[] {
    const day_indices = Array.from(new Array(all_standings.length).keys());
    // TODO - check max length of all standings
    const team_indices = Array.from(new Array(all_standings[0].length).keys());
    return day_indices.map(i => Math.max(...team_indices.map(t => {
        if (t < all_standings[i].length) {
            return all_standings[i][t][0] - all_standings[i][t][1];
        }
        return undefined;
    }).filter(x => x !== undefined)));
}

function get_division_name_sort_key(division_name: string): number {
    let key = 0;
    // AL before NL, then West, Central, East
    if (division_name.indexOf("National League") >= 0) {
        key += 100;
    }
    if (division_name.indexOf("Central") >= 0) {
        key += 1;
    }
    if (division_name.indexOf("East") >= 0) {
        key += 2;
    }
    return key;
}

function addChart(title: string, subtitle: string | undefined, team_names: string[], all_standings: Array<Array<number[]>>, opening_day: Date, multiyear?: boolean) {
    const isDark = isDarkMode();
    const astros_standings = all_standings.map(x => x[0]);
    let date_values : Date[] = [opening_day];
    while (date_values.length < astros_standings.length) {
        date_values.push(next_day(date_values[date_values.length - 1]))
    }
    const plot_datas = get_plot_datas(all_standings, team_names, date_values);
    const chartSection = document.getElementById("charts");
    let targetDiv = document.createElement('div');
    targetDiv.className = "chart";
    chartSection.appendChild(targetDiv);
    const lots_of_teams = team_names.length >= 10;

    const DARK_TEXT_COLOR = "#111111";
    const LIGHT_TEXT_COLOR = "#eeeeee";
    let textColor = isDark ? LIGHT_TEXT_COLOR : DARK_TEXT_COLOR;
    let plotOptions = {
        title: {
            text: title,
            font: {
                color: textColor
            }
        },
        legend: {
            font: {
                color: textColor
            },
            traceorder: "reversed"
        },
        xaxis: {
            color: textColor
        },
        yaxis: {
            color: textColor
        },
        hovermode: "x",
        paper_bgcolor: isDark ? "#262626" : "#e6e6e6",
        plot_bgcolor: isDark ? "#262626" : "#e6e6e6",
        height: lots_of_teams ? 500 : 450
    };
    
    if (multiyear) {
        plotOptions.xaxis['tickformat'] = '%b %d';
    }
    if (subtitle) {
        plotOptions.title.text = plotOptions.title.text + `<br><sup>${subtitle}</sup>`;
    }
 
    Plotly.newPlot(targetDiv, plot_datas, plotOptions, {responsive: true});
}

function addLeagueChart(raw_data: any, league_name: string|undefined, opening_day: Date) {
    const league_division_ids = Object.keys(raw_data.metadata).filter(x => league_name === undefined || raw_data.metadata[x]['name'].startsWith(league_name));
    let league_team_names : string[] = [];
    let league_all_standings : Array<Array<number[]>> = [];
    for (const league_division_id of league_division_ids) {
        league_team_names.push(...raw_data.metadata[league_division_id]['teams']);
        let day_index = 0;
        for (const day_standings of raw_data.standings.map(x => x[league_division_id])) {
            if (day_index >= league_all_standings.length) {
                league_all_standings.push([]);
            }
            league_all_standings[day_index].push(...day_standings);
            ++day_index;
        }
    }
    addChart(league_name || "All MLB", undefined, league_team_names, league_all_standings, opening_day, false);
}

function findDivisionIdAndIndex(data: any, teamName: string): {divisionId: string, index: number} {
    for (let divisionId of Object.keys(data.metadata)) {
        let index = data.metadata[divisionId]['teams'].indexOf(teamName);
        if (index != -1) {
            return {divisionId, index};
        }
    }
    return {divisionId: "NOTFOUND", index: -1};
}

async function rockiesWhiteSox(data2024: any, data2025: any) {
    if (!data2024) {
        let response = await fetch(`data/2024.json`);
        data2024 = await response.json();
    }
    if (!data2025) {
        let response = await fetch(`data/2025.json`);
        data2025 = await response.json();
    }

    const opening_day_2024_str_parts : number[] = (data2024.opening_day as string).split('/').map(x => parseInt(x, 10));
    // month is 0-indexed
    let opening_day_2024 : Date = new Date(2025, opening_day_2024_str_parts[1] - 1, opening_day_2024_str_parts[2]);
    const opening_day_2025_str_parts : number[] = (data2025.opening_day as string).split('/').map(x => parseInt(x, 10));
    let opening_day_2025 : Date = new Date(2025, opening_day_2025_str_parts[1] - 1, opening_day_2025_str_parts[2]);
    let opening_day : Date = opening_day_2024 < opening_day_2025 ? opening_day_2024 : opening_day_2025;

    let whiteSoxInfo = findDivisionIdAndIndex(data2024, "Chicago White Sox");
    let whiteSoxData : Array<number[]> = data2024.standings.map(x => x[whiteSoxInfo.divisionId][whiteSoxInfo.index]);
    while (opening_day_2024 > opening_day) {
        whiteSoxData.unshift([0, 0]);
        opening_day_2024 = prev_day(opening_day_2024);
    }
    let rockiesInfo = findDivisionIdAndIndex(data2025, "Colorado Rockies");
    let rockiesData : Array<number[]> = data2025.standings.map(x => x[rockiesInfo.divisionId][rockiesInfo.index]);
    while (opening_day_2025 > opening_day) {
        rockiesData.unshift([0, 0]);
        opening_day_2025 = prev_day(opening_day_2025);
    }
    while (whiteSoxData.length < rockiesData.length) {
        whiteSoxData.push(whiteSoxData[whiteSoxData.length - 1]);
    }
    // ugh, can't use this because of how we pass in all_standings
    /*let rockiesFirst;
    {
        let index = rockiesData.length - 1;
        let rockiesAbove500 = rockiesData[index][0] - rockiesData[index][1];
        let whiteSoxAbove500 = whiteSoxData[index][0] - whiteSoxData[index][1];
        rockiesFirst = rockiesAbove500 > whiteSoxAbove500;
    }*/
    // Don't pad Rockies data, they're still playing
    let all_standings = whiteSoxData.map((data, index) => {
        if (index < rockiesData.length) {
            return [data, rockiesData[index]];
        }
        return [data];
    });

    addChart("Chasing History",
         "<br>The 2024 White Sox set the record for losses in a season<br>with 121. Can the 2025 Rockies \"beat\" them?<br>",
         ["2024 White Sox", "2025 Rockies"], all_standings, opening_day, true);
}

async function changeYear(year: string) {
    let response = await fetch(`data/${year}.json`);
    let raw_data : any = await response.json();
    const opening_day_str_parts : number[] = (raw_data.opening_day as string).split('/').map(x => parseInt(x, 10));
    // month is 0-indexed
    const opening_day : Date = new Date(opening_day_str_parts[0], opening_day_str_parts[1] - 1, opening_day_str_parts[2]);
    const isDark = isDarkMode();
    let divisionIds = Object.keys(raw_data.metadata);
    divisionIds.sort((a, b) => get_division_name_sort_key(raw_data.metadata[a]['name']) - get_division_name_sort_key(raw_data.metadata[b]['name']));
    let have_added_all_al = false;

    document.getElementById("charts").innerHTML = '';
    await rockiesWhiteSox(year === "2024" ? raw_data : undefined, year === "2025" ? raw_data : undefined);

    for (const divisionId of divisionIds) {
        const team_names : string[] = raw_data.metadata[divisionId]['teams'];
        const all_standings : Array<Array<number[]>> = raw_data.standings.map(x => x[divisionId]);
        const title = raw_data.metadata[divisionId]['name'];
        if (title.startsWith("National League") && !have_added_all_al) {
            // AL is first, put all AL teams here
            have_added_all_al = true;
            addLeagueChart(raw_data, "American League", opening_day);
        }
        addChart(title, undefined, team_names, all_standings, opening_day);
    }
    addLeagueChart(raw_data, "National League", opening_day);
    // undefined = all MLB
    addLeagueChart(raw_data, undefined, opening_day);
}

function isDarkMode() : boolean {
    return document.documentElement.getAttribute('color-mode') == 'dark';
}

function setupYearSelector(state: State) {
    let yearSelector = document.getElementById("yearSelect") as HTMLSelectElement;
    for (let year = MIN_YEAR; year <= MAX_YEAR; ++year) {
        let option = document.createElement("option");
        option.value = year.toString();
        option.text = year.toString();
        yearSelector.add(option);
    }
    yearSelector.addEventListener('change', (event) => {
        updateYearBasedOnSelector();
    });
    yearSelector.selectedIndex = state.year - MIN_YEAR;
    changeYear(state.year.toString());
}

function updateYearBasedOnSelector() {
    const newYear = (document.getElementById("yearSelect") as HTMLSelectElement).value;
    window.location.hash = getNewQueryHash(parseInt(newYear, 10), useTeamColors);
    changeYear(newYear);
}

let useTeamColors = true;
function setupTeamColorsCheckbox(state: State) {
    const teamColorsCheckbox = document.getElementById("useTeamColorsCheckbox") as HTMLInputElement;
    teamColorsCheckbox.checked = state.useTeamColors;
    useTeamColors = state.useTeamColors;
    // this one gets triggered if the label gets clicked
    teamColorsCheckbox.addEventListener('change', (event) => {
        useTeamColors = (document.getElementById("useTeamColorsCheckbox") as HTMLInputElement).checked;
        // sigh, if we do this immediately the slider freezes until the thread gets unblocked? anyway,
        // just delay a little
        window.setTimeout(() => updateYearBasedOnSelector(), 200);
    });
    // this one gets triggered if the toggle background gets clicked
    document.getElementById("useTeamColorsBackground").addEventListener('click', (event) => {
        let checkbox = (document.getElementById("useTeamColorsCheckbox") as HTMLInputElement);
        checkbox.checked = !checkbox.checked;
        useTeamColors = (document.getElementById("useTeamColorsCheckbox") as HTMLInputElement).checked;
        // sigh, if we do this immediately the slider freezes until the thread gets unblocked? anyway,
        // just delay a little
        window.setTimeout(() => updateYearBasedOnSelector(), 200);
    });
}


// TODO - move to different .js file?
if (window.CSS && CSS.supports("color", "var(--primary)")) {
    let toggleColorMode = function toggleColorMode(e) {
      // Switch to Light Mode
      if (e.currentTarget.classList.contains("light--hidden")) {
        // Sets the custom html attribute
        document.documentElement.setAttribute("color-mode", "light"); // Sets the user's preference in local storage
  
        localStorage.setItem("color-mode", "light");
        updateYearBasedOnSelector();
        return;
      }
      /* Switch to Dark Mode
      Sets the custom html attribute */
      document.documentElement.setAttribute("color-mode", "dark"); // Sets the user's preference in local storage
  
      localStorage.setItem("color-mode", "dark");
      updateYearBasedOnSelector();
    }; // Get the buttons in the DOM
  
    let toggleColorButtons = document.querySelectorAll(".color-mode__btn"); // Set up event listeners
  
    toggleColorButtons.forEach(function(btn) {
      btn.addEventListener("click", toggleColorMode);
    });
} else {
    // If the feature isn't supported, then we hide the toggle buttons
    //TODO - does this work?
    let btnContainer = document.querySelector(".color-mode__header") as HTMLHeadingElement;
    btnContainer.style.display = "none";
}

interface State {
    year: number,
    useTeamColors: boolean
}
function parseQueryHash(): State {
    let state : State = { year: MAX_YEAR, useTeamColors: true };
    if (!window.location.hash) {
        return state;
    }
    let hash = window.location.hash.substring(1);
    let parts = hash.split('.');
    for (let part of parts) {
        if (part.startsWith("useTeamColors=")) {
            let rest = part.substring("useTeamColors=".length);
            if (rest === '0') {
                state.useTeamColors = false;
            }
        }
        else {
            let year = parseInt(part, 10);
            if (year >= MIN_YEAR && year <= MAX_YEAR) {
                state.year = year;
            }
        }
    }
    return state;
}
function getNewQueryHash(year: number, useTeamColors: boolean): string {
    let hash = "";
    if (year != MAX_YEAR) {
        hash += year.toString();
    }
    if (!useTeamColors) {
        if (hash.length > 0) {
            hash += '.';
        }
        hash += "useTeamColors=0";
    }
    return hash;
}


(async function() {
    let state = parseQueryHash();
    setupTeamColorsCheckbox(state);
    setupYearSelector(state);
})();

