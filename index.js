 // 1. Standardní mapa (OpenStreetMap)
const svetlaMapa = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>'
});

// 2. Tmavá mapa (CartoDB Dark Matter)
const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO'
});

// 3. Satelitní mapa (OpenTopoMap)
const satelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
});

const map = L.map('map', {
    center: [50.08, 14.43],
    zoom: 13,
    layers: [dark] // Tímto říkáme, že tmavá mapa je "výchozí"
});

// Definujeme seznam, který se v přepínači zobrazí
const baseMaps = {
    "Tmavá mapa": dark,
    "Standardní mapa": svetlaMapa,
    "Satelitní mapa": satelit
};

// Přidáme ovládací prvek na mapu
L.control.layers(baseMaps).addTo(map);


// Načtení dat z paměti
let mojeBody = JSON.parse(localStorage.getItem('body')) || [];

// Pomocná funkce pro vykreslení bodu (markeru) na mapu
function vykresliBodNaMapu(bod) {
    const marker = L.marker([bod.lat, bod.lng]).addTo(map);

    marker._icon.classList.add("red-marker");
    
    // Obsah bubliny s tlačítkem na smazání (využijeme ID)
    const popupObsah = `
        <div>
            ${bod.text}
            <hr>
            <button onclick="smazatJedenBod(${bod.id})" style="color:red; cursor:pointer;">Smazat bod</button>
        </div>
    `;
    marker.bindPopup(popupObsah);
}

// Při startu vykreslíme vše, co je v paměti
mojeBody.forEach(bod => vykresliBodNaMapu(bod));

// Hlavní funkce při kliknutí na mapu
async function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const adresa = data.display_name || "Neznámé místo";

        // VÝPOČET VZDÁLENOSTI
        let textVzdalenosti = "";
        if (mojeBody.length > 0) {
            const posledniBod = mojeBody[mojeBody.length - 1];
            // Vytvoříme Leaflet body pro výpočet
            const bodA = L.latLng(posledniBod.lat, posledniBod.lng);
            const bodB = L.latLng(lat, lng);
            const vzdalenost = bodA.distanceTo(bodB); // v metrech
            textVzdalenosti = `<br><i>Vzdálenost od předchozího: ${(vzdalenost / 1000).toFixed(2)} km</i>`;
        }

        const poznamka = prompt(`${adresa}\n\n Přidej si poznámku`);

        if (poznamka !== null) {
            const novyBod = {
                id: Date.now(),
                lat: lat,
                lng: lng,
                text: `<b>${adresa}</b><br>${poznamka}${textVzdalenosti}`
            };

            mojeBody.push(novyBod);
            localStorage.setItem('body', JSON.stringify(mojeBody));
            
            vykresliBodNaMapu(novyBod);
        }

    } catch (error) {
        console.error("Chyba:", error);
        alert("Chyba při komunikaci se serverem.");
    }
}

let prvniBodProMereni = null; 
let docasnaCara = null;

// Pomocná funkce pro vymazání měření z mapy
window.smazatMereni = function() {
    if (docasnaCara) {
        map.removeLayer(docasnaCara);
        docasnaCara = null;
    }
    map.closePopup();
    prvniBodProMereni = null;
};

function mereniVzdalenosti(e) {
    if (e.originalEvent) {
        e.originalEvent.preventDefault();
    }

    if (!prvniBodProMereni) {
        // START MĚŘENÍ
        prvniBodProMereni = e.latlng;
        map.closePopup();

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
                <div>
                    📏 Start měření.<br>
                    Klikni pravým na cíl nebo <br>
                    <button onclick="smazatMereni()" style="cursor:pointer;">zrušit</button>
                </div>
            `)
            .openOn(map);

    } else {
        // CÍL MĚŘENÍ
        const bodA = L.latLng(prvniBodProMereni.lat, prvniBodProMereni.lng);
        const bodB = L.latLng(e.latlng.lat, e.latlng.lng);
        const dist = (bodA.distanceTo(bodB) / 1000).toFixed(2);
 
        if (docasnaCara) {
            map.removeLayer(docasnaCara);
        }

        docasnaCara = L.polyline([bodA, bodB], {color:'#8e1616', weight: 2}).addTo(map);

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
                <div>
                    🏁 <b>Vzdálenost: ${dist} km</b><br>
                    <button onclick="smazatMereni()" style="cursor:pointer; margin-top:5px;">Smazat měření</button>
                </div>
            `)
            .openOn(map);

        prvniBodProMereni = null; 
    }
}

map.on('contextmenu', mereniVzdalenosti);


window.smazatJedenBod = function(id) {
    mojeBody = mojeBody.filter(b => b.id !== id);
    localStorage.setItem('body', JSON.stringify(mojeBody));
    location.reload();
}

document.getElementById('smazat-vse').addEventListener('click', () => {
    if (confirm("Opravdu smazat vše?")) {
        mojeBody = [];
        localStorage.removeItem('body');
        location.reload();
    }
});

map.on('click', onMapClick);

function aktualizujUrl() {
    const stred = map.getCenter();
    const zoom = map.getZoom();
    const stav = `${zoom},${stred.lat.toFixed(4)},${stred.lng.toFixed(4)}`;
    window.location.hash = stav;
}

map.on('moveend', aktualizujUrl);

// 3. Funkce, která při načtení stránky zkontroluje URL a nastaví mapu
function nastavMapuPodleUrl() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const casti = hash.split(',');
        if (casti.length === 3) {
            const zoom = parseInt(casti[0]);
            const lat = parseFloat(casti[1]);
            const lng = parseFloat(casti[2]);
            map.setView([lat, lng], zoom);
        }
    }
}

nastavMapuPodleUrl();