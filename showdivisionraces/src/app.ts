import Plotly from 'plotly.js-dist-min';

(async function() {
    let response = await fetch('data/2019.json');
    let data2019 : any = await response.json();
    //alert(data2019.metadata[200].name);
    const divChart = document.getElementById("divisionchart");
    Plotly.newPlot( divChart, [{
        x: [1, 2, 3, 4, 5],
        y: [1, 2, 4, 8, 16] }], {
        margin: { t: 0 } } );
})();