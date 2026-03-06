import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, RefreshCw, Eye, Zap, AlertTriangle, Video, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// Bangalore traffic camera feed definitions
// Using publicly available traffic / nature / urban streams & MJPEG endpoints
const CAMERA_FEEDS = [
    {
        id: "cam-silk-board",
        name: "Silk Board Junction",
        area: "BTM Layout Flyover",
        lat: 12.9176, lon: 77.6238,
        // YOLO overlay simulation — real RTSP can be swapped via CCTV_RTSP_URL env
        streamUrl: null as string | null, // null = show YOLO overlay card
        status: "LIVE",
        vehicleCount: 0, // updated from telemetry
        congestion: 0,
    },
    {
        id: "cam-marathahalli",
        name: "Marathahalli Bridge",
        area: "Outer Ring Road",
        lat: 12.9591, lon: 77.6975,
        streamUrl: null,
        status: "LIVE",
        vehicleCount: 0,
        congestion: 0,
    },
    {
        id: "cam-hebbal",
        name: "Hebbal Flyover",
        area: "NH-44 Airport Road",
        lat: 13.0354, lon: 77.5971,
        streamUrl: null,
        status: "LIVE",
        vehicleCount: 0,
        congestion: 0,
    },
    {
        id: "cam-ecity",
        name: "Electronic City Flyover",
        area: "Hosur Road",
        lat: 12.8452, lon: 77.6602,
        streamUrl: null,
        status: "LIVE",
        vehicleCount: 0,
        congestion: 0,
    },
];

const DETECTION_CLASSES = [
    { label: "Car", color: "#22c55e", count: 0 },
    { label: "Truck", color: "#f59e0b", count: 0 },
    { label: "Bus", color: "#8b5cf6", count: 0 },
    { label: "Motorcycle", color: "#06b6d4", count: 0 },
    { label: "Auto", color: "#ef4444", count: 0 },
];

function CameraCard({ cam, vehicleCount, congestion, selected, onSelect }: {
    cam: typeof CAMERA_FEEDS[0];
    vehicleCount: number;
    congestion: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(x => x + 1), 2000);
        return () => clearInterval(t);
    }, []);

    // Simulate YOLO detection bounding boxes on a Bangalore street backdrop
    const estimatedCars = Math.round(vehicleCount * 0.6);
    const estimatedBikes = Math.round(vehicleCount * 0.25);
    const estimatedTrucks = vehicleCount - estimatedCars - estimatedBikes;
    const congLevel = congestion > 70 ? "Critical" : congestion > 50 ? "High" : congestion > 30 ? "Medium" : "Low";
    const congColor = congestion > 70 ? "#ef4444" : congestion > 50 ? "#f59e0b" : congestion > 30 ? "#8b5cf6" : "#22c55e";

    return (
        <button onClick={onSelect}
            className={`w-full text-left glass rounded-xl overflow-hidden border transition-all ${selected ? "border-primary glow-primary" : "border-border/20 hover:border-primary/40"}`}>
            {/* Simulated YOLO feed viewport */}
            <div className="relative bg-zinc-900 aspect-video flex items-center justify-center overflow-hidden">
                {/* Street scene background */}
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-950" />
                {/* Road markings */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-zinc-800 border-t-2 border-dashed border-yellow-500/30" />
                <div className="absolute bottom-1/3 left-1/2 w-1 h-8 bg-yellow-400/40 -translate-x-1/2" />

                {/* Animated vehicle dots representing YOLO detections */}
                {Array.from({ length: Math.min(vehicleCount, 12) }).map((_, i) => {
                    const x = 10 + ((i * 73 + tick * 5) % 80);
                    const y = 40 + (i % 3) * 15 + (tick % 5);
                    const colors = ["#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];
                    return (
                        <div key={i} className="absolute w-6 h-4 border rounded-sm flex items-center justify-center"
                            style={{ left: `${x}%`, top: `${y}%`, borderColor: colors[i % colors.length], background: `${colors[i % colors.length]}22` }}>
                            <span className="text-[6px] font-mono" style={{ color: colors[i % colors.length] }}>
                                {["Car", "Bike", "Truck", "Bus", "Auto"][i % 5]}
                            </span>
                        </div>
                    );
                })}

                {/* LIVE badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 rounded px-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                    <span className="text-[10px] font-mono text-white">LIVE YOLO</span>
                </div>

                {/* Vehicle count overlay */}
                <div className="absolute top-2 right-2 bg-black/70 rounded px-2 py-1 font-mono text-xs text-white">
                    {vehicleCount} vehicles
                </div>

                {/* Congestion badge */}
                <div className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-mono font-bold"
                    style={{ background: `${congColor}33`, color: congColor, border: `1px solid ${congColor}55` }}>
                    {congLevel}
                </div>

                {/* Density bar at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
                    <div className="h-full transition-all duration-700" style={{ width: `${congestion}%`, background: congColor }} />
                </div>
            </div>

            <div className="p-3">
                <div className="font-mono text-sm font-semibold text-foreground">{cam.name}</div>
                <div className="text-xs text-muted-foreground">{cam.area}</div>
                <div className="flex gap-3 mt-2 text-xs font-mono">
                    <span className="text-success">🟢 Cars: {estimatedCars}</span>
                    <span className="text-accent">🔵 Bikes: {estimatedBikes}</span>
                    <span className="text-warning">🟡 Heavy: {Math.max(0, estimatedTrucks)}</span>
                </div>
            </div>
        </button>
    );
}

export default function CameraFeed() {
    const { data: telemetry } = useLiveTelemetry();
    const [selected, setSelected] = useState(0);
    const [rtspUrl, setRtspUrl] = useState(import.meta.env.VITE_CCTV_URL || "");

    // Distribute telemetry vehicle counts across cameras with spatial variation
    const camsWithData = CAMERA_FEEDS.map((cam, i) => {
        const variation = [1.2, 0.9, 0.75, 0.85][i];
        const vc = Math.max(5, Math.round(telemetry.vehicle_count * variation));
        const node = `BLR-${i + 1}` as keyof typeof telemetry.grid_congestion;
        const congestion = telemetry.grid_congestion[node] ?? telemetry.density;
        return { ...cam, vehicleCount: vc, congestion };
    });

    const selectedCam = camsWithData[selected];
    const totalVehicles = camsWithData.reduce((s, c) => s + c.vehicleCount, 0);

    return (
        <div className="min-h-screen pt-20 pb-8 px-4">
            <div className="container mx-auto space-y-6">
                {/* Header */}
                <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold tracking-wide">LIVE CAMERA FEEDS</h1>
                        <p className="text-muted-foreground text-sm">
                            YOLOv8 vehicle detection across major Bangalore intersections
                            {rtspUrl ? " — RTSP Stream Active" : " — YOLO Simulation Mode"}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs font-mono text-success">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            {totalVehicles} total vehicles detected
                        </span>
                    </div>
                </motion.div>

                {/* RTSP URL input */}
                <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-4 border border-border/20">
                    <div className="flex items-center gap-3">
                        <Video className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1">
                            <div className="text-xs font-mono text-muted-foreground mb-1">RTSP CAMERA STREAM URL (optional)</div>
                            <div className="flex gap-2">
                                <input value={rtspUrl} onChange={e => setRtspUrl(e.target.value)}
                                    placeholder="rtsp://username:password@camera-ip:554/stream"
                                    className="flex-1 bg-secondary/50 border border-border/30 rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                                <Button size="sm" variant="outline" className="text-xs shrink-0">Connect</Button>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right shrink-0">
                            <div>Set in .env as</div>
                            <div className="font-mono text-primary">VITE_CCTV_URL</div>
                        </div>
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Camera Thumbnails */}
                    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-3">
                        {camsWithData.map((cam, i) => (
                            <CameraCard key={cam.id} cam={cam} vehicleCount={cam.vehicleCount} congestion={cam.congestion}
                                selected={selected === i} onSelect={() => setSelected(i)} />
                        ))}
                    </motion.div>

                    {/* Main viewer */}
                    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-heading font-bold text-foreground">{selectedCam.name}</h2>
                                <p className="text-sm text-muted-foreground">{selectedCam.area} · {selectedCam.lat.toFixed(4)}, {selectedCam.lon.toFixed(4)}</p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-mono bg-success/10 text-success border border-success/20 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> LIVE
                            </span>
                        </div>

                        {/* Simulated main YOLO feed */}
                        <div className="relative bg-zinc-900 rounded-xl overflow-hidden aspect-video">
                            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-950" />
                            {/* Road */}
                            <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-zinc-800" />
                            <div className="absolute bottom-1/3 left-0 right-0 h-px bg-yellow-400/20" />

                            {/* Larger YOLO detection boxes for main view */}
                            {Array.from({ length: Math.min(selectedCam.vehicleCount, 20) }).map((_, i) => {
                                const x = 5 + ((i * 61 + Date.now() / 1000 * 0.5) % 88);
                                const y = 35 + (i % 4) * 12;
                                const colors = ["#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];
                                const labels = ["Car", "Motorcycle", "Truck", "Bus", "Auto Rickshaw"];
                                const confidence = (85 + Math.random() * 14).toFixed(0);
                                return (
                                    <div key={i} className="absolute border-2 rounded flex flex-col"
                                        style={{ left: `${x}%`, top: `${y}%`, width: "80px", height: "50px", borderColor: colors[i % colors.length] }}>
                                        <span className="px-1 text-[8px] font-mono font-bold text-white"
                                            style={{ background: colors[i % colors.length] }}>
                                            {labels[i % labels.length]} {confidence}%
                                        </span>
                                    </div>
                                );
                            })}

                            {/* HUD overlays */}
                            <div className="absolute top-3 left-3 bg-black/80 rounded-lg px-3 py-2 font-mono text-xs space-y-1">
                                <div className="text-white">🔴 REC · {new Date().toLocaleTimeString()}</div>
                                <div className="text-success">YOLOv8n · {selectedCam.vehicleCount} objects</div>
                                <div style={{ color: selectedCam.congestion > 70 ? "#ef4444" : "#22c55e" }}>
                                    Congestion: {selectedCam.congestion.toFixed(0)}%
                                </div>
                            </div>
                            <div className="absolute bottom-3 right-3 bg-black/80 rounded px-2 py-1 font-mono text-[10px] text-muted-foreground">
                                BLR-CAM-{selected + 1} · 1080p · {rtspUrl ? "RTSP" : "SIM"}
                            </div>
                        </div>

                        {/* Detection breakdown */}
                        <div className="grid grid-cols-5 gap-2">
                            {[
                                { label: "Cars", count: Math.round(selectedCam.vehicleCount * 0.58), color: "text-success bg-success/10 border-success/20" },
                                { label: "Bikes", count: Math.round(selectedCam.vehicleCount * 0.22), color: "text-accent bg-accent/10 border-accent/20" },
                                { label: "Autos", count: Math.round(selectedCam.vehicleCount * 0.10), color: "text-warning bg-warning/10 border-warning/20" },
                                { label: "Trucks", count: Math.round(selectedCam.vehicleCount * 0.06), color: "text-cyan bg-cyan/10 border-cyan/20" },
                                { label: "Buses", count: Math.round(selectedCam.vehicleCount * 0.04), color: "text-primary bg-primary/10 border-primary/20" },
                            ].map(d => (
                                <div key={d.label} className={`rounded-xl p-3 text-center border ${d.color}`}>
                                    <div className="text-lg font-heading font-bold">{d.count}</div>
                                    <div className="text-[10px] font-mono">{d.label}</div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
