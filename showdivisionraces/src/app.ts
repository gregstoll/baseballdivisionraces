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
    return plot_datas;
}

(async function() {
    let response = await fetch('data/2019.json');
    let data2019 : any = await response.json();
    //alert(data2019.metadata[200].name);
    const opening_day_str_parts : number[] = (data2019.opening_day as string).split('/').map(x => parseInt(x, 10));
    // month is 0-indexed
    const opening_day : Date = new Date(opening_day_str_parts[0], opening_day_str_parts[1] - 1, opening_day_str_parts[2]);
    const team_names : string[] = data2019.metadata['200']['teams'];
    const all_standings : Array<Array<number[]>> = data2019.standings.map(x => x['200']);
    const astros_standings = all_standings.map(x => x[0]);
    let date_values : Date[] = [opening_day];
    while (date_values.length < astros_standings.length) {
        date_values.push(next_day(date_values[date_values.length - 1]))
    }
    const plot_datas = get_plot_datas(all_standings, team_names, date_values);
    const divChart = document.getElementById("divisionchart");
    Plotly.newPlot( divChart, plot_datas, {
        margin: { t: 0 } } );
})();