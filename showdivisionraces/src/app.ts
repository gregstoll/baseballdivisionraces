import Plotly from 'plotly.js-basic-dist-min';

function next_day(d: Date) : Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

class TeamColors {
    _light: string;
    _dark: string;

    constructor(light, dark = undefined) {
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
    ["Oakland Athletics", new TeamColors("#003831", "#efb21e")],
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
    ["Cleveland Indians", new TeamColors("#e31937")],
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
TEAM_NAMES_TO_COLORS.set("California Angels", TEAM_NAMES_TO_COLORS.get("Los Angeles Angels"));
TEAM_NAMES_TO_COLORS.set("Anaheim Angels", TEAM_NAMES_TO_COLORS.get("Los Angeles Angels"));
TEAM_NAMES_TO_COLORS.set("Tampa Bay Devil Rays", TEAM_NAMES_TO_COLORS.get("Tampa Bay Rays"));
TEAM_NAMES_TO_COLORS.set("Florida Marlins", TEAM_NAMES_TO_COLORS.get("Miami Marlins"));
TEAM_NAMES_TO_COLORS.set("Montreal Expos", TEAM_NAMES_TO_COLORS.get("Washington Nationals"));

function get_plot_datas(all_standings: Array<Array<number[]>>, team_names: string[], date_values: Date[]) : any[] {
    let plot_datas = [];
    const isDark = isDarkMode();
    for (let i = 0; i < team_names.length; ++i) {
        const team_standings = all_standings.map(x => x[i]);
        const games_above_500 = team_standings.map(x => x[0] - x[1]);
        const hover_texts = team_standings.map(x => `${x[0]}-${x[1]}`);
        const team_colors = useTeamColors ? TEAM_NAMES_TO_COLORS.get(team_names[i]) : null;
        plot_datas.push({
            x: date_values,
            y: games_above_500,
            text: hover_texts,
            name: team_names[i],
            line: {
                color: isDark ? team_colors?.dark : team_colors?.light,
                width: 2
            }
        });
    }
    plot_datas.sort((data1, data2) => data2.y[data2.y.length - 1] - data1.y[data1.y.length - 1]);
    return plot_datas;
}

async function changeYear(year: string) {
    let response = await fetch(`data/${year}.json`);
    let raw_data : any = await response.json();
    const opening_day_str_parts : number[] = (raw_data.opening_day as string).split('/').map(x => parseInt(x, 10));
    // month is 0-indexed
    const opening_day : Date = new Date(opening_day_str_parts[0], opening_day_str_parts[1] - 1, opening_day_str_parts[2]);
    let index = 0;
    const isDark = isDarkMode();
    // TODO - sort divisions somehow?
    for (let divisionId of Object.keys(raw_data.metadata)) { 
        const team_names : string[] = raw_data.metadata[divisionId]['teams'];
        const all_standings : Array<Array<number[]>> = raw_data.standings.map(x => x[divisionId]);
        const astros_standings = all_standings.map(x => x[0]);
        let date_values : Date[] = [opening_day];
        while (date_values.length < astros_standings.length) {
            date_values.push(next_day(date_values[date_values.length - 1]))
        }
        const plot_datas = get_plot_datas(all_standings, team_names, date_values);
        const chartSection = document.getElementById("charts");
        if (chartSection.childElementCount <= index) {
            let newDiv = document.createElement('div');
            newDiv.className = "chart";
            chartSection.appendChild(newDiv);
        }

        const DARK_TEXT_COLOR = "#111111";
        const LIGHT_TEXT_COLOR = "#eeeeee";
        let textColor = isDark ? LIGHT_TEXT_COLOR : DARK_TEXT_COLOR;
        Plotly.newPlot( chartSection.children.item(index), plot_datas,
         {
            title: {
                text: raw_data.metadata[divisionId]['name'],
                font: {
                    color: textColor
                }
            },
            legend: {
                font: {
                    color: textColor
                }
            },
            xaxis: {
                color: textColor
            },
            yaxis: {
                color: textColor
            },
            paper_bgcolor: isDark ? "#262626" : "#e6e6e6",
            plot_bgcolor: isDark ? "#262626" : "#e6e6e6"
         });
        index++;
    }
}

function isDarkMode() : boolean {
    return document.documentElement.getAttribute('color-mode') == 'dark';
}

const MIN_YEAR = 1995;
const MAX_YEAR = 2021;
function setupYearSelector() {
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
    yearSelector.selectedIndex = yearSelector.children.length - 1;
    changeYear(MAX_YEAR.toString());
}

function updateYearBasedOnSelector() {
    const newYear = (document.getElementById("yearSelect") as HTMLSelectElement).value;
    changeYear(newYear);
}

let useTeamColors = true;
function setupTeamColorsRange() {
    const teamColorsCheckbox = document.getElementById("useTeamColorsCheckbox") as HTMLInputElement;
    useTeamColors = teamColorsCheckbox.checked;
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

(async function() {
    setupTeamColorsRange();
    setupYearSelector();
})();

