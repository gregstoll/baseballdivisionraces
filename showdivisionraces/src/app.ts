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
    ["Seattle Mariners", new TeamColors("#c4ced4")],
    ["Los Angeles Angels", new TeamColors("#862633")],
    ["Texas Rangers", new TeamColors("#c0111f")],

    // NYY blue #134a8e is too close to Blue Jays, use black for pinstripes
    ["New York Yankees", new TeamColors("#000000", "#c4ced3")],
    ["Baltimore Orioles", new TeamColors("#df4601")],
    ["Toronto Blue Jays", new TeamColors("#134a8e")],
    ["Tampa Bay Rays", new TeamColors("#f5d130")],
    ["Boston Red Sox", new TeamColors("#bd3039")],

    ["Chicago White Sox", new TeamColors("#c4ced4")],
    ["Cleveland Indians", new TeamColors("#e31937")],
    ["Detroit Tigers", new TeamColors("#f26722")],
    ["Kansas City Royals", new TeamColors("#7bb2dd")],
    ["Minnesota Twins", new TeamColors("#002b5c", "#cfac7a")],

    ["San Francisco Giants", new TeamColors("#fd5a1e")],
    // TODO lighten this color?
    ["Los Angeles Dodgers", new TeamColors("#005a9c")],
    ["San Diego Padres", new TeamColors("#847464", "#5c666f")],
    ["Colorado Rockies", new TeamColors("#33006f", "#c4ced4")],
    ["Arizona Diamondbacks", new TeamColors("#a71930")],

    ["New York Mets", new TeamColors("#002d72")],
    ["Washington Nationals", new TeamColors("#ab0003")],
    ["Atlanta Braves", new TeamColors("#eaaa00")],
    ["Philadelphia Phillies", new TeamColors("#e81828", "#284898")],
    ["Miami Marlins", new TeamColors("#ff6600")],

    ["Milwaukee Brewers", new TeamColors("#b6922e")],
    ["Chicago Cubs", new TeamColors("#0e3386")],
    ["Cincinnati Reds", new TeamColors("#c6011f")],
    ["St. Louis Cardinals", new TeamColors("#22205f", "#c41e3a")],
    //["Pittsburgh Pirates", new TeamColors("#000000", "#fdb827")]
    // TODO - change color for light mode
    ["Pittsburgh Pirates", new TeamColors("#fdb827", "#fdb827")]

]);

function get_plot_datas(all_standings: Array<Array<number[]>>, team_names: string[], date_values: Date[]) : any[] {
    let plot_datas = [];
    const isDark = isDarkMode();
    for (let i = 0; i < team_names.length; ++i) {
        const team_standings = all_standings.map(x => x[i]);
        const games_above_500 = team_standings.map(x => x[0] - x[1]);
        const hover_texts = team_standings.map(x => `${x[0]}-${x[1]}`);
        // TODO - assert that we have one?
        const team_colors = TEAM_NAMES_TO_COLORS.get(team_names[i]);
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

        Plotly.newPlot( chartSection.children.item(index), plot_datas,
         {
            title: raw_data.metadata[divisionId]['name'],
            xaxis: {
                linecolor: isDark ? "#eeeeee" : "#111111"
            },
            yaxis: {
                linecolor: isDark ? "#eeeeee" : "#111111",
                zerolinecolor: isDark ? "#eeeeee" : "#111111"
            },
            paper_bgcolor: isDark ? "#111111" : "#eeeeee",
            plot_bgcolor: isDark ? "#111111" : "#eeeeee"
         });
        index++;
    }
}

function isDarkMode() : boolean {
    return document.documentElement.getAttribute('color-mode') == 'dark';
}

const MIN_YEAR = 2015;
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
    setupYearSelector();
})();

