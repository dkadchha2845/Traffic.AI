import { motion } from "framer-motion";
import { MapPin, Layers, Radio, Zap, AlertTriangle } from "lucide-react";
import { useTrafficData } from "@/hooks/useTrafficDB";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// Real-world coordinates (Bangalore, Karnataka)
const intersections: Record<string, { pos: [number, number], name: string }> = {
  "BLR-1": { pos: [12.9176, 77.6238], name: "Silk Board Junction" },
  "BLR-2": { pos: [12.9226, 77.6174], name: "Madiwala Checkpost" },
  "BLR-3": { pos: [12.9345, 77.6265], name: "Koramangala Sony World" },
  "BLR-4": { pos: [12.9784, 77.6408], name: "Indiranagar 100ft Rd" },
  "BLR-5": { pos: [12.9749, 77.6080], name: "MG Road / Brigade Rd" },
  "BLR-6": { pos: [12.9779, 77.5724], name: "Majestic / Kempegowda" },
  "BLR-7": { pos: [13.0354, 77.5971], name: "Hebbal Flyover" },
  "BLR-8": { pos: [13.0068, 77.6994], name: "KR Puram Bridge" },
  "BLR-9": { pos: [12.8452, 77.6602], name: "Electronic City Phase 1" },
};

const roads = [
  ["BLR-1", "BLR-2"], ["BLR-2", "BLR-3"], ["BLR-3", "BLR-4"], // Silk Board to Indiranagar
  ["BLR-4", "BLR-5"], ["BLR-5", "BLR-6"],                 // Indiranagar to Majestic via MG
  ["BLR-5", "BLR-7"],                                 // MG Road to Hebbal
  ["BLR-4", "BLR-8"],                                 // Indiranagar to KR Puram (Old Madras Rd)
  ["BLR-1", "BLR-9"]                                  // Silk Board to E-City (Hosur Rd)
];

export default function LiveMap() {
  // We keep useTrafficData specifically if we need static historic DB metadata, 
  // but density flow is driven by the pure TomTom live WebSocket.
  const { data: trafficData } = useTrafficData();
  const [liveGrid, setLiveGrid] = useState<Record<string, number>>({});
  const [liveIncidents, setLiveIncidents] = useState<any[]>([]);

  useEffect(() => {
    // Establish independent bi-directional feed for pure map telemetry
    const ws = new WebSocket("ws://localhost:8000/ws/telemetry");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "telemetry" && data.grid_congestion) {
          setLiveGrid(data.grid_congestion);
          if (data.live_incidents) setLiveIncidents(data.live_incidents);
        }
      } catch (e) {
        console.error("Map Telemetry Error", e);
      }
    };
    return () => ws.close();
  }, []);

  const getIntersectionData = (id: string) => {
    return trafficData?.find(td => td.intersection_id === id);
  };

  const getDensityColor = (density: number) => {
    if (density > 80) return "#ef4444"; // destructive
    if (density > 60) return "#f59e0b"; // warning 
    if (density > 40) return "#8b5cf6"; // accent
    return "#22c55e"; // success
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto space-y-6 relative z-10">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">ORBITAL MAP</h1>
            <p className="text-muted-foreground text-sm">Real-time city-wide intersection monitoring via GPS feeds</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" /> Low</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /> Medium</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /> High</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /> Critical</span>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map View */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-3 glass rounded-2xl p-6">
            <div className="relative w-full aspect-[16/10] rounded-xl border border-border/30 overflow-hidden z-0">
              <MapContainer
                center={[12.9716, 77.5946]}
                zoom={12}
                style={{ height: "100%", width: "100%", background: "#09090b" }}
                className="z-0"
                zoomControl={false}
              >
                {/* Dark mode carto map variant overlay */}
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* Draw Roads/Polylines */}
                {roads.map(([from, to], idx) => {
                  const densityFrom = liveGrid[from] ?? 0;
                  const densityTo = liveGrid[to] ?? 0;
                  const density = (densityFrom + densityTo) / 2;
                  const color = getDensityColor(density);

                  return (
                    <Polyline
                      key={`road-${idx}`}
                      positions={[intersections[from].pos, intersections[to].pos]}
                      color={color}
                      weight={4}
                      opacity={0.6}
                    />
                  );
                })}

                {/* Draw Intersections */}
                {Object.entries(intersections).map(([id, intersectionData]) => {
                  const data = getIntersectionData(id);
                  const density = liveGrid[id] ?? 0; // Strict Reality Audit: Driven pure via TomTom WebSockets
                  const color = getDensityColor(density);

                  return (
                    <CircleMarker
                      key={id}
                      center={intersectionData.pos}
                      radius={10}
                      pathOptions={{ fillColor: color, color: color, fillOpacity: 0.8, weight: 2 }}
                    >
                      <Popup className="font-mono text-xs">
                        <div className="flex flex-col gap-1 p-1">
                          <strong className="text-sm">{intersectionData.name}</strong>
                          <span>Geofence: BLR-GRID-CORE</span>
                          <span>Live Density: {density.toFixed(1)}%</span>
                          <span>Signal Opt: {(data?.optimal_signal_duration || 30).toFixed(1)}s</span>
                          <span>Agent: active</span>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              {/* Map Label Overlay */}
              <div className="absolute bottom-3 left-3 bg-secondary/80 backdrop-blur-md rounded-lg px-3 py-2 text-xs font-mono z-[400] border border-border/40">
                <span className="text-primary font-bold shadow-black drop-shadow-md">LIVE: Bangalore Grid</span>
              </div>
            </div>
          </motion.div>

          {/* Side Panel */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Live Network Stats</h3>
              <div className="space-y-3">
                {[
                  { icon: MapPin, label: "Active Nodes", value: "9", color: "text-success" },
                  { icon: Radio, label: "Signal Sync", value: "98.2%", color: "text-primary" },
                  { icon: Layers, label: "Geo-Streams", value: "12", color: "text-accent" },
                  { icon: Zap, label: "Avg Latency", value: "18ms", color: "text-cyan" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between bg-secondary/30 rounded-xl px-4 py-3 border border-border/20">
                    <div className="flex items-center gap-2">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className="text-sm text-muted-foreground">{s.label}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-warning" /> Geo-Spacial Alerts
              </h3>
              <div className="space-y-2 text-xs">
                {liveIncidents.length > 0 ? (
                  liveIncidents.slice(0, 3).map((inc, i) => (
                    <div key={i} className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 text-destructive">
                      <strong>Incident Detected:</strong> {inc.properties?.iconCategory === 1 ? 'Accident' : 'Roadwork / Jam'} near [{inc.geometry?.coordinates?.[0]?.[1]?.toFixed(3)}, {inc.geometry?.coordinates?.[0]?.[0]?.toFixed(3)}]
                    </div>
                  ))
                ) : (
                  <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2 text-success">
                    No active geo-spatial incidents detected on grid.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
