import { motion } from "framer-motion";
import { MapPin, Layers, Radio, Zap, AlertTriangle } from "lucide-react";
import { useTrafficData } from "@/hooks/useTrafficDB";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// Real-world coordinates (Manhattan, NY)
const intersections: Record<string, [number, number]> = {
  "A-1": [40.7590, -73.9840],
  "A-2": [40.7605, -73.9810],
  "A-3": [40.7620, -73.9780],
  "A-4": [40.7635, -73.9750],
  "A-5": [40.7560, -73.9810],
  "A-6": [40.7575, -73.9780],
  "A-7": [40.7590, -73.9750],
  "A-8": [40.7530, -73.9780],
  "A-9": [40.7545, -73.9750],
};

const roads = [
  ["A-1", "A-2"], ["A-2", "A-3"], ["A-3", "A-4"], // East-West Ave 1
  ["A-5", "A-6"], ["A-6", "A-7"],                 // East-West Ave 2
  ["A-8", "A-9"],                                 // East-West Ave 3
  ["A-1", "A-5"], ["A-5", "A-8"],                 // North-South St 1
  ["A-2", "A-6"], ["A-6", "A-9"],                 // North-South St 2
  ["A-3", "A-7"]                                  // North-South St 3
];

export default function LiveMap() {
  const { data: trafficData } = useTrafficData();

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
                center={[40.7580, -73.9790]}
                zoom={15}
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
                  const nodeFrom = getIntersectionData(from);
                  const nodeTo = getIntersectionData(to);
                  const density = ((nodeFrom?.density || 10) + (nodeTo?.density || 10)) / 2;
                  const color = getDensityColor(density);

                  return (
                    <Polyline
                      key={`road-${idx}`}
                      positions={[intersections[from], intersections[to]]}
                      color={color}
                      weight={4}
                      opacity={0.6}
                    />
                  );
                })}

                {/* Draw Intersections */}
                {Object.entries(intersections).map(([id, pos]) => {
                  const data = getIntersectionData(id);
                  const density = data?.density ?? Math.random() * 80 + 10;
                  const color = getDensityColor(density);

                  return (
                    <CircleMarker
                      key={id}
                      center={pos}
                      radius={12}
                      pathOptions={{ fillColor: color, color: color, fillOpacity: 0.8, weight: 2 }}
                    >
                      <Popup className="font-mono text-xs">
                        <div className="flex flex-col gap-1 p-1">
                          <strong className="text-sm">Node {id}</strong>
                          <span>Geofence: NY-GRID-07</span>
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
                <span className="text-primary font-bold shadow-black drop-shadow-md">LIVE: Manhattan Grid Sector-7</span>
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
                <div className="bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 text-warning">
                  Node A-3 [40.762, -73.978]: High density spike detected
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 text-destructive">
                  Node A-6: Camera feed latency warning
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
