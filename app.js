// Endpoint de Wikidata
const endpointUrl = 'https://query.wikidata.org/sparql';

// Query SPARQL: 20 cuadros (se puede ampliar) de pintores españoles en museos fuera de España
const sparqlQuery = `
SELECT DISTINCT ?painting ?paintingLabel ?artistLabel ?museumLabel ?coord ?image WHERE {
  ?painting wdt:P31/wdt:P279* wd:Q3305213; # instance of painting
            wdt:P170 ?artist; # author
            wdt:P276 ?museum; # location
            wdt:P18 ?image. # image
            
  ?artist wdt:P27 wd:Q29. # Spanish nationality
  
  ?museum wdt:P17 ?country; # museum country
          wdt:P625 ?coord. # museum coordinates
          
  FILTER(?country != wd:Q29) # Not exposed in Spain
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],es". }
}
LIMIT 50
`;

// Variables globales
let map;
let markersLayer = new L.FeatureGroup();

/**
 * Función para ejecutar la consulta SPARQL contra Wikidata.
 */
function makeSPARQLQuery(endpointUrl, query, doneCallback) {
    const settings = {
        headers: { Accept: 'application/sparql-results+json' },
        data: { query: query }
    };
    return $.ajax(endpointUrl, settings).then(doneCallback);
}

/**
 * Inicializar el mapa de Leaflet en modo "Dark".
 */
function initMap() {
    // Coordenadas mundiales (vista amplia)
    map = L.map('map').setView([40, 0], 3);

    // Tiles oscuras para estilo premium
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'dark-tiles'
    }).addTo(map);

    map.addLayer(markersLayer);
}

/**
 * Parsea el texto "Point(lon lat)" de WKT (Well-Known Text) a Leaflet [lat, lon].
 */
function parseWKTPoint(wkt) {
    const coordsMatches = wkt.match(/Point\(([^ ]+) ([^)]+)\)/);
    if(coordsMatches && coordsMatches.length === 3) {
        return {
            lon: parseFloat(coordsMatches[1]),
            lat: parseFloat(coordsMatches[2])
        };
    }
    return null;
}

/**
 * Añadir puntos al mapa
 */
function renderArtworks(bindings) {
    markersLayer.clearLayers();

    // Icono personalizado premium
    const artIcon = L.icon({
        iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Map_marker_icon_%E2%80%93_Nicolas_Mollet_%E2%80%93_Art_gallery_%E2%80%93_Default.png',
        iconSize: [32, 37],
        iconAnchor: [16, 37],
        popupAnchor: [0, -37]
    });

    bindings.forEach(info => {
        // Parsear coordenadas
        const coords = parseWKTPoint(info.coord.value);
        if (!coords) return;

        // Variables de datos (controlando indefinidos, aunque la query pide obligatorios)
        const title = info.paintingLabel ? info.paintingLabel.value : "Obra Desconocida";
        const artist = info.artistLabel ? info.artistLabel.value : "Autor Desconocido";
        const museum = info.museumLabel ? info.museumLabel.value : "Museo Desconocido";
        const imageUrl = info.image ? info.image.value : "https://via.placeholder.com/250x180?text=Sin+Imagen";

        // HTML del Popup Premium
        const popupContent = `
            <div class="art-popup">
                <div class="art-image-container">
                    <img class="art-image" src="${imageUrl}" alt="${title}">
                </div>
                <div class="art-info">
                    <h3 class="art-title">${title}</h3>
                    <p class="art-author">🎨 ${artist}</p>
                    <p class="art-museum">🏛️ ${museum}</p>
                </div>
            </div>
        `;

        // Crear marcador
        const marker = L.marker([coords.lat, coords.lon], { icon: artIcon })
            .bindPopup(popupContent, {
                maxWidth: 250,
                minWidth: 250,
                className: 'custom-art-popup'
            });

        markersLayer.addLayer(marker);
    });

    // Ajustar zoom automático para que todos los marcadores sean visibles
    if (markersLayer.getLayers().length > 0) {
        map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
    }
}

/**
 * Función principal para cargar los datos
 */
function loadData() {
    const $btn = $('#loadDataBtn');
    const $spinner = $('#spinner');

    $btn.prop('disabled', true);
    $spinner.removeClass('hidden');

    makeSPARQLQuery(endpointUrl, sparqlQuery, function(data) {
        if(data && data.results && data.results.bindings) {
            renderArtworks(data.results.bindings);
        }
    })
    .catch(error => {
        console.error("Error cargando SPARQL:", error);
        alert("Ocurrió un error al cargar los datos de Wikidata.");
    })
    .always(() => {
        $btn.prop('disabled', false);
        $spinner.addClass('hidden');
    });
}

// Inicializar el documento
$(document).ready(function() {
    initMap();

    // Evento de clic
    $('#loadDataBtn').on('click', loadData);
    
    // Cargar automáticamente al inicio si se desea, lo activamos:
    loadData();
});
