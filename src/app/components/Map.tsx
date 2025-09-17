"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup, ZoomControl, useMapEvents, } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet";
import { unBound } from "../layout";
import { HiArrowsUpDown } from "react-icons/hi2";
import { FaMapMarkerAlt } from "react-icons/fa";
import { VscThreeBars } from "react-icons/vsc";
import { TiTimes } from "react-icons/ti";
import { useIsSmallScreen } from "../hooks/windowResize";
import { Download } from "lucide-react";
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
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

function ClickHandler({
  setMarker,
  setClickedLocation,
}: {
  setMarker: (pos: [number, number]) => void;
  setClickedLocation: (loc: Suggestion | null) => void;
}) {
  useMapEvents({
    async click(e) {
      const pos: [number, number] = [e.latlng.lat, e.latlng.lng];
      console.log("Clicked location:", pos);

      setMarker(pos);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos[0]}&lon=${pos[1]}&format=json`,
          {
            headers: {
              "Accept": "application/json",
              "User-Agent": "MapSentinelApp/1.0", // required by Nominatim policy
            },
            mode: "cors",
          }
        );

        const data = await res.json();
        if (data && data.display_name) {
          setClickedLocation({
            lat: pos[0].toString(),
            lon: pos[1].toString(),
            display_name: data.display_name,
          });
        }
      } catch (err) {
        console.error("Reverse geocode error:", err);
        setClickedLocation(null);
      }
    },
  });
  return null;
}



// Change map view
function ChangeMapView({ coords, zoom }: { coords: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(coords, zoom);
  }, [coords, zoom, map]);

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
  attribution?: string;
  trackTileRequest: (tiles: number, action: string) => void;
  tileUsage: { todayRequests: number; limit: number };
  setLimitReached: React.Dispatch<React.SetStateAction<boolean>>;
}

type TileUsage = {
  totalRequests: number;
  todayRequests: number;
  lastHour: number;
  limit: number;
  requestsToday: { timestamp: number; tiles: number; zoom: number }[];
  currentSession: number;
};

type TileRequest = {
  timestamp: number;
  tiles: number;
  zoom: number;
  layer: string;
  position: [number, number];
  action: string;
};


const MonitoredTileLayer: React.FC<MonitoredTileLayerProps> = ({ url, attribution, trackTileRequest, tileUsage, setLimitReached, }) => {
  const map = useMap();
  useEffect(() => {
    // Check if a layer with this attribution already exists to prevent duplicates
    let tileLayer: L.TileLayer | null = null;
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer && layer.options.attribution === attribution) {
        tileLayer = layer;
      }
    });

    if (!tileLayer) {
      tileLayer = L.tileLayer(url, { attribution }).addTo(map);
    }

    const handleTileLoad = () => {
      if (tileUsage.todayRequests >= tileUsage.limit) {
        // Stop loading new tiles once limit is reached
        if (tileLayer) {
          map.removeLayer(tileLayer);
          console.warn("Tile limit reached. No more tiles will load.");
          setLimitReached(true)
        }
        return;
      }
      trackTileRequest(1, 'tileload');
    };
    tileLayer.on("tileload", handleTileLoad);

    return () => {
      tileLayer?.off("tileload", handleTileLoad);
    };
  }, [map, url, attribution, trackTileRequest]);
  return null;
};



export default function MapComponent() {
  const [coords, setCoords] = useState<[number, number]>([28.6139, 77.209]); // default view (Delhi)
  const [zoom, setZoom] = useState(13);
  const [tileUrl, setTileUrl] = useState("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  const [tileAttribution, setTileAttribution] = useState(
    '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
  );
  const [activeLayer, setActiveLayer] = useState('osm');

  const [marker, setMarker] = useState<[number, number] | null>(null);


  const [routeEnabled, setRouteEnabled] = useState(false);
  const [transportMode, setTransportMode] = useState<"driving" | "walking" | "cycling">("driving");
  const [tileUsage, setTileUsage] = useState({
    totalRequests: 0,
    todayRequests: 0,
    lastHour: 0,
    limit: 10000,
    requestsToday: [] as TileRequest[],
    currentSession: 0
  });

  // Single search
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [clickedLocation, setClickedLocation] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(10);

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
  const [limitReached, setLimitReached] = useState(false);

  // User location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tileCounts, setTileCounts] = useState<{ zoom: number; tiles: number }[]>([]);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState<Suggestion[]>([]);
  const [showSavedPlaces, setShowSavedPlaces] = useState(true);
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
        const suggestions: Suggestion[] = data.map((item: {
          display_name: string;
          lat: string;
          lon: string;
          // add other properties if you use them
        }) => ({
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

  const trackTileRequest = useCallback((tiles = 1, action = 'unknown') => {
    if (!isMonitoring) return;

    setTileUsage((prev) => {
      const newRequest: TileRequest = {
        timestamp: Date.now(),
        tiles,
        zoom: zoomLevel,
        layer: activeLayer,
        position: [coords[0], coords[1]],
        action,
      };
      return {
        ...prev,
        totalRequests: prev.totalRequests + tiles,
        todayRequests: prev.todayRequests + tiles,
        lastHour: prev.lastHour + tiles,
        currentSession: prev.currentSession + tiles,
        requestsToday: [...prev.requestsToday.slice(-99), newRequest]
      };
    });
  }, [isMonitoring, zoomLevel, activeLayer, coords]);

  function ZoomWatcher({ setZoomLevel }: { setZoomLevel: (z: number) => void }) {
    const map = useMap();

    useEffect(() => {
      const handleZoom = () => {
        setZoomLevel(map.getZoom());
      };

      map.on("zoomend", handleZoom);
      setZoomLevel(map.getZoom()); // initialize with current zoom

      return () => {
        map.off("zoomend", handleZoom);
      };
    }, [map, setZoomLevel]);

    return null;
  }



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
    setMarker([lat, lon]); // always update marker here

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

  const swapLocations = () => {
    // Swap coordinates
    const tempCoords = startCoords;
    setStartCoords(destCoords);
    setDestCoords(tempCoords);

    // Swap search queries (display names)
    const tempQuery = startQuery;
    setStartQuery(destQuery);
    setDestQuery(tempQuery);
  };

  const memoizedMonitoredTileLayer = useMemo(() => (
    <MonitoredTileLayer
      url={tileUrl}
      attribution={tileAttribution}
      trackTileRequest={trackTileRequest}
      tileUsage={tileUsage}
      setLimitReached={setLimitReached}
    />
  ), [tileUrl, tileAttribution, trackTileRequest]);

  const handleDownloadReport = () => {
    // Define tileLayers, currentPosition, and mapControls here or get them from state/props
    const tileLayers = {
      'osm': { name: 'OSM' },
      'cartoLight': { name: 'Carto Light' },
      // ... add other layers to match your options
    };
    const currentPosition = coords;
    const mapControls = {
      zoom: true,
      scale: true,
      // ... add other controls as needed
    };

    const report = {
      period: "24 Hours",
      totalTileRequests: tileUsage.todayRequests,
      sessionRequests: tileUsage.currentSession,
      averagePerHour: Math.round(tileUsage.todayRequests / 24),
      mostUsedZoom: zoomLevel,
      mostUsedLayer: activeLayer,
      efficiency: ((tileUsage.limit - tileUsage.todayRequests) / tileUsage.limit * 100).toFixed(1),
      recentRequests: tileUsage.requestsToday.slice(-10),
    };

    const reportText = `OpenStreetMap Usage Report - ${new Date().toLocaleDateString()}

=== SUMMARY ===
Period: ${report.period}
Total Tile Requests: ${report.totalTileRequests.toLocaleString()}
Session Requests: ${report.sessionRequests.toLocaleString()}
Average Per Hour: ${report.averagePerHour.toLocaleString()}
Current Zoom Level: ${report.mostUsedZoom}
Average Per Hour: ${report.averagePerHour.toLocaleString()}
Efficiency: ${report.efficiency}%
Usage Limit: ${tileUsage.limit.toLocaleString()}

=== RECENT ACTIVITY ===
${report.recentRequests
        .map(
          (req) =>
            `${new Date(req.timestamp).toLocaleTimeString()} | ${req.tiles
              .toString()
              .padStart(3)} tiles | ${req.action.padEnd(15)} | ${req.layer || 'Unknown'
            } | Zoom ${req.zoom}`
        )
        .join("\n")}

=== CURRENT STATUS ===
Monitoring: ${isMonitoring ? "ACTIVE" : "PAUSED"}
Map Position: ${currentPosition[0].toFixed(4)}, ${currentPosition[1].toFixed(4)}
Controls: ${Object.entries(mapControls)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name)
        .join(", ")}

Generated: ${new Date().toLocaleString()}`;

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `osm-usage-report-${new Date()
      .toISOString()
      .split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
      case "OpenTopoMap":
        setTileUrl("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png");
        setTileAttribution('Map data: &copy; <a href="https://www.openstreetmap.org/">OSM</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>');
        break;
      case "Esri Streets":
        setTileUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}");
        setTileAttribution("Tiles &copy; Esri &copy; OpenStreetMap contributors");
        break;
      case "Transit":
        setTileUrl("https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=5b376f4b498b4b18a4e0aa7c5d39e3e9");
        setTileAttribution('Map data &copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors, Tiles &copy; Thunderforest');
        break;
      case "Terrain":
        setTileUrl("https://tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=5b376f4b498b4b18a4e0aa7c5d39e3e9");
        setTileAttribution('Map data &copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors, Tiles &copy; Thunderforest');
        break;
    }
  };



  return (
    <div className="flex flex-col md:flex-row h-screen w-full max-w-full mx-auto bg-gray-50 shadow-lg">
      {/* Sidebar */}
      <div
        className={`w-[80%] md:w-80 bg-white p-5 shadow-xl flex-shrink-0 overflow-y-auto max-h-screen md:relative fixed top-0 left-0 h-full z-50 transition-all ${!showSidebar ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-2xl font-bold text-gray-800 ${unBound.className}`}>
            Map Sentinel
          </h2>
          <button
            className="md:hidden block"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <TiTimes className="text-2xl font-bold text-gray-600 hover:text-gray-800 transition" />
          </button>
        </div>

        {/* Location */}
        <div className="mb-6">
          <button
            onClick={getUserLocation}
            className="w-full bg-blue-500 text-white py-2.5 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>📍</span> Use My Location
          </button>
          {locationError && (
            <p className="text-red-500 text-sm mt-2">{locationError}</p>
          )}
        </div>

        {/* Route Toggle */}
        <div className="flex items-center gap-3 mb-6 bg-gray-50 p-3 rounded-lg shadow-sm">
          <input
            type="checkbox"
            id="routeToggle"
            checked={routeEnabled}
            onChange={() => {
              setRouteEnabled(!routeEnabled);
              setRoute(null);
            }}
            className="w-5 h-5 accent-green-600 cursor-pointer"
          />
          <label
            htmlFor="routeToggle"
            className="text-gray-800 font-medium cursor-pointer select-none"
          >
            {routeEnabled ? "Route Planning Enabled" : "Enable Route Planning"}
          </label>
        </div>

        {/* Map Style */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Map Style
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400"
            onChange={(e) => changeTile(e.target.value)}
          >
            <option>OSM</option>
            <option>Carto Light</option>
            <option>Carto Dark</option>
            <option>Satellite</option>
            <option>Transit</option>
            <option>Terrain</option>
            <option>OpenTopoMap</option>
            <option>Esri Streets</option>
          </select>
        </div>

        {/* Saved Places */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Saved Places</h3>
          {showSavedPlaces && (
            <div className="mt-2 max-h-52 overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
              {savedPlaces.length > 0 ? (
                savedPlaces.map((place, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 hover:bg-gray-100 cursor-pointer border-b last:border-none"
                    onClick={() => {
                      const lat = parseFloat(place.lat);
                      const lon = parseFloat(place.lon);
                      setCoords([lat, lon]);
                      setQuery(place.display_name);
                    }}
                  >
                    <span className="text-red-500">📍</span>
                    <span className="font-medium text-gray-800 text-sm">
                      {place.display_name}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm p-3">No saved places</p>
              )}
            </div>
          )}
        </div>

        {/* Tile Usage Card */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-6">
          <div className="flex items-center mb-4">
            <h2 className="text-base font-bold text-gray-900">Tile Usage</h2>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-gray-700 mb-1 text-sm">
              <span>Today</span>
              <span
                className={`font-semibold ${tileUsage.todayRequests > tileUsage.limit
                  ? "text-red-500"
                  : "text-gray-900"
                  }`}
              >
                {tileUsage.todayRequests}/{tileUsage.limit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${tileUsage.todayRequests > tileUsage.limit
                  ? "bg-red-500"
                  : "bg-blue-500"
                  }`}
                style={{
                  width: `${Math.min(
                    (tileUsage.todayRequests / tileUsage.limit) * 100,
                    100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {tileUsage.totalRequests}
              </p>
              <p className="text-gray-500 text-xs">Total</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {tileUsage.lastHour}
              </p>
              <p className="text-gray-500 text-xs">Last Hour</p>
            </div>
          </div>

          <div className="my-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Zoom Level:{" "}
              <span className="text-gray-900 font-bold">{zoomLevel}</span>
            </h3>
          </div>

        </div>
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

            <button
              onClick={handleDownloadReport}
              className="max-sm:hidden flex items-center px-4 py-2 bg-[#6D8196] text-white rounded-lg hover:bg-[#46515A] text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </button>
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
        <div className="relative md:absolute left-0 md:left-28 md:right-0 my-2 md:mt-4 px-2 md:px-4 z-50 flex justify-between items-start">
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
            <button
              onClick={swapLocations}
              className="flex items-center justify-center w-10 h-10 rounded-lg">
              <HiArrowsUpDown className="text-2xl font-bold text-gray-700" />
            </button>
          </div>
          <button
            onClick={handleDownloadReport}
            className="max-sm:hidden flex items-center px-4 py-2 h-9 mr-5 bg-[#6D8196] text-white rounded-lg hover:bg-[#46515A] text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 h-10 w-10 max-sm:hidden flex justify-center items-center font-semibold bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition text-2xl"
          >
            ?
          </button>
        </div>
      )}
      {route && routeEnabled && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[80%] max-w-sm z-50">
          <div className="backdrop-blur-lg bg-white border border-gray-200 rounded-2xl shadow-xl p-4 animate-fade-in hover:scale-105 transition-transform duration-300">

            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Route Info
              </h3>
              <button
                onClick={() => setRoute(null)}
                className="text-gray-600 hover:text-red-600 transition text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Info Section */}
            <div className="grid grid-cols-2 gap-4">

              {/* Distance */}
              <div className="flex flex-col">
                <p className="text-xs text-gray-500">Distance</p>
                <p className="text-sm font-semibold text-gray-900">
                  {route.distance.toFixed(2)} km
                </p>
              </div>

              {/* Duration */}
              <div className="flex flex-col">
                <p className="text-xs text-gray-500">Estimated Time</p>
                <p className="text-sm font-semibold text-gray-900">
                  {route.duration.toFixed(0)} min
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {limitReached && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
            🚫 Daily tile request limit reached. No more tiles will load.
          </div>
        </div>
      )}

      <div className="absolute bottom-8 right-12 w-[85%] max-w-xs z-50">
        <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md flex flex-row justify-between items-center gap-3 px-3 py-2 border border-gray-200">
          {/* Zoom */}
          <div className="text-center">
            <h3 className="text-[10px] font-medium text-gray-500">Zoom</h3>
            <p className="text-sm font-semibold text-gray-800">{zoomLevel}</p>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300"></div>

          {/* Tiles */}
          <div className="text-center">
            <h3 className="text-[10px] font-medium text-gray-500">Tiles</h3>
            <p className="text-sm font-semibold text-blue-600">{tileUsage.totalRequests}</p>
          </div>
        </div>
      </div>

      {clickedLocation && !routeEnabled && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white shadow-xl rounded-xl p-4 border border-gray-200 w-[90%] max-w-sm z-50 animate-slide-up">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-800 mb-2 text-lg">Selected Location</h3>
              <p className="text-sm text-gray-600 mb-2">{clickedLocation.display_name}</p>
              {/* <div className="text-sm text-gray-500 space-y-1">
                  <p>Latitude: <span className="font-medium">{parseFloat(clickedLocation.lat).toFixed(6)}</span></p>
                  <p>Longitude: <span className="font-medium">{parseFloat(clickedLocation.lon).toFixed(6)}</span></p>
                </div> */}
            </div>
            <button
              onClick={() => setClickedLocation(null)}
              className="text-gray-400 hover:text-gray-700 ml-2"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setDestCoords([parseFloat(clickedLocation.lat), parseFloat(clickedLocation.lon)]);
                setDestQuery(clickedLocation.display_name);
                setRouteEnabled(true);
              }}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              Directions
            </button>
            <button
              onClick={() => {
                setSavedPlaces([...savedPlaces, clickedLocation]);
                localStorage.setItem("savedPlaces", JSON.stringify([...savedPlaces, clickedLocation]));
              }}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Save
            </button>
          </div>
        </div>
      )}




      {/* Map Section */}
      <div className="flex-1 relative z-0">
        {/* Route Inputs */}

        {/* Map */}
        <div className="w-full overflow-hidden shadow-lg border border-gray-200 h-[100%] relative">

          <MapContainer
            center={coords}
            zoom={zoom}
            scrollWheelZoom={true}
            className="w-full h-full"
            zoomControl={false}
          >
            <ClickHandler setMarker={setMarker} setClickedLocation={setClickedLocation} />
            <ChangeMapView coords={coords} zoom={zoom} />
            <ZoomControl position="bottomright" />
            <ScaleControl />
            {memoizedMonitoredTileLayer}
            {marker && !routeEnabled && (
              <Marker position={marker} icon={markerIcon}>
                <Popup>
                  {clickedLocation ? (
                    <div>
                      <strong>{clickedLocation.display_name}</strong>
                      <br />
                      <span className="text-xs text-gray-500">Lat: {clickedLocation.lat}, Lon: {clickedLocation.lon}</span>
                    </div>
                  ) : (
                    <span>Clicked Location</span>
                  )}
                </Popup>
              </Marker>
            )}
            <ZoomWatcher setZoomLevel={setZoomLevel} />

            {userLocation && (
              <Marker position={userLocation} icon={currentLocationIcon}>
                <Popup>Current Location</Popup>
              </Marker>
            )}
            {startCoords && (
              <Marker position={startCoords} icon={startIcon}>
                <Popup>Start: {startQuery}</Popup>
              </Marker>
            )}
            {destCoords && (
              <Marker position={destCoords} icon={endIcon}>
                <Popup>Destination: {destQuery}</Popup>
              </Marker>
            )}
            {route && (
              <Polyline pathOptions={{ color: 'blue', weight: 6, opacity: 0.7 }} positions={route.coordinates} />
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
    </div >
  );
}