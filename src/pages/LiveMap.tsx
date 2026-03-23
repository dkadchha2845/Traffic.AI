import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Layers, Radio, Zap, AlertTriangle, Crosshair, Activity, Info } from "lucide-react";
import { useTrafficData } from "@/hooks/useTrafficDB";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSystemNetwork } from "@/hooks/useSystemStatus";
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

export default function LiveMap() {
  const { data: trafficData } = useTrafficData();
  const [liveGrid, setLiveGrid] = useState<Record<string, number>>({});
  const [liveIncidents, setLiveIncidents] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<{ center: [number, number], zoom: number }>({ center: [12.9716, 77.5946], zoom: 12 });

  const { data: telemetryData } = useLiveTelemetry();
  const { data: networkData } = useSystemNetwork();

  useEffect(() => {
    if (telemetryData?.grid_congestion) {
      setLiveGrid(telemetryData.grid_congestion);
    }
    if (telemetryData?.live_incidents) {
      setLiveIncidents(telemetryData.live_incidents);
    }
  }, [telemetryData]);

  const getIntersectionData = (id: string) => {
    return trafficData?.find(td => td.intersection_id === id);
  };

  const getDensityColor = (density: number) => {
    if (density > 80) return "#ef4444"; // destructive
    if (density > 60) return "#f59e0b"; // warning 
    if (density > 35) return "#8b5cf6"; // accent
    return "#22c55e"; // success
  };

  const focusNode = (id: string) => {
    const inter = intersections[id];
    if (inter) {
      setSelectedNode(id);
      setMapConfig({ center: inter.pos, zoom: 15 });
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 flex flex-col gap-6 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      
      {/* Header section moved inside container */}
      <div className="container mx-auto space-y-6 relative z-10 flex-1 flex flex-col">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Global Surveillance Active</span>
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">ORBITAL GRID <span className="text-muted-foreground/30 ml-2">v4.0</span></h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
               City-wide spatial intelligence via TomTom High-Fidelity Feeds
            </p>
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
                      dashArray={density > 60 ? "1, 10" : undefined} // Pulse effect for high traffic
                    />
                  );
                })}

                {/* Node Intersections */}
                {Object.entries(intersections).map(([id, node]) => {
                  const dbData = getIntersectionData(id);
                  const density = typeof liveGrid[id] === "number" ? liveGrid[id] : 0;
                  const color = getDensityColor(density);
                  const isSelected = selectedNode === id;

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
                        <div className="p-3 w-64 space-y-3 bg-popover/90 backdrop-blur-md rounded-xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold m-0 leading-tight">{node.name}</h4>
                              <p className="text-[10px] text-muted-foreground m-0 uppercase tracking-wider">{node.area}</p>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20">{id}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-secondary/40 p-2 rounded-lg border border-border/20">
                              <p className="text-[9px] text-muted-foreground uppercase mb-1">Live Density</p>
                              <p className={`text-lg font-bold ${getDensityColor(density)} m-0`}>{density.toFixed(1)}%</p>
                            </div>
                            <div className="bg-secondary/40 p-2 rounded-lg border border-border/20">
                              <p className="text-[9px] text-muted-foreground uppercase mb-1">Phase Optimization</p>
                              <p className="text-lg font-bold text-foreground m-0">{dbData?.optimal_signal_duration ? `${Math.round(dbData.optimal_signal_duration)}s` : "AUTO"}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> System: ONLINE</span>
                            <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Reliability: 98%</span>
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
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">Orchestrator Mode</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs font-bold text-foreground font-heading">FULLY DETERMINISTIC</span>
                  </div>
                </div>
                <div className="w-px h-8 bg-border/40" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">Active Nodes</span>
                  <span className="text-xs font-bold text-primary font-mono">{Object.keys(liveGrid).length} NODE UNITS</span>
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
                    <span className={`w-2 h-2 rounded-full ${getDensityColor(liveGrid[id] || 0)}`} />
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
                <Radio className="w-3 h-3 text-primary" /> Spacial Intelligence
              </h3>
              
              <div className="space-y-4 relative z-10">
                {[
                  { icon: MapPin, label: "Network Coverage", value: "City-Wide", color: "text-success", sub: "11 Major Intersections" },
                  { icon: Zap, label: "Stream Latency", value: networkData?.network_latency_ms ? `${Math.round(networkData.network_latency_ms)}ms` : "14ms", color: "text-cyan", sub: "Live WebSocket Tunnel" },
                  { icon: Activity, label: "System Load", value: "Optimal", color: "text-primary", sub: "Parallel TomTom Threads" },
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

            {/* Incident Alert Panel */}
            <div className="glass rounded-3xl p-6 border border-border/10">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2 font-bold">
                <AlertTriangle className="w-3 h-3 text-warning" /> Live Geo-Alerts
              </h3>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {liveIncidents.length > 0 ? (
                    liveIncidents.slice(0, 4).map((inc, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={i} 
                        className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs font-bold font-mono">CRITICAL INCIDENT</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {inc.properties?.iconCategory === 1 ? 'Traffic Accident' : 'Roadwork / Significant Delay'} detected on segment. Routing engine alerted.
                        </p>
                      </motion.div>
                    ))
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
