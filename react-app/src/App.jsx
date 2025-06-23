import { useState, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';
import { getChargers } from './api';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGdvdHRpcGF0aSIsImEiOiJjbTh0cjRzazMwZXFvMnNxMmExNTdqZjBlIn0.JffbXqKwr5oh2_kMapNyDw';

function App() {
  const [viewport, setViewport] = useState({
    latitude: 47.6062,
    longitude: -122.3321,
    zoom: 11
  });
  const [chargers, setChargers] = useState([]);

  useEffect(() => {
    const fetchChargers = async () => {
      const chargerData = await getChargers(viewport.latitude, viewport.longitude, { operationalOnly: true });
      setChargers(chargerData);
    };

    fetchChargers();
  }, []); // Empty dependency array means this runs only once on mount

  return (
    <>
      <header className="header">
        <div className="header-content">
          <h1><a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>ChargeNear</a></h1>
          <div className="search-container">
            <input type="text" id="address" placeholder="Enter a location (e.g., city, zip code)" />
            <button>Search</button>
            <button>
              <i className="fa-solid fa-location-crosshairs"></i>
            </button>
          </div>
          <nav>
            <a href="/about.html" aria-label="About Page"><i className="fa-solid fa-bars"></i></a>
          </nav>
        </div>
      </header>
      <Map
        initialViewState={viewport}
        onMove={evt => setViewport(evt.viewState)}
        style={{ height: 'calc(100vh - 71px)', width: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {chargers.filter(charger => charger.AddressInfo).map(charger => (
          <Marker
            key={charger.ID}
            longitude={charger.AddressInfo.Longitude}
            latitude={charger.AddressInfo.Latitude}
            anchor="bottom"
          >
            <i className="fa-solid fa-charging-station" style={{ color: '#EEC218', fontSize: '24px' }}></i>
          </Marker>
        ))}
      </Map>
    </>
  );
}

export default App;
