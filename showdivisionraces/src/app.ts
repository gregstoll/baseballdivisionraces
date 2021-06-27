import Plotly from 'plotly.js-basic-dist-min';

function next_day(d: Date) : Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

(async function() {
    let response = await fetch('data/2019.json');
    let data2019 : any = await response.json();
    //alert(data2019.metadata[200].name);
    const opening_day_str_parts : number[] = (data2019.opening_day as string).split('/').map(x => parseInt(x, 10));
    // month is 0-indexed
    const opening_day : Date = new Date(opening_day_str_parts[0], opening_day_str_parts[1] - 1, opening_day_str_parts[2]);
    const astros_standings : Array<number[]> = data2019.standings.map(x => x['200'][0]);
    let date_values : Date[] = [opening_day];
    while (date_values.length < astros_standings.length) {
        date_values.push(next_day(date_values[date_values.length - 1]))
    }
    const games_above_500 = astros_standings.map(x => x[0] - x[1]);
    const hover_texts = astros_standings.map(x => `${x[0]}-${x[1]}`);

    const divChart = document.getElementById("divisionchart");
    Plotly.newPlot( divChart, [{
        x: date_values,
        y: games_above_500,
        text: hover_texts }], {
        margin: { t: 0 } } );
})();