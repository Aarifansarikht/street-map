'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Activity, BarChart3, Settings, Download, AlertCircle, Layers, ZoomIn, ZoomOut } from 'lucide-react';
import { Map, TileLayer } from 'leaflet';


type TileRequest = {
    timestamp: number;
    tiles: number;
    zoom: number;
    layer: string;
    position: [number, number]; // strict tuple
    action: string;
};

type TileUsage = {
    totalRequests: number;
    todayRequests: number;
    lastHour: number;
    currentSession: number;
    requestsToday: TileRequest[];
    limit: number;              // ✅ must be included
};

const OpenStreetMapApp = () => {
    const mapRef = useRef(null);
    const leafletLoadedRef = useRef(false);
    const initialTileUsage: TileUsage = {
        totalRequests: 0,
        todayRequests: 0,
        lastHour: 0,
        currentSession: 0,
        requestsToday: [], // ✅ now typed as TileRequest[]
        limit: 100,
    };
    const [tileUsage, setTileUsage] = useState<TileUsage>(initialTileUsage);


    // const [tileUsage, setTileUsage] = useState({
    //     totalRequests: 0,
    //     todayRequests: 0,
    //     lastHour: 0,
    //     limit: 10000,
    //     requestsToday: [],
    //     currentSession: 0
    // });

    const [isMonitoring, setIsMonitoring] = useState(true);
    const [mapControls, setMapControls] = useState({
        zoom: true,
        // layers: true,
        // fullscreen: true,
        attribution: true
    });

    const [currentPosition, setCurrentPosition] = useState<[number, number]>([28.6139, 77.2090]); // example: Delhi
    const [zoomLevel, setZoomLevel] = useState(10);
    const [activeLayer, setActiveLayer] = useState<LayerKey>('osm');
    const [mapReady, setMapReady] = useState(false);

    const tileLayerRef = useRef<TileLayer | null>(null);
    const mapInstanceRef = useRef<Map | null>(null);

    type LayerKey = keyof typeof tileLayers;

    // Available tile layers
    const tileLayers = {
        osm: {
            name: 'OpenStreetMap',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors'
        },
        satellite: {
            name: 'Satellite (Esri)',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics'
        },
        // terrain: {
        //     name: 'Terrain (Stamen)',
        //     url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
        //     attribution: '© Stamen Design, © OpenStreetMap contributors'
        // },
        topo: {
            name: 'OpenTopoMap',
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution: '© OpenTopoMap contributors'
        }
    };

    // Track tile requests
    const trackTileRequest = useCallback((tiles = 1, action = 'unknown') => {
        if (!isMonitoring) return;

        setTileUsage((prev: TileUsage) => {
            const newRequest: TileRequest = {
                timestamp: Date.now(),
                tiles: tiles,
                zoom: zoomLevel,
                layer: activeLayer,
                position: [currentPosition[0], currentPosition[1]], // ✅ tuple enforced
                action: action,
            };

            return {
                ...prev,
                totalRequests: prev.totalRequests + tiles,
                todayRequests: prev.todayRequests + tiles,
                lastHour: prev.lastHour + tiles,
                currentSession: prev.currentSession + tiles,
                requestsToday: [...prev.requestsToday.slice(-99), newRequest],
            };
        });
    }, [isMonitoring, zoomLevel, activeLayer, currentPosition]);

    // Load Leaflet CSS and JS
    useEffect(() => {
        if (leafletLoadedRef.current) return;

        // Add Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
        document.head.appendChild(link);

        // Add Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
        script.onload = () => {
            leafletLoadedRef.current = true;
            initializeMap();
        };
        document.head.appendChild(script);

        return () => {
            if (link.parentNode) link.parentNode.removeChild(link);
            if (script.parentNode) script.parentNode.removeChild(script);
        };
    }, []);
    const initializeMap = () => {
        if (!window.L || !mapRef.current || mapInstanceRef.current) return;

        try {
            // Create map instance
            const map = window.L.map(mapRef.current, {
                center: currentPosition as [number, number],
                zoom: zoomLevel,
                zoomControl: mapControls.zoom,
                attributionControl: mapControls.attribution,
            });

            // Add initial tile layer
            const initialLayer = window.L.tileLayer((tileLayers)[activeLayer].url, {
                attribution: (tileLayers)[activeLayer].attribution,
                maxZoom: 18,
            }).addTo(map);

            // Keep a ref to the tile layer if needed
            tileLayerRef.current = initialLayer;

            // Add marker
            const marker = window.L.marker(currentPosition).addTo(map);
            marker.bindPopup(
                `<b>Current Location</b><br>Lat: ${currentPosition[0]}<br>Lng: ${currentPosition[1]}`
            );

            // Zoom event
            map.on("zoomend", () => {
                const newZoom = map.getZoom();
                setZoomLevel(newZoom);
                const tilesEstimate = Math.pow(4, Math.max(0, newZoom - 6));
                trackTileRequest(tilesEstimate, "zoom");
            });

            // Pan event
            map.on("moveend", () => {
                const center = map.getCenter();
                setCurrentPosition([center.lat, center.lng]);

                marker.setLatLng([center.lat, center.lng]);
                marker.setPopupContent(
                    `<b>Current Location</b><br>Lat: ${center.lat.toFixed(
                        4
                    )}<br>Lng: ${center.lng.toFixed(4)}`
                );

                trackTileRequest(8, "pan");
            });

            // Layer change event (only if control is added)
            map.on("baselayerchange", () => {
                trackTileRequest(Math.pow(4, Math.max(0, zoomLevel - 6)), "layer-change");
            });

            // Trigger after initial load
            map.whenReady(() => {
                trackTileRequest(Math.pow(4, Math.max(0, zoomLevel - 6)), "initial-load");
            });

            // Save map instance
            mapInstanceRef.current = map;
            setMapReady(true);

        } catch (error) {
            console.error("Error initializing map:", error);
            setMapReady(false);
        }
    };


    // Handle zoom changes
    const handleZoomChange = (delta: number) => {
        if (mapInstanceRef.current) {
            const newZoom = Math.max(1, Math.min(18, zoomLevel + delta));
            mapInstanceRef.current.setZoom(newZoom);
        }
    };

    // Handle layer changes
    const handleLayerChange = (layerKey: LayerKey) => {
        if (mapInstanceRef.current && window.L) {
            const map = mapInstanceRef.current;

            // Remove current layer
            if (tileLayerRef.current) {
                map.removeLayer(tileLayerRef.current);
            }

            // Add new layer
            const newLayer = window.L.tileLayer(tileLayers[layerKey].url, {
                attribution: tileLayers[layerKey].attribution,
                maxZoom: 18,
            });
            newLayer.addTo(map);
            tileLayerRef.current = newLayer; // ✅ keep track of active layer

            setActiveLayer(layerKey);

            // track tile usage (example formula kept from your code)
            trackTileRequest(Math.pow(4, Math.max(0, zoomLevel - 6)), "layer-switch");
        }
    };
    type ControlKey = "zoom" | "attribution"; // add 'layers' | 'fullscreen' if needed


    // Toggle map controls
    const toggleControl = (control: ControlKey) => {
        setMapControls(prev => {
            const newControls = { ...prev, [control]: !prev[control] };

            if (mapInstanceRef.current) {
                const map = mapInstanceRef.current;
                switch (control) {
                    case 'zoom':
                        if (newControls.zoom) {
                            map.zoomControl.addTo(map);
                        } else {
                            map.removeControl(map.zoomControl);
                        }
                        break;
                    case 'attribution':
                        if (newControls.attribution) {
                            map.attributionControl.addTo(map);
                        } else {
                            map.removeControl(map.attributionControl);
                        }
                        break;
                    // case 'layers':
                    //     if (newControls.layers) {
                    //         map.layersControl.addTo(map);
                    //     } else {
                    //         map.removeControl(map.layersControl);
                    //     }
                    //     break;
                    // case 'fullscreen':
                    //     if (newControls.fullscreen) {
                    //         map.fullscreenControl.addTo(map);
                    //     } else {
                    //         map.removeControl(map.fullscreenControl);
                    //     }
                    //     break;
                }
            }

            return newControls;
        });
    };

    // Add custom location button
    const goToLocation = () => {
        if (navigator.geolocation && mapInstanceRef.current) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                const newPos: [number, number] = [latitude, longitude]; // ✅ tuple
                mapInstanceRef.current!.setView(newPos, zoomLevel);
                setCurrentPosition(newPos);
                trackTileRequest(4, 'geolocation');
            }, (error) => {
                console.error('Geolocation error:', error);
                // Fallback to a major city
                const fallbackPos: [number, number] = [40.7128, -74.0060]; // New York
                mapInstanceRef.current!.setView(fallbackPos, zoomLevel);
                setCurrentPosition(fallbackPos);
            });
        }
    };

    // Generate usage report
    const generateReport = () => {
        const report = {
            period: '24 Hours',
            totalTileRequests: tileUsage.todayRequests,
            sessionRequests: tileUsage.currentSession,
            averagePerHour: Math.round(tileUsage.todayRequests / 24),
            mostUsedZoom: zoomLevel,
            mostUsedLayer: activeLayer,
            efficiency: ((tileUsage.limit - tileUsage.todayRequests) / tileUsage.limit * 100).toFixed(1),
            recentRequests: tileUsage.requestsToday.slice(-10)
        };

        const reportText = `OpenStreetMap Usage Report - ${new Date().toLocaleDateString()}
    
=== SUMMARY ===
Period: ${report.period}
Total Tile Requests: ${report.totalTileRequests.toLocaleString()}
Session Requests: ${report.sessionRequests.toLocaleString()}
Average Per Hour: ${report.averagePerHour.toLocaleString()}
Current Zoom Level: ${report.mostUsedZoom}
Active Layer: ${tileLayers[report.mostUsedLayer as LayerKey].name}
Efficiency: ${report.efficiency}%
Usage Limit: ${tileUsage.limit.toLocaleString()}

=== RECENT ACTIVITY ===
${report.recentRequests.map(req =>
            // `${new Date(req.timestamp).toLocaleTimeString()} | ${req.tiles.toString().padStart(3)} tiles | ${req.action.padEnd(15)} | Zoom ${req.zoom}`
            `${new Date(req.timestamp).toLocaleTimeString()} | ${req.tiles.toString().padStart(3)} tiles | ${req.action.padEnd(15)} | ${tileLayers[req.layer as LayerKey].name} | Zoom ${req.zoom}`
        ).join('\n')}

=== CURRENT STATUS ===
Monitoring: ${isMonitoring ? 'ACTIVE' : 'PAUSED'}
Map Position: ${currentPosition[0].toFixed(4)}, ${currentPosition[1].toFixed(4)}
Controls: ${Object.entries(mapControls).filter(([_, enabled]) => enabled).map(([name, _]) => name).join(', ')}

Generated: ${new Date().toLocaleString()}`;

        // Create and download report
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `osm-usage-report-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const usagePercentage = (tileUsage.todayRequests / tileUsage.limit) * 100;
    const isNearLimit = usagePercentage > 80;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <MapPin className="h-8 w-8 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Leaflet OSM Map</h1>
                                <p className="text-sm text-gray-600">Real OpenStreetMap with Tile Usage Monitoring</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-600">
                                Session: <span className="font-medium text-blue-600">{tileUsage.currentSession}</span> tiles
                            </div>
                            <button
                                onClick={() => setIsMonitoring(!isMonitoring)}
                                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isMonitoring
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <Activity className="h-4 w-4 mr-2" />
                                {isMonitoring ? 'Monitoring ON' : 'Monitoring OFF'}
                            </button>
                            <button
                                onClick={generateReport}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Export Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Usage Statistics & Controls */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Tile Usage Stats */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center  gap-2 mb-4">
                            <BarChart3 className="h-5 w-5 text-gray-400" />
                            <h3 className="text-lg font-semibold text-gray-900">Tile Usage</h3>

                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className='text-gray-900'>Today&aposs Usage</span>
                                    <span className={isNearLimit ? 'text-red-600 font-medium' : 'text-gray-600'}>
                                        {tileUsage.todayRequests.toLocaleString()}/{tileUsage.limit.toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${isNearLimit ? 'bg-red-500' : 'bg-blue-500'
                                            }`}
                                        style={{ width: `${Math.min(100, usagePercentage)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {isNearLimit && (
                                <div className="flex items-start p-3 bg-red-50 rounded-lg border border-red-200">
                                    <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium text-red-800">Usage Warning</p>
                                        <p className="text-red-700">Approaching daily tile limit</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{tileUsage.totalRequests.toLocaleString()}</p>
                                    <p className="text-xs text-gray-600">Total Requests</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{tileUsage.lastHour}</p>
                                    <p className="text-xs text-gray-600">Last Hour</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Map Controls */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center  gap-2 mb-4">
                            <Settings className="h-5 w-5 text-gray-400" />
                            <h3 className="text-lg font-semibold text-gray-900">Map Controls</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-2">Layer Selection</label>
                                <select
                                    value={activeLayer}
                                    onChange={(e) => handleLayerChange(e.target.value as LayerKey)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                                >
                                    {Object.entries(tileLayers).map(([key, layer]) => (
                                        <option key={key} value={key}>{layer.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-2">
                                    Zoom Level: {zoomLevel}
                                </label>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleZoomChange(-1)}
                                        disabled={zoomLevel <= 1}
                                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center justify-center transition-colors text-gray-900"
                                    >
                                        <ZoomOut className="h-4 w-4 mr-1" />
                                        Out
                                    </button>
                                    <button
                                        onClick={() => handleZoomChange(1)}
                                        disabled={zoomLevel >= 18}
                                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center justify-center transition-colors text-gray-900"
                                    >
                                        <ZoomIn className="h-4 w-4 mr-1" />
                                        In
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={goToLocation}
                                className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 transition-colors"
                            >
                                📍 Go to My Location
                            </button>

                            <div className="space-y-2 pt-2 border-t">
                                <label className="text-sm font-medium text-gray-700">Control Options</label>
                                {Object.entries(mapControls).map(([control, enabled]) => (
                                    <label key={control} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={() => toggleControl(control as ControlKey)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700 capitalize">{control.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Real Leaflet Map */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div
                            className="h-96 lg:h-[600px]"
                            ref={mapRef}
                            style={{ width: '100%', height: '600px' }}
                        >
                            {!mapReady && (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                        <p className="text-gray-600">Loading Leaflet map...</p>
                                        <p className="text-sm text-gray-500 mt-2">Fetching OpenStreetMap tiles...</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Map Footer */}
                        <div className="px-4 py-3 bg-gray-50 border-t">
                            <div className="flex items-center justify-between text-sm text-gray-600">
                                <div className="flex items-center space-x-4">
                                    <span>Layer: <strong className="text-blue-600">{tileLayers[activeLayer]?.name}</strong></span>
                                    <span>Zoom: <strong className="text-blue-600">{zoomLevel}</strong></span>
                                    <span className="hidden md:inline">Drag to pan • Scroll to zoom</span>
                                </div>
                                <div className="text-xs">
                                    Tiles: <strong>{tileUsage.todayRequests.toLocaleString()}</strong> | {tileLayers[activeLayer]?.attribution}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Activity Log */}
                    <div className="mt-4 bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Live Tile Request Log</h3>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-green-600 font-medium">Live</span>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {tileUsage.requestsToday.slice(-10).reverse().map((request, index) => (
                                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-sm text-gray-700 font-mono">
                                            {new Date(request.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 flex items-center space-x-2">
                                        <span className="font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{request.tiles}</span>
                                        <span>tiles</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="font-medium">{request.action}</span>
                                        <span className="text-gray-400">•</span>
                                        <span>Z{request.zoom}</span>
                                    </div>
                                </div>
                            ))}
                            {tileUsage.requestsToday.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No tile requests yet. Interact with the map to see activity.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OpenStreetMapApp;