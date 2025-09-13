"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Marker icon
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

// Change map view
function ChangeMapView({ coords, zoom }: { coords: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(coords, zoom);
  return null;
}

// Type for Nominatim suggestion
interface Suggestion {
  lat: string;
  lon: string;
  display_name: string;
}

export default function MapComponent() {
  const [coords, setCoords] = useState<[number, number]>([28.6139, 77.209]); // default view
  const [zoom, setZoom] = useState(13);
  const [tileUrl, setTileUrl] = useState("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  const [tileAttribution, setTileAttribution] = useState(
    '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
  );

  const [routeEnabled, setRouteEnabled] = useState(false);

  // Single search
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Start & Destination
  const [startQuery, setStartQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [startSuggestions, setStartSuggestions] = useState<Suggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);

  // Fetch suggestions
  const fetchSuggestions = async (
    q: string,
    setFn: React.Dispatch<React.SetStateAction<Suggestion[]>>,
    setLoadingFn: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (q.length < 3) {
      setFn([]);
      return;
    }
    setLoadingFn(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`
      );
      const data: Suggestion[] = await res.json();
      setFn(data);
    } catch (err) {
      console.error("Suggestion fetch error:", err);
    } finally {
      setLoadingFn(false);
    }
  };

  // Effects
  useEffect(() => {
    if (!routeEnabled) {
      const debounce = setTimeout(() => fetchSuggestions(query, setSuggestions, setLoading), 400);
      return () => clearTimeout(debounce);
    }
  }, [query, routeEnabled]);

  useEffect(() => {
    if (routeEnabled) {
      const debounce = setTimeout(() => fetchSuggestions(startQuery, setStartSuggestions, setLoading), 400);
      return () => clearTimeout(debounce);
    }
  }, [startQuery, routeEnabled]);

  useEffect(() => {
    if (routeEnabled) {
      const debounce = setTimeout(() => fetchSuggestions(destQuery, setDestSuggestions, setLoading), 400);
      return () => clearTimeout(debounce);
    }
  }, [destQuery, routeEnabled]);

  // Handlers
  const handleSelectQuery = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setCoords([lat, lon]);
    setQuery(s.display_name);
    setSuggestions([]);
  };

  const handleSelectStart = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setStartCoords([lat, lon]);
    setStartQuery(s.display_name);
    setStartSuggestions([]);
    setCoords([lat, lon]);
  };

  const handleSelectDest = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setDestCoords([lat, lon]);
    setDestQuery(s.display_name);
    setDestSuggestions([]);
    setCoords([lat, lon]);
  };

  const handleClearQuery = () => setQuery("");
  const handleClearStart = () => {
    setStartQuery("");
    setStartSuggestions([]);
    setStartCoords(null);
  };
  const handleClearDest = () => {
    setDestQuery("");
    setDestSuggestions([]);
    setDestCoords(null);
  };

  const changeTile = (option: string) => {
    switch (option) {
      case "OSM":
        setTileUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
        setTileAttribution('&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors');
        break;
      case "Carto Light":
        setTileUrl("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png");
        setTileAttribution("&copy; OSM &copy; CARTO");
        break;
      case "Carto Dark":
        setTileUrl("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png");
        setTileAttribution("&copy; OSM &copy; CARTO");
        break;
      case "Stamen Toner":
        setTileUrl("https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png");
        setTileAttribution("Map tiles by Stamen, OSM");
        break;
    }
  };

  // Distance calculation
  const getDistanceKm = (start: [number, number], end: [number, number]): number => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(end[0] - start[0]);
    const dLon = toRad(end[1] - start[1]);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(start[0])) * Math.cos(toRad(end[0])) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance =
    startCoords && destCoords ? getDistanceKm(startCoords, destCoords).toFixed(2) : null;

  return (
    <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto p-4 bg-gray-50 rounded-2xl shadow-lg gap-4">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white p-4 rounded-xl shadow-md flex-shrink-0">
        <h2 className="text-lg font-bold mb-4 text-gray-800">Map Controls</h2>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={routeEnabled}
            onChange={() => setRouteEnabled(!routeEnabled)}
            id="routeToggle"
          />
          <label htmlFor="routeToggle" className="text-gray-700 text-sm">
            Enable Route Search
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">Tile Style</label>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
            onChange={(e) => changeTile(e.target.value)}
          >
            <option>OSM</option>
            <option>Carto Light</option>
            <option>Carto Dark</option>
            <option>Stamen Toner</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">Zoom</label>
          <input
            type="range"
            min={1}
            max={20}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-sm mt-1 text-gray-700">{zoom}</div>
        </div>

        {distance && (
          <div className="mt-4 text-gray-700 font-medium">
            Distance: <span className="text-green-600">{distance} km</span>
          </div>
        )}
      </div>

      {/* Map Section */}
      <div className="flex-1 relative z-0">
        {/* Search Inputs */}
        {!routeEnabled && (
          <div className="relative mb-4 z-50">
            <input
              type="text"
              placeholder="Search for a place"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={handleClearQuery}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 z-50"
              >
                &#10005;
              </button>
            )}
            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md max-h-60 overflow-auto z-[1000]">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
                    onClick={() => handleSelectQuery(s)}
                  >
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
            {loading && (
              <div className="absolute right-3 top-3 animate-spin w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full z-50"></div>
            )}
          </div>
        )}

        {/* Route Inputs */}
        {routeEnabled && (
          <div className="flex gap-10">
            {/* Start */}
            <div className="relative mb-2 z-50 w-full">
              <input
                type="text"
                placeholder="Start location"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700 mb-1"
                value={startQuery}
                onChange={(e) => setStartQuery(e.target.value)}
              />
              {startQuery && (
                <button
                  onClick={handleClearStart}
                  className="absolute right-3 top-2 text-gray-500 hover:text-gray-700 z-50"
                >
                  &#10005;
                </button>
              )}
              {startSuggestions.length > 0 && (
                <ul className="absolute mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md max-h-40 overflow-auto z-[1050]">
                  {startSuggestions.map((s, i) => (
                    <li
                      key={i}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
                      onClick={() => handleSelectStart(s)}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Destination */}
            <div className="relative mb-4 z-50 w-full">
              <input
                type="text"
                placeholder="Destination location"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700 mb-1"
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
              />
              {destQuery && (
                <button
                  onClick={handleClearDest}
                  className="absolute right-3 top-2 text-gray-500 hover:text-gray-700 z-50"
                >
                  &#10005;
                </button>
              )}
              {destSuggestions.length > 0 && (
                <ul className="absolute mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md max-h-40 overflow-auto z-[1050]">
                  {destSuggestions.map((s, i) => (
                    <li
                      key={i}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
                      onClick={() => handleSelectDest(s)}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 relative z-0">
          <MapContainer center={coords} zoom={zoom} style={{ height: "500px", width: "100%" }}>
            <TileLayer url={tileUrl} attribution={tileAttribution} />
            <ChangeMapView coords={coords} zoom={zoom} />
            {!routeEnabled && <Marker position={coords} icon={markerIcon} />}
            {routeEnabled && startCoords && <Marker position={startCoords} icon={markerIcon} />}
            {routeEnabled && destCoords && <Marker position={destCoords} icon={markerIcon} />}
            {routeEnabled && startCoords && destCoords && (
              <Polyline positions={[startCoords, destCoords]} color="blue" />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
