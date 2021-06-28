import Plotly from 'plotly.js-basic-dist-min';

function next_day(d: Date) : Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

function get_plot_datas(all_standings: Array<Array<number[]>>, team_names: string[], date_values: Date[]) : any[] {
    let plot_datas = [];
    for (let i = 0; i < team_names.length; ++i) {
        const team_standings = all_standings.map(x => x[i]);
        const games_above_500 = team_standings.map(x => x[0] - x[1]);
        const hover_texts = team_standings.map(x => `${x[0]}-${x[1]}`);
        plot_datas.push({
            x: date_values,
            y: games_above_500,
            text: hover_texts,
            name: team_names[i]
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
        Plotly.newPlot( chartSection.children.item(index), plot_datas, {
            title: raw_data.metadata[divisionId]['name'] } );
            //margin: { t: 0 }, title: raw_data.metadata[divisionId]['name'] } );
        index++;
    }
}

const MIN_YEAR = 2017;
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
        const newYear = (event.target as HTMLSelectElement).value
        changeYear(newYear);
    })
    yearSelector.selectedIndex = yearSelector.children.length - 1;
    changeYear(MAX_YEAR.toString());
}

(async function() {
    setupYearSelector();
})();