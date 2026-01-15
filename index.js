const svetla = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
});
const tmava = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO'
});
const satelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
});

const map = L.map('map', {
    center: [50.08, 14.43],
    zoom: 13,
    layers: [svetla] 
});

const baseMaps = {
    "Světlá": svetla,
    "Tmavá": tmava,
    "Satelitní": satelit
};
L.control.layers(baseMaps).addTo(map);

const cervenaIkona = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

let mojeBody = JSON.parse(localStorage.getItem('body')) || [];
let prvniBodProMereni = null;
let docasnaCara = null;

async function onMapClick(e) {
    if (!navigator.onLine) {
        alert("Jste v offline režimu. Přidávání bodů s adresou vyžaduje internet.");
        return;
    }

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const adresa = data.display_name || "Neznámé místo";

        const poznamka = prompt(`${adresa}\n\nNapište poznámku k výletu:`);
        if (poznamka === null) return;

        const fotoUrl = prompt(`Vložte URL adresu obrázku (nebo nechte prázdné):`);

        const novyBod = {
            id: Date.now(),
            lat: lat,
            lng: lng,
            text: `<b>${adresa}</b><br>${poznamka}`,
            foto: fotoUrl
        };

        mojeBody.push(novyBod);
        localStorage.setItem('body', JSON.stringify(mojeBody));
        vykresliBod(novyBod);

    } catch (error) {
        console.error(error);
        alert("Chyba při komunikaci se serverem. Zkuste to prosím znovu.");
    }
}

function vykresliBod(bod) {
    const marker = L.marker([bod.lat, bod.lng], { icon: cervenaIkona }).addTo(map);
    
    let obsah = `<div>${bod.text}`;
    if (bod.foto) {
        obsah += `<img src="${bod.foto}" style="width:100%; margin-top:10px; border-radius:5px;" onerror="this.style.display='none';">`;
    }
    obsah += `
        <hr>
        <button onclick="kopirovatOdkaz(${bod.lat}, ${bod.lng})">Kopírovat odkaz na místo</button>
        <button onclick="smazatJedenBod(${bod.id})" style="background:#ff4444; margin-top:5px;">Smazat bod</button>
    </div>`;
    
    marker.bindPopup(obsah);
}

window.kopirovatOdkaz = (lat, lng) => {
    const url = `${window.location.origin}${window.location.pathname}#15,${lat},${lng}`;
    navigator.clipboard.writeText(url);
    alert("Odkaz na toto místo byl zkopírován do schránky!");
};

window.smazatJedenBod = (id) => {
    mojeBody = mojeBody.filter(b => b.id !== id);
    localStorage.setItem('body', JSON.stringify(mojeBody));
    location.reload();
};

function mereni(e) {
    e.originalEvent.preventDefault();
    if (!prvniBodProMereni) {
        prvniBodProMereni = e.latlng;
        L.popup().setLatLng(e.latlng).setContent("📏 Start měření. Klikni pravým na cíl.").openOn(map);
    } else {
        const dist = (L.latLng(prvniBodProMereni).distanceTo(e.latlng) / 1000).toFixed(2);
        if (docasnaCara) map.removeLayer(docasnaCara);
        docasnaCara = L.polyline([prvniBodProMereni, e.latlng], {color: '#ff4444', weight: 4, dashArray: '5,10'}).addTo(map);
        L.popup().setLatLng(e.latlng).setContent(`<b>Vzdálenost: ${dist} km</b><br><button onclick="smazatMereni()">Zrušit měření</button>`).openOn(map);
        prvniBodProMereni = null;
    }
}

window.smazatMereni = () => {
    if (docasnaCara) map.removeLayer(docasnaCara);
    docasnaCara = null;
    prvniBodProMereni = null;
    map.closePopup();
};


mojeBody.forEach(vykresliBod);

map.on('click', onMapClick);
map.on('contextmenu', mereni);
map.on('moveend', () => {
    const c = map.getCenter();
    window.location.hash = `${map.getZoom()},${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
});

const hash = window.location.hash.substring(1).split(',');
if (hash.length === 3) map.setView([hash[1], hash[2]], hash[0]);

document.getElementById('smazat-vse').onclick = () => {
    if(confirm("Opravdu smazat všechny body?")) {
        localStorage.removeItem('body');
        location.reload();
    }
};

window.addEventListener('offline', () => alert("Aplikace přešla do offline režimu. Vaše uložená data jsou stále k dispozici."));