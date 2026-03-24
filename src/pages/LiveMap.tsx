import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Layers, Radio, Zap, AlertTriangle, Crosshair, Activity, Info,
  Navigation, Clock, ArrowRightLeft, Eye, Route, Siren, CloudRain, Car, Gauge
} from "lucide-react";
import { useTrafficData } from "@/hooks/useTrafficDB";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect, useMemo } from "react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSystemNetwork } from "@/hooks/useSystemStatus";
import { useActiveIncidents, type LiveIncident } from "@/hooks/useActiveIncidents";
import { useRouteGuidance } from "@/hooks/useRouteGuidance";
import { Button } from "@/components/ui/button";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// Real-world coordinates (Bangalore, Karnataka)
const intersections: Record<string, { pos: [number, number], name: string, area: string }> = {
  "BLR-1": { pos: [12.9176, 77.6238], name: "Silk Board Junction", area: "Hosur Road" },
  "BLR-2": { pos: [12.9226, 77.6174], name: "Madiwala Checkpost", area: "BTM Layout" },
  "BLR-3": { pos: [12.9345, 77.6265], name: "Koramangala Sony World", area: "Koramangala" },
  "BLR-4": { pos: [12.9784, 77.6408], name: "Indiranagar 100ft Rd", area: "Indiranagar" },
  "BLR-5": { pos: [12.9749, 77.6080], name: "MG Road / Brigade Rd", area: "Central Business District" },
  "BLR-6": { pos: [12.9779, 77.5724], name: "Majestic / Kempegowda", area: "City Railway Station" },
  "BLR-7": { pos: [13.0354, 77.5971], name: "Hebbal Flyover", area: "North Bangalore" },
  "BLR-8": { pos: [13.0068, 77.6994], name: "KR Puram Bridge", area: "East Bangalore" },
  "BLR-9": { pos: [12.8452, 77.6602], name: "Electronic City Phase 1", area: "IT Hub South" },
  "BLR-10": { pos: [12.8701, 77.5433], name: "Vajarahalli Junction", area: "Kanakapura Road" },
  "BLR-11": { pos: [12.8732, 77.5954], name: "Bannerghatta Circle", area: "Arterial South" },
};

const roads = [
  ["BLR-1", "BLR-2"], ["BLR-2", "BLR-3"], ["BLR-3", "BLR-4"],
  ["BLR-4", "BLR-5"], ["BLR-5", "BLR-6"],
  ["BLR-5", "BLR-7"],
  ["BLR-4", "BLR-8"],
  ["BLR-1", "BLR-9"],
  ["BLR-1", "BLR-10"],
  ["BLR-1", "BLR-11"]
];

// Helper to center map on selection
function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

const getDensityColor = (density: number) => {
  if (density > 80) return "#ef4444";
  if (density > 60) return "#f59e0b";
  if (density > 35) return "#8b5cf6";
  return "#22c55e";
};

const severityStyles: Record<string, { bg: string; border: string; text: string; icon: string; markerColor: string }> = {
  CRITICAL: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", icon: "🔴", markerColor: "#ef4444" },
  HIGH: { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", icon: "🟠", markerColor: "#f59e0b" },
  MEDIUM: { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: "🟡", markerColor: "#8b5cf6" },
  LOW: { bg: "bg-muted/10", border: "border-muted/30", text: "text-muted-foreground", icon: "⚪", markerColor: "#71717a" },
};

const incidentTypeIcons: Record<string, React.ReactNode> = {
  Accident: <Siren className="w-4 h-4 text-destructive" />,
  Jam: <Car className="w-4 h-4 text-warning" />,
  "Road Works": <AlertTriangle className="w-4 h-4 text-primary" />,
  "Road Closed": <AlertTriangle className="w-4 h-4 text-destructive" />,
  "Lane Closed": <AlertTriangle className="w-4 h-4 text-warning" />,
  Flooding: <CloudRain className="w-4 h-4 text-cyan" />,
  "Broken Down Vehicle": <Car className="w-4 h-4 text-warning" />,
};

export default function LiveMap() {
  const { data: trafficData } = useTrafficData();
  const [liveGrid, setLiveGrid] = useState<Record<string, number>>({});
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<{ center: [number, number], zoom: number }>({ center: [12.9716, 77.5946], zoom: 12 });
  const [showRoutes, setShowRoutes] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"alerts" | "routes">("alerts");

  const { data: telemetryData } = useLiveTelemetry();
  const { data: networkData } = useSystemNetwork();
  const { incidents, lastUpdated, critical, high } = useActiveIncidents(15_000);
  const { routes } = useRouteGuidance(20_000);

  useEffect(() => {
    if (telemetryData?.grid_congestion) {
      setLiveGrid(telemetryData.grid_congestion);
    }
  }, [telemetryData]);

  const getIntersectionData = (id: string) => trafficData?.find(td => td.intersection_id === id);

  const focusNode = (id: string) => {
    const inter = intersections[id];
    if (inter) {
      setSelectedNode(id);
      setMapConfig({ center: inter.pos, zoom: 15 });
    }
  };

  const focusIncident = (inc: LiveIncident) => {
    if (inc.lat && inc.lon) {
      setMapConfig({ center: [inc.lat, inc.lon], zoom: 16 });
    }
  };

  const timeSinceUpdate = useMemo(() => {
    if (!lastUpdated) return "—";
    const diff = Math.floor((Date.now() - lastUpdated) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  }, [lastUpdated]);

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 flex flex-col gap-6 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />

      <div className="container mx-auto space-y-6 relative z-10 flex-1 flex flex-col">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Global Surveillance Active</span>
              {critical.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-destructive/20 text-destructive border border-destructive/30 animate-pulse">
                  {critical.length} CRITICAL
                </span>
              )}
              {high.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-warning/20 text-warning border border-warning/30">
                  {high.length} HIGH
                </span>
              )}
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">ORBITAL GRID <span className="text-muted-foreground/30 ml-2">v5.0</span></h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
               City-wide spatial intelligence — {incidents.length} active incidents · {routes.length} diversions
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Layer toggles */}
            <div className="flex bg-secondary/30 backdrop-blur-md rounded-2xl p-1 border border-border/20 gap-1">
              <button onClick={() => setShowIncidents(!showIncidents)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all ${showIncidents ? "bg-destructive/20 text-destructive border border-destructive/20" : "text-muted-foreground hover:text-foreground"}`}>
                <Siren className="w-3 h-3 inline mr-1" /> Incidents
              </button>
              <button onClick={() => setShowRoutes(!showRoutes)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all ${showRoutes ? "bg-cyan/20 text-cyan border border-cyan/20" : "text-muted-foreground hover:text-foreground"}`}>
                <Route className="w-3 h-3 inline mr-1" /> Routes
              </button>
            </div>
            <div className="flex items-center gap-3 bg-secondary/30 backdrop-blur-md rounded-2xl p-2 border border-border/20">
              {[
                { label: "Low", color: "bg-success" },
                { label: "Med", color: "bg-accent" },
                { label: "High", color: "bg-warning" },
                { label: "Critical", color: "bg-destructive" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 px-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${l.color}`} />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6 flex-1">
          {/* Main Map Content */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-3 flex flex-col gap-4">
            <div className="relative w-full flex-1 min-h-[500px] rounded-3xl border border-border/30 overflow-hidden shadow-2xl shadow-primary/5 group">
              <MapContainer
                center={mapConfig.center}
                zoom={mapConfig.zoom}
                style={{ height: "100%", width: "100%", background: "#060608" }}
                className="z-0"
                zoomControl={false}
              >
                <MapController center={mapConfig.center} zoom={mapConfig.zoom} />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* Road Flow Visualization */}
                {roads.map(([from, to], idx) => {
                  const densityFrom = liveGrid[from];
                  const densityTo = liveGrid[to];
                  const hasDensity = typeof densityFrom === "number" && typeof densityTo === "number";
                  const density = hasDensity ? (densityFrom + densityTo) / 2 : 20;
                  const color = getDensityColor(density);

                  return (
                    <Polyline
                      key={`road-${idx}`}
                      positions={[intersections[from].pos, intersections[to].pos]}
                      color={color}
                      weight={selectedNode === from || selectedNode === to ? 6 : 4}
                      opacity={0.5}
                      dashArray={density > 60 ? "1, 10" : undefined}
                    />
                  );
                })}

                {/* Diversion Route Polylines */}
                {showRoutes && routes.map((route) => (
                  <Polyline
                    key={`route-${route.id}`}
                    positions={route.polyline as [number, number][][]}
                    color="#22d3ee"
                    weight={4}
                    opacity={0.7}
                    dashArray="12, 8"
                  >
                    <Popup className="font-mono custom-map-popup">
                      <div className="p-3 w-56 space-y-2">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-cyan" />
                          <h4 className="text-sm font-bold m-0 leading-tight">Diversion Route</h4>
                        </div>
                        <p className="text-xs text-muted-foreground m-0">{route.description}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <Clock className="w-3 h-3 text-success" />
                          <span className="text-success font-bold">Saves ~{route.time_saved} min</span>
                        </div>
                      </div>
                    </Popup>
                  </Polyline>
                ))}

                {/* Incident Markers on Map */}
                {showIncidents && incidents.filter(inc => inc.lat && inc.lon).map((inc) => {
                  const style = severityStyles[inc.severity] || severityStyles.LOW;
                  return (
                    <CircleMarker
                      key={inc.id}
                      center={[inc.lat!, inc.lon!]}
                      radius={inc.severity === "CRITICAL" ? 12 : 9}
                      pathOptions={{
                        fillColor: style.markerColor,
                        color: style.markerColor,
                        fillOpacity: 0.6,
                        weight: 2,
                      }}
                    >
                      <Popup className="font-mono custom-map-popup">
                        <div className="p-3 w-64 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {incidentTypeIcons[inc.type] || <AlertTriangle className="w-4 h-4" />}
                              <h4 className="text-sm font-bold m-0 leading-tight">{inc.type}</h4>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text} ${style.border} border`}>
                              {inc.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground m-0">{inc.description}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-secondary/40 p-1.5 rounded-lg">
                              <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Road</p>
                              <p className="text-xs font-semibold m-0">{inc.road_name || "Unknown"}</p>
                            </div>
                            <div className="bg-secondary/40 p-1.5 rounded-lg">
                              <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Delay</p>
                              <p className="text-xs font-bold m-0 text-warning">
                                {inc.delay_minutes > 0 ? `+${inc.delay_minutes} min` : "Minor"}
                              </p>
                            </div>
                          </div>
                          {inc.length_km > 0 && (
                            <p className="text-[10px] text-muted-foreground m-0">
                              Affected length: {inc.length_km} km
                              {inc.from_road && inc.to_road && ` · ${inc.from_road} → ${inc.to_road}`}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {/* Node Intersections */}
                {Object.entries(intersections).map(([id, node]) => {
                  const dbData = getIntersectionData(id);
                  const density = typeof liveGrid[id] === "number" ? liveGrid[id] : 0;
                  const color = getDensityColor(density);
                  const isSelected = selectedNode === id;

                  // Find zone data for speed info
                  const zoneData = networkData?.zones?.find((z: any) => z.name?.includes(node.name.split(" ")[0]) || z.id?.includes(id.toLowerCase().replace("blr-", "")));

                  return (
                    <CircleMarker
                      key={id}
                      center={node.pos}
                      radius={isSelected ? 14 : 10}
                      eventHandlers={{ click: () => setSelectedNode(id) }}
                      pathOptions={{
                        fillColor: color,
                        color: isSelected ? "#fff" : color,
                        fillOpacity: isSelected ? 1 : 0.7,
                        weight: isSelected ? 3 : 1
                      }}
                    >
                      <Popup className="font-mono custom-map-popup">
                        <div className="p-3 w-72 space-y-3 bg-popover/90 backdrop-blur-md rounded-xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold m-0 leading-tight">{node.name}</h4>
                              <p className="text-[10px] text-muted-foreground m-0 uppercase tracking-wider">{node.area}</p>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20">{id}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-secondary/40 p-2 rounded-lg border border-border/20">
                              <p className="text-[9px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Gauge className="w-3 h-3" /> Density</p>
                              <p className="text-lg font-bold m-0" style={{ color }}>{density.toFixed(1)}%</p>
                            </div>
                            <div className="bg-secondary/40 p-2 rounded-lg border border-border/20">
                              <p className="text-[9px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Car className="w-3 h-3" /> Vehicles</p>
                              <p className="text-lg font-bold text-foreground m-0">{zoneData?.vehicle_estimate ?? "—"}</p>
                            </div>
                            <div className="bg-secondary/40 p-2 rounded-lg border border-border/20">
                              <p className="text-[9px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Navigation className="w-3 h-3" /> Speed</p>
                              <p className="text-lg font-bold text-foreground m-0">{zoneData?.current_speed_kmph?.toFixed(0) ?? "—"}<span className="text-[9px] text-muted-foreground"> km/h</span></p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-2">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" /> Phase: {dbData?.optimal_signal_duration ? `${Math.round(dbData.optimal_signal_duration)}s` : "AUTO"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Info className="w-3 h-3" /> Source: {zoneData?.data_source || "TomTom"}
                            </span>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              {/* Floating Action HUD */}
              <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
                <Button variant="outline" size="icon" className="h-10 w-10 glass rounded-xl border-border/40 hover:bg-primary/20" onClick={() => setMapConfig({ center: [12.9716, 77.5946], zoom: 12 })}>
                  <Crosshair className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10 glass rounded-xl border-border/40 hover:bg-primary/20" onClick={() => setSelectedNode(null)}>
                  <Layers className="h-4 w-4" />
                </Button>
              </div>

              {/* Status Overlay */}
              <div className="absolute bottom-6 right-6 z-[400] bg-black/60 backdrop-blur-xl border border-border/20 rounded-2xl p-4 flex items-center gap-4 shadow-2xl">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">Active Incidents</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${incidents.length > 0 ? "bg-warning animate-pulse" : "bg-success"}`} />
                    <span className={`text-xs font-bold font-heading ${incidents.length > 0 ? "text-warning" : "text-success"}`}>
                      {incidents.length > 0 ? `${incidents.length} ACTIVE` : "ALL CLEAR"}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8 bg-border/40" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">Network</span>
                  <span className="text-xs font-bold text-primary font-mono">{Object.keys(liveGrid).length} NODES · {routes.length} DIVERSIONS</span>
                </div>
                <div className="w-px h-8 bg-border/40" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">Updated</span>
                  <span className="text-xs font-bold text-muted-foreground font-mono">{timeSinceUpdate}</span>
                </div>
              </div>
            </div>

            {/* Quick Intersection Bar */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
               {Object.keys(intersections).map(id => (
                 <button
                  key={id}
                  onClick={() => focusNode(id)}
                  className={`px-4 py-3 rounded-2xl glass border whitespace-nowrap transition-all flex items-center gap-3 ${selectedNode === id ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" : "border-border/20 hover:border-border/60"}`}
                 >
                    <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: getDensityColor(liveGrid[id] || 0) }} />
                    <div className="text-left">
                      <div className="text-[10px] font-mono font-bold text-foreground leading-none mb-1">{id}</div>
                      <div className="text-xs text-muted-foreground">{intersections[id].name}</div>
                    </div>
                 </button>
               ))}
            </div>
          </motion.div>

          {/* Right Intelligence Panel */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
            {/* Network Analytics Card */}
            <div className="glass rounded-3xl p-6 border border-border/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5 flex items-center gap-2">
                <Radio className="w-3 h-3 text-primary" /> Spatial Intelligence
              </h3>

              <div className="space-y-4 relative z-10">
                {[
                  { icon: MapPin, label: "Coverage", value: "City-Wide", color: "text-success", sub: "11 Intersections" },
                  { icon: Zap, label: "Latency", value: networkData?.network_latency_ms ? `${Math.round(networkData.network_latency_ms)}ms` : "14ms", color: "text-cyan", sub: "WebSocket" },
                  { icon: Activity, label: "Incidents", value: `${incidents.length} Active`, color: incidents.length > 0 ? "text-warning" : "text-success", sub: `${critical.length} Critical · ${high.length} High` },
                ].map((s) => (
                  <div key={s.label} className="flex gap-4 items-center">
                    <div className={`w-10 h-10 rounded-xl bg-secondary/50 border border-border/30 flex items-center justify-center ${s.color}`}>
                      <s.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</div>
                      <div className="text-sm font-bold text-foreground">{s.value} <span className="text-[10px] text-muted-foreground/50 font-normal ml-1">— {s.sub}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex rounded-2xl bg-secondary/30 overflow-hidden border border-border/20">
              <button onClick={() => setSidebarTab("alerts")}
                className={`flex-1 py-2 text-[10px] font-heading uppercase tracking-[0.15em] transition-all ${sidebarTab === "alerts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <AlertTriangle className="w-3 h-3 inline mr-1" /> Alerts ({incidents.length})
              </button>
              <button onClick={() => setSidebarTab("routes")}
                className={`flex-1 py-2 text-[10px] font-heading uppercase tracking-[0.15em] transition-all ${sidebarTab === "routes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Route className="w-3 h-3 inline mr-1" /> Routes ({routes.length})
              </button>
            </div>

            {/* Geo-Alerts / Route Cards */}
            <div className="glass rounded-3xl p-4 border border-border/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 font-bold">
                  {sidebarTab === "alerts" ? (
                    <><AlertTriangle className="w-3 h-3 text-warning" /> Live Geo-Alerts</>
                  ) : (
                    <><Route className="w-3 h-3 text-cyan" /> Active Diversions</>
                  )}
                </h3>
                <span className="text-[9px] font-mono text-muted-foreground">{timeSinceUpdate}</span>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence mode="wait">
                  {sidebarTab === "alerts" && (
                    <motion.div
                      key="alerts-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {incidents.length > 0 ? (
                        incidents.slice(0, 10).map((inc, i) => {
                          const style = severityStyles[inc.severity] || severityStyles.LOW;
                          return (
                            <motion.div
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              key={inc.id}
                              className={`${style.bg} border ${style.border} rounded-2xl p-4 space-y-2.5`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {incidentTypeIcons[inc.type] || <AlertTriangle className="w-4 h-4" />}
                                  <span className="text-xs font-bold font-mono">{inc.type.toUpperCase()}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}>
                                  {inc.severity}
                                </span>
                              </div>

                              <p className="text-xs text-foreground/80 leading-relaxed">{inc.description}</p>

                              {/* Road & Delay info */}
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                {inc.road_name && inc.road_name !== "Unknown Road" && (
                                  <span className="flex items-center gap-1">
                                    <Navigation className="w-3 h-3" /> {inc.road_name}
                                  </span>
                                )}
                                {inc.delay_minutes > 0 && (
                                  <span className="flex items-center gap-1 text-warning font-bold">
                                    <Clock className="w-3 h-3" /> +{inc.delay_minutes} min
                                  </span>
                                )}
                                {inc.length_km > 0 && (
                                  <span>{inc.length_km} km</span>
                                )}
                              </div>

                              {/* Direction */}
                              {inc.from_road && inc.to_road && (
                                <p className="text-[10px] text-muted-foreground/70">
                                  {inc.from_road} → {inc.to_road}
                                </p>
                              )}

                              {/* Action Buttons */}
                              {inc.lat && inc.lon && (
                                <button
                                  onClick={() => focusIncident(inc)}
                                  className="w-full py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5 border border-primary/20"
                                >
                                  <Eye className="w-3 h-3" /> View on Map
                                </button>
                              )}
                            </motion.div>
                          );
                        })
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="bg-success/5 border border-success/10 rounded-2xl p-6 text-center"
                        >
                          <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                            <Zap className="w-6 h-6 text-success" />
                          </div>
                          <h4 className="text-sm font-bold text-success mb-1">Clear Spectrum</h4>
                          <p className="text-xs text-muted-foreground">No critical geo-spatial alerts within active boundary.</p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {sidebarTab === "routes" && (
                    <motion.div
                      key="routes-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {routes.length > 0 ? routes.map((route) => (
                        <motion.div
                          key={route.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-cyan/5 border border-cyan/20 rounded-2xl p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ArrowRightLeft className="w-4 h-4 text-cyan" />
                              <span className="text-xs font-bold font-mono text-cyan">{route.junction_name}</span>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30">
                              SAVES {route.time_saved} min
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed">{route.description}</p>
                          <p className="text-[10px] text-muted-foreground">Via: {route.diversion_via || "Alternate corridor"}</p>
                        </motion.div>
                      )) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-primary/5 border border-primary/10 rounded-2xl p-6 text-center">
                          <Route className="w-6 h-6 text-primary mx-auto mb-2" />
                          <h4 className="text-sm font-bold text-foreground mb-1">No Active Diversions</h4>
                          <p className="text-xs text-muted-foreground">Routes will appear when congestion triggers diversions.</p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Diagnostic Card */}
            <div className="bg-primary/10 border border-primary/20 rounded-3xl p-5 flex items-center gap-4">
               <Radio className="w-6 h-6 text-primary animate-pulse" />
               <div>
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest leading-none mb-1">Signal Status</div>
                  <div className="text-xs text-foreground/80 leading-snug">All grid nodes communicating via primary fallback layer.</div>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
