"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup, ZoomControl, } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet";
import { unBound } from "../layout";
import { HiArrowsUpDown } from "react-icons/hi2";
import { FaMapMarkerAlt } from "react-icons/fa";
import { VscThreeBars } from "react-icons/vsc";
import { TiTimes } from "react-icons/ti";
import { useIsSmallScreen } from "../hooks/windowResize";
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Fix for default markers in react-leaflet
// Tell TypeScript that _getIconUrl may exist
declare module "leaflet" {
  interface IconDefault {
    _getIconUrl?: () => string;
  }
}

// Now you can safely delete it
delete (L.Icon.Default.prototype as L.IconDefault)._getIconUrl;

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
type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
};


// Change map view
function ChangeMapView({ coords, zoom }: { coords: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(coords, zoom);
  return null;
}

// const tileUsageData = [
//   { zoom: "5", tiles: 120 },
//   { zoom: "10", tiles: 350 },
//   { zoom: "15", tiles: 780 },
//   { zoom: "20", tiles: 1500 },
// ];




function ScaleControl() {
  const map = useMap();

  useEffect(() => {
    // Add the built-in scale bar (bottom-left)
    const scale = L.control.scale({ imperial: true, metric: true }).addTo(map);

    // Function to log scale info
    const logScale = () => {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const bounds = map.getBounds();

      // Get distance across map (horizontal) in meters
      const west = bounds.getWest();
      const east = bounds.getEast();
      const middleLat = center.lat;

      const distanceMeters = map.distance([middleLat, west], [middleLat, east]);
      const distanceKm = (distanceMeters / 1000).toFixed(2);
      const distanceMiles = (distanceMeters / 1609.34).toFixed(2);
    };

    // Run once & on zoom
    logScale();
    map.on("zoomend", logScale);
    map.on("moveend", logScale);

    return () => {
      scale.remove();
      map.off("zoomend", logScale);
      map.off("moveend", logScale);
    };
  }, [map]);

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
interface MonitoredTileLayerProps {
  url: string;
  attribution: string;
  maxRequestsPerSecond?: number;
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
  const [requestCount, setRequestCount] = useState(0);
  const [startQuery, setStartQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [startSuggestions, setStartSuggestions] = useState<Suggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false)
  // User location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tileCounts, setTileCounts] = useState<{ zoom: number; tiles: number }[]>([]);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState<Suggestion[]>([]);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const isMobile = useIsSmallScreen();
  const [showSidebar, setShowSidebar] = useState(isMobile);
  // Fetch suggestions
  const fetchSuggestions = async (
    q: string,
    setFn: React.Dispatch<React.SetStateAction<Suggestion[]>>,
    setLoadingFn: React.Dispatch<React.SetStateAction<boolean>>,
    signal?: AbortSignal
  ) => {
    if (q.length < 2) {
      setFn([]);
      return;
    }

    setLoadingFn(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { signal }
      );

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data: unknown = await res.json();

      // Type check
      if (Array.isArray(data)) {
        const suggestions: Suggestion[] = data.map((item: NominatimItem) => ({
          lat: item.lat,
          lon: item.lon,
          display_name: item.display_name,
        }));
        setFn(suggestions);
      } else {
        setFn([]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Suggestion fetch error:", err);
      }
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

  function MonitoredTileLayer({
    url,
    attribution,
    onTileLoad,
  }: {
    url: string;
    attribution: string;
    onTileLoad: (zoom: number) => void;
  }) {
    const map = useMap();

    useEffect(() => {
      const tileLayer = L.tileLayer(url, { attribution }).addTo(map);

      tileLayer.on("tileload", (e) => {
        const zoom = map.getZoom();
        onTileLoad(zoom);
      });

      return () => {
        tileLayer.remove();
      };
    }, [map, url, attribution, onTileLoad]);

    return null;
  }


  // const handleTileLoad = (zoom: number) => {
  //   setTileCounts((prev) =>
  //     prev.map((item) =>
  //       item.zoom === zoom ? { ...item, tiles: item.tiles + 1 } : item
  //     )
  //   );
  //   const count = tileCounts.find((item) => item.zoom === zoom)?.tiles ?? 0;
  //   console.log(`Zoom ${zoom}: ${count + 1} tiles loaded`);

  // };
  // Effects

  useEffect(() => {
    // Initialize for all zoom levels you want
    const initialData: { zoom: number; tiles: number }[] = [];
    for (let z = 1; z <= 20; z++) {
      initialData.push({ zoom: z, tiles: 0 });
    }
    setTileCounts(initialData);
  }, []);

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

  useEffect(() => {
    setShowSidebar(isMobile);
  }, [isMobile]);

  // Handlers
  const handleSelectQuery = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setCoords([lat, lon]);
    setQuery(s.display_name);
    setSuggestions([]);
    savePlace();

  };

  const handleSelectStart = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setStartCoords([lat, lon]);
    setStartQuery(s.display_name);
    setStartSuggestions([]);
    savePlace();

  };

  const handleSelectDest = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    setDestCoords([lat, lon]);
    setDestQuery(s.display_name);
    setDestSuggestions([]);
    savePlace();

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
    <div className="flex flex-col md:flex-row h-screen w-full max-w-full mx-auto bg-gray-50 shadow-lg">
      {/* Sidebar */}
      <div className={`w-[80%] md:w-80 bg-white p-4 shadow-md flex-shrink-0 overflow-y-auto max-h-screen md:relative fixed top-0 left-0 h-full z-50 transition-all ${!showSidebar ? "translate-x-0" : "-translate-x-full"}`}>
        <h2 className={`text-2xl font-bold mb-4 text-gray-800 ${unBound.className} `}>Map Sentinel</h2>
        <button className="absolute right-4 top-4 md:hidden block" onClick={() => setShowSidebar(!showSidebar)}>
          <TiTimes className="text-2xl font-bold text-gray-700" />
        </button>
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
          <label className="block text-lg font-bold mb-1 text-gray-700">Map Style</label>
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

        {/* <div className="mb-4">
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
        </div> */}

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
          <div className="flex items-center justify-between mb-2">
            <label className="text-lg font-bold text-gray-700">Saved Places</label>
            <button
              onClick={() => setShowSavedPlaces(!showSavedPlaces)}
              className="text-blue-500 text-sm hover:underline"
            >
              {showSavedPlaces ? "Hide" : "Show"}
            </button>
          </div>

          {showSavedPlaces && (
            <div className="mt-2 max-h-52 overflow-y-auto border border-gray-200 rounded-lg">
              {savedPlaces.length > 0 ? (
                savedPlaces.map((place, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                    onClick={() => {
                      const lat = parseFloat(place.lat);
                      const lon = parseFloat(place.lon);
                      setCoords([lat, lon]);
                      setQuery(place.display_name);
                    }}
                  >
                    <span className="text-red-500">
                      📍
                    </span>
                    <span className="font-medium text-gray-800">{place.display_name}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm p-3">No saved places</p>
              )}
            </div>
          )}
        </div>

        {/* Bar Chart Section */}
        {/* <div className="absolute left-0 bottom-0 w-full flex flex-col justify-center items-center bg-white shadow-md rounded-t-lg p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Tile Usage by Zoom</h3>
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tileUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zoom" label={{ value: "Zoom Level", position: "insideBottom", offset: -5 }} />
                <YAxis label={{ value: "Tiles Loaded", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Bar dataKey="tiles" fill="#3b82f6" name="Tiles Loaded" />
              </BarChart>
            </ResponsiveContainer>

          </div>
        </div> */}


      </div>

      {/* <div className="max-w-[calc(100% - 80px)] w-full h-screen"> */}
      {!routeEnabled && (
        <div className="absolute left-0 px-2 md:px-4 w-full md:max-w-[calc(100%-20rem)] ml-auto right-0 my-2 md:mt-4 z-40">
          <div className="flex relative items-center gap-2 justify-between">
            {/* Search box - smaller */}
            <div className="relative flex-1 mx-auto max-w-sm">
              <button className="absolute left-1   top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 md:hidden block"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <VscThreeBars className="text-2xl font-bold text-gray-700" />
              </button>
              <input
                type="text"
                placeholder="Search place"
                className=" bg-white px-4 py-3 rounded-full shadow-md border border-gray-200 text-gray-700 text-sm focus:outline-none 
                pr-10 focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all placeholder-gray-400 md:w-full w-[85%] md:ml-0 ml-13"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {/* Clear Button */}
              {query && (
                <button
                  onClick={handleClearQuery}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  title="Clear search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Loading Spinner */}
              {loading && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 animate-spin w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full"></div>
              )}
              {suggestions.length > 0 && (
                <ul className="absolute  top-full left-6 md:left-0 bg-white border border-gray-200 rounded-lg shadow-md max-h-60 overflow-auto z-[1000] mt-1 w-full max-w-sm">
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


            {/* Help Button */}
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 h-10 w-10 flex justify-center items-center font-semibold bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition text-2xl"
            >
              ?
            </button>
          </div>

          {/* Suggestions dropdown */}

        </div>
      )}
      {routeEnabled && (
        <div className="relative md:absolute left-0 md:left-28 md:right-0 my-2 md:mt-4 px-2 md:px-4 z-50 flex justify-between">
          <div className="bg-white flex gap-4 rounded-xl mx-auto justify-center items-center p-4 shadow-md w-full max-w-lg border border-gray-200">

            {/* Icons column */}
            <div className="flex flex-col items-center h-full">
              <span className="text-gray-600 text-lg">○</span>
              <div className="flex-1 border-l-2 border-dotted border-gray-500 mb-2"></div>
              <FaMapMarkerAlt className="text-red-600 text-lg" />
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-3 w-full">
              {/* Start input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Your location"
                  className="w-full bg-white px-4 py-3 rounded-full shadow-md border border-gray-200 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all placeholder-gray-400"
                  value={startQuery}
                  onChange={(e) => setStartQuery(e.target.value)}
                />
                {startQuery && (
                  <button
                    onClick={handleClearStart}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    title="Clear start location"
                  >
                    ✕
                  </button>
                )}
                {startSuggestions.length > 0 && (
                  <ul className="absolute mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md max-h-40 overflow-auto z-[1070]">
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

              {/* Destination input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Destination location"
                  className="w-full bg-white px-4 py-3 rounded-full shadow-md border border-gray-200 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all placeholder-gray-400"
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                />
                {destQuery && (
                  <button
                    onClick={handleClearDest}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    title="Clear destination"
                  >
                    ✕
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

            {/* Swap button */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg">
              <HiArrowsUpDown className="text-2xl font-bold text-gray-700" />
            </button>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 h-10 w-10 max-sm:hidden flex justify-center items-center font-semibold bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition text-2xl"
          >
            ?
          </button>
        </div>
      )}

      {/* Map Section */}
      <div className="flex-1 relative z-0">
        {/* Route Inputs */}

        {/* Map */}
        <div className="w-full overflow-hidden shadow-lg border border-gray-200 h-[100%] relative">

          <MapContainer center={coords} zoom={zoom} style={{ height: "100%", width: "100%" }} zoomControl={false} >

            <TileLayer url={tileUrl} attribution={tileAttribution} />
            <ZoomControl position="bottomright" />
            <ChangeMapView coords={coords} zoom={zoom} />
            {/* <MapLogger />   */}
            <ScaleControl />


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
          {/* Help Modal */}
          {showHelp && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
              <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
                <h2 className="text-lg font-bold mb-3 text-gray-800">How to Use Map Sentinel 🗺️</h2>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-2">
                  <li>Use the search bar to find locations.</li>
                  <li>Click 📍 to use your current location.</li>
                  <li>Enable route planning to select start & destination.</li>
                  <li>Change map style (OSM, Satellite, Dark, etc.) from sidebar.</li>
                </ul>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}