(async function() {
    let response = await fetch('data/2019.json');
    let data2019 : any = await response.json();
    alert(data2019.metadata[200].name);
})();