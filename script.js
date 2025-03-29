mapboxgl.accessToken = 'pk.eyJ1IjoiaGdvdHRpcGF0aSIsImEiOiJjbTh0cjRzazMwZXFvMnNxMmExNTdqZjBlIn0.JffbXqKwr5oh2_kMapNyDw'; // Replace with your token

let map;

function initMap(lat, lon) {
    if (map) map.remove();
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lon, lat],
        zoom: 13
    });
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
    new mapboxgl.Marker({ color: 'green' })
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup().setHTML(`Your Location<br><a href="${googleMapsLink}" target="_blank">Open in Google Maps</a>`))
        .addTo(map);
}

async function getCoordinates(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Mapbox geocoding response:", data);
    if (data.features.length > 0) {
        const [lon, lat] = data.features[0].center;
        return { lat, lon };
    }
    throw new Error("Address not found");
}

async function getAddressSuggestions(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    return data.features.map(feature => feature.place_name);
}

async function getChargers(lat, lon, distance) {
    const bboxSize = distance * 0.0145; // Miles to degrees (rough)
    const bbox = `${lon - bboxSize},${lat - bboxSize},${lon + bboxSize},${lat + bboxSize}`;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/charging%20station.json?bbox=${bbox}&types=poi&access_token=${mapboxgl.accessToken}&limit=10`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Mapbox charger URL:", url);
        console.log("Mapbox charger response:", JSON.stringify(data, null, 2));
        if (!data.features || data.features.length === 0) {
            console.log("No chargers found in this area.");
            return [];
        }
        const chargers = data.features.map(feature => {
            console.log("Processing charger:", feature);
            return {
                AddressInfo: { 
                    Latitude: feature.center[1], 
                    Longitude: feature.center[0], 
                    Title: feature.place_name 
                },
                Connections: [{ LevelID: feature.properties.category?.includes('fast') ? 3 : 2 }]
            };
        });
        return chargers;
    } catch (error) {
        console.error("Charger fetch failed:", error.message);
        return [];
    }
}

function addChargersToMap(chargers) {
    console.log("Adding chargers to map:", chargers);
    chargers.forEach(charger => {
        const lat = charger.AddressInfo.Latitude;
        const lon = charger.AddressInfo.Longitude;
        const name = charger.AddressInfo.Title;
        const googleMapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
        new mapboxgl.Marker({ color: 'blue' })
            .setLn