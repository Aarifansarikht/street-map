"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Marker icons
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

const startIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

const endIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconSize: [30, 45],
  iconAnchor: [15, 45],
});

const currentLocationIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
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

// Type for Route
interface Route {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

export default function MapComponent() {
  const [coords, setCoords] = useState<[number, number]>([28.6139, 77.209]); // default view (Delhi)
  const [zoom, setZoom] = useState(13);
  const [tileUrl, setTileUrl] = useState("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  const [tileAttribution, setTileAttribution] = useState(
    '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
  );

  const [routeEnabled, setRouteEnabled] = useState(false);
  const [transportMode, setTransportMode] = useState<"driving" | "walking" | "cycling">("driving");
  
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
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // User location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState<Suggestion[]>([]);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);

  // Fetch suggestions
  const fetchSuggestions = async (
    q: string,
    setFn: React.Dispatch<React.SetStateAction<Suggestion[]>>,
    setLoadingFn: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (q.length < 2) {
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

  // Calculate route
  const calculateRoute = async () => {
    if (!startCoords || !destCoords) return;
    
    setRouteLoading(true);
    try {
      // Using OSRM API for routing
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/${transportMode}/${startCoords[1]},${startCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      
      if (data.code === "Ok") {
        const routeCoordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        setRoute({
          coordinates: routeCoordinates,
          distance: data.routes[0].distance / 1000, // convert to km
          duration: data.routes[0].duration / 60 // convert to minutes
        });
      }
    } catch (err) {
      console.error("Route calculation error:", err);
    } finally {
      setRouteLoading(false);
    }
  };

  // Get user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setCoords([latitude, longitude]);
        setLocationError(null);
        
        // If route is enabled, set as start point
        if (routeEnabled) {
          setStartCoords([latitude, longitude]);
          setStartQuery("Current Location");
        }
      },
      (error) => {
        setLocationError("Unable to retrieve your location");
        console.error("Geolocation error:", error);
      }
    );
  };

  // Save current place
  const savePlace = () => {
    if (!query) return;
    
    const newPlace: Suggestion = {
      display_name: query,
      lat: coords[0].toString(),
      lon: coords[1].toString()
    };
    
    setSavedPlaces([...savedPlaces, newPlace]);
    localStorage.setItem('savedPlaces', JSON.stringify([...savedPlaces, newPlace]));
  };

  // Clear search and suggestions
  const handleClearQuery = () => {
    setQuery("");
    setSuggestions([]);
  };

  const handleClearStart = () => {
    setStartQuery("");
    setStartSuggestions([]);
    setStartCoords(null);
    setRoute(null);
  };

  const handleClearDest = () => {
    setDestQuery("");
    setDestSuggestions([]);
    setDestCoords(null);
    setRoute(null);
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

  useEffect(() => {
    if (startCoords && destCoords) {
      calculateRoute();
    }
  }, [startCoords, destCoords, transportMode]);

  useEffect(() => {
    // Load saved places from localStorage
    const saved = localStorage.getItem('savedPlaces');
    if (saved) {
      setSavedPlaces(JSON.parse(saved));
    }
  }, []);

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
  };

  const handleSelectDest = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setDestCoords([lat, lon]);
    setDestQuery(s.display_name);
    setDestSuggestions([]);
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
      case "Satellite":
        setTileUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
        setTileAttribution("Tiles &copy; Esri &copy; Earthstar Geographics");
        break;
    }
  };

  return (
    <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto p-4 bg-gray-50 rounded-2xl shadow-lg gap-4">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-white p-4 rounded-xl shadow-md flex-shrink-0 overflow-y-auto max-h-screen">
        <h2 className="text-lg font-bold mb-4 text-gray-800">Map Controls</h2>
        
        {/* Location button */}
        <div className="mb-4">
          <button 
            onClick={getUserLocation}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>📍</span> Use My Location
          </button>
          {locationError && <p className="text-red-500 text-sm mt-1">{locationError}</p>}
        </div>
        
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={routeEnabled}
            onChange={() => {
              setRouteEnabled(!routeEnabled);
              setRoute(null);
            }}
            id="routeToggle"
          />
          <label htmlFor="routeToggle" className="text-gray-700 text-sm">
            Enable Route Planning
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">Map Style</label>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
            onChange={(e) => changeTile(e.target.value)}
          >
            <option>OSM</option>
            <option>Carto Light</option>
            <option>Carto Dark</option>
            <option>Satellite</option>
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

        {/* Route options */}
        {routeEnabled && (
          <>
          

            {route && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-gray-800 mb-2">Route Info</h3>
                <div className="text-sm text-gray-700">
                  <p>Distance: <span className="font-semibold">{route.distance.toFixed(2)} km</span></p>
                  <p>Estimated time: <span className="font-semibold">{route.duration.toFixed(0)} minutes</span></p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Saved places */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Saved Places</label>
            <button 
              onClick={() => setShowSavedPlaces(!showSavedPlaces)}
              className="text-blue-500 text-sm"
            >
              {showSavedPlaces ? "Hide" : "Show"}
            </button>
          </div>
          
          {showSavedPlaces && (
            <div className="mt-2 max-h-40 overflow-y-auto">
              {savedPlaces.length > 0 ? (
                savedPlaces.map((place, index) => (
                  <div 
                    key={index} 
                    className="p-2 text-sm border-b border-gray-200 text-black hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      const lat = parseFloat(place.lat);
                      const lon = parseFloat(place.lon);
                      setCoords([lat, lon]);
                      setQuery(place.display_name);
                    }}
                  >
                    {place.display_name}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm mt-1">No saved places</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Section */}
      <div className="flex-1 relative z-0">
        {/* Search Inputs */}
        {!routeEnabled && (
          <div className="relative mb-4 z-50">
            <div className="flex gap-2">
              <div className="relative flex-1">
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
                    className="absolute right-12 top-3 text-gray-500 hover:text-gray-700 z-50"
                    title="Clear search"
                  >
                    &#10005;
                  </button>
                )}
                {loading && (
                  <div className="absolute right-12 top-3 animate-spin w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full z-50"></div>
                )}
              </div>
              <button
                onClick={savePlace}
                disabled={!query}
                className="px-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                title="Save this place"
              >
                Save
              </button>
            </div>
            
            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md max-h-60 overflow-auto z-[1000] mt-1">
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
          </div>
        )}

        {/* Route Inputs */}
        {routeEnabled && (
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Start */}
            <div className="relative z-50 w-full">
              <label className="block text-sm font-medium mb-1 text-gray-700">Start</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Start location"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700"
                  value={startQuery}
                  onChange={(e) => setStartQuery(e.target.value)}
                />
                {startQuery && (
                  <button
                    onClick={handleClearStart}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 z-50"
                    title="Clear start location"
                  >
                    &#10005;
                  </button>
                )}
              </div>
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
            <div className="relative z-50 w-full">
              <label className="block text-sm font-medium mb-1 text-gray-700">Destination</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Destination location"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700"
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                />
                {destQuery && (
                  <button
                    onClick={handleClearDest}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 z-50"
                    title="Clear destination"
                  >
                    &#10005;
                  </button>
                )}
              </div>
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
            
            {/* Current location marker */}
            {userLocation && (
              <Marker position={userLocation} icon={currentLocationIcon}>
                <Popup>Your current location</Popup>
              </Marker>
            )}
            
            {/* Single location marker */}
            {!routeEnabled && <Marker position={coords} icon={markerIcon} />}
            
            {/* Route markers */}
            {routeEnabled && startCoords && (
              <Marker position={startCoords} icon={startIcon}>
                <Popup>Start location</Popup>
              </Marker>
            )}
            
            {routeEnabled && destCoords && (
              <Marker position={destCoords} icon={endIcon}>
                <Popup>Destination</Popup>
              </Marker>
            )}
            
            {/* Route polyline */}
            {routeEnabled && route && (
              <Polyline positions={route.coordinates} color="blue" weight={4} opacity={0.7} />
            )}
          </MapContainer>
          
          {/* Route loading indicator */}
          {routeLoading && (
            <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md flex items-center gap-2">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-sm">Calculating route...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}