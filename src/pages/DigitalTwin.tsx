import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Html, Stars, Cylinder } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { Activity, CarFront, Radio, MapPin, Search } from "lucide-react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { Button } from "@/components/ui/button";

// ── BANGALORE CORE GRID MAP ─────────────────────────────────────────────────
// Define major junctions with relative 3D coordinates (x, z)
const JUNCTIONS = [
    { id: "silk-board", name: "Silk Board", x: 6, z: 8 },
    { id: "marathahalli", name: "Marathahalli", x: 12, z: -2 },
    { id: "hebbal", name: "Hebbal Flyover", x: 2, z: -12 },
    { id: "kr-puram", name: "KR Puram", x: 14, z: -8 },
    { id: "ecity", name: "Electronic City", x: 4, z: 14 },
    { id: "outer-ring", name: "Outer Ring Road", x: 10, z: 2 },
    { id: "majestic", name: "Majestic", x: -4, z: 0 },
    { id: "koramangala", name: "Koramangala", x: 2, z: 5 },
    { id: "indiranagar", name: "Indiranagar", x: 8, z: -1 },
];

const ROADS = [
    { from: "silk-board", to: "koramangala" },
    { from: "koramangala", to: "indiranagar" },
    { from: "indiranagar", to: "marathahalli" },
    { from: "marathahalli", to: "outer-ring" },
    { from: "outer-ring", to: "kr-puram" },
    { from: "hebbal", to: "majestic" },
    { from: "majestic", to: "koramangala" },
    { from: "silk-board", to: "ecity" },
    { from: "kr-puram", to: "hebbal" },
];

// Helper to find coords
const getCoords = (id: string) => JUNCTIONS.find((j) => j.id === id) || { x: 0, z: 0 };

// ── 3D COMPONENTS ────────────────────────────────────────────────────────────

// The glowing road network
function RoadNetwork({ telemetry }: { telemetry: any }) {
    return (
        <group>
            {ROADS.map((road, idx) => {
                const p1 = getCoords(road.from);
                const p2 = getCoords(road.to);
                const dx = p2.x - p1.x;
                const dz = p2.z - p1.z;
                const length = Math.sqrt(dx * dx + dz * dz);
                const angle = Math.atan2(dz, dx);

                // Use live congestion data if available, fallback to default density
                const congRatio = (telemetry?.density || 50) / 100;
                // slight variation per road
                const roadCongestion = Math.min(1.0, Math.max(0.1, congRatio * (0.8 + (idx % 4) * 0.1)));

                const color = roadCongestion > 0.75 ? "#ef4444" : roadCongestion > 0.5 ? "#f59e0b" : "#22c55e";

                return (
                    <group key={idx} position={[p1.x + dx / 2, 0.01, p1.z + dz / 2]} rotation={[0, -angle, 0]}>
                        <mesh>
                            <boxGeometry args={[length, 0.05, 0.6]} />
                            <meshStandardMaterial color="#27272a" />
                        </mesh>
                        {/* Heatmap overlay */}
                        <mesh position={[0, 0.03, 0]}>
                            <planeGeometry args={[length, 0.5]} />
                            <meshBasicMaterial color={color} transparent opacity={0.3 + roadCongestion * 0.3} />
                        </mesh>
                        {/* Center line */}
                        <mesh position={[0, 0.04, 0]}>
                            <planeGeometry args={[length, 0.05]} />
                            <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

// Intersections with traffic lights and info popups
function Intersections({ telemetry, onSelect }: { telemetry: any, onSelect: (j: any) => void }) {
    return (
        <group>
            {JUNCTIONS.map((j) => {
                const isRed = (j.x + j.z) % 2 === 0; // Fake signal state
                return (
                    <group key={j.id} position={[j.x, 0, j.z]} onClick={(e) => { e.stopPropagation(); onSelect(j); }}>
                        {/* Base platform */}
                        <mesh position={[0, 0.06, 0]}>
                            <cylinderGeometry args={[0.8, 0.8, 0.1, 16]} />
                            <meshStandardMaterial color="#3f3f46" />
                        </mesh>
                        {/* Intersection glow */}
                        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.8, 1.2, 32]} />
                            <meshBasicMaterial color="#8b5cf6" transparent opacity={0.2} />
                        </mesh>

                        {/* Traffic Signal Pole */}
                        <group position={[0.6, 0, -0.6]}>
                            <mesh position={[0, 0.5, 0]}>
                                <cylinderGeometry args={[0.05, 0.05, 1]} />
                                <meshStandardMaterial color="#18181b" />
                            </mesh>
                            {/* LED */}
                            <mesh position={[0, 1.1, 0]}>
                                <sphereGeometry args={[0.15, 16, 16]} />
                                <meshBasicMaterial color={isRed ? "#ef4444" : "#22c55e"} />
                            </mesh>
                            <pointLight position={[0, 1.1, 0]} color={isRed ? "#ef4444" : "#22c55e"} intensity={isRed ? 0.8 : 0.4} distance={2} />
                        </group>
                    </group>
                );
            })}
        </group>
    );
}

// Moving vehicles logic
function MovingVehicles({ totalCount }: { totalCount: number }) {
    const [vehicles, setVehicles] = useState<any[]>([]);

    // Generate initial vehicles
    useEffect(() => {
        const v = [];
        const numVehicles = Math.min(100, Math.max(10, Math.floor(totalCount * 0.4)));

        for (let i = 0; i < numVehicles; i++) {
            const road = ROADS[Math.floor(Math.random() * ROADS.length)];
            const p1 = getCoords(road.from);
            const p2 = getCoords(road.to);
            const progress = Math.random();
            const speed = 0.5 + Math.random() * 1.5;
            const color = ["#e2e8f0", "#38bdf8", "#ef4444", "#facc15"][Math.floor(Math.random() * 4)];
            const isForward = Math.random() > 0.5;

            v.push({ road, p1, p2, progress, speed, color, isForward, offset: (Math.random() - 0.5) * 0.3 });
        }
        setVehicles(v);
    }, [totalCount]);

    // Use a ref to mutate positions on frameloop
    const meshesRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state, delta) => {
        if (!meshesRef.current || vehicles.length === 0) return;

        vehicles.forEach((v, i) => {
            // Move vehicle
            v.progress += (v.speed * delta) / 10;
            if (v.progress > 1) {
                v.progress = 0;
                const newRoad = ROADS[Math.floor(Math.random() * ROADS.length)];
                v.road = newRoad;
                v.p1 = getCoords(newRoad.from);
                v.p2 = getCoords(newRoad.to);
                v.isForward = Math.random() > 0.5;
            }

            const currentProg = v.isForward ? v.progress : 1 - v.progress;

            const x = v.p1.x + (v.p2.x - v.p1.x) * currentProg;
            const z = v.p1.z + (v.p2.z - v.p1.z) * currentProg;

            // Calculate rotation
            const angle = Math.atan2(v.p2.z - v.p1.z, v.p2.x - v.p1.x);

            // perpendicular offset for lanes
            const ox = Math.sin(angle) * (v.isForward ? 0.2 : -0.2);
            const oz = -Math.cos(angle) * (v.isForward ? 0.2 : -0.2);

            dummy.position.set(x + ox, 0.1, z + oz);
            dummy.rotation.y = v.isForward ? -angle : -angle + Math.PI;
            dummy.updateMatrix();
            meshesRef.current!.setMatrixAt(i, dummy.matrix);

            // Color
            meshesRef.current!.setColorAt(i, new THREE.Color(v.color));
        });
        meshesRef.current.instanceMatrix.needsUpdate = true;
        if (meshesRef.current.instanceColor) meshesRef.current.instanceColor.needsUpdate = true;
    });

    if (vehicles.length === 0) return null;

    return (
        <instancedMesh ref={meshesRef} args={[undefined, undefined, vehicles.length]}>
            <boxGeometry args={[0.3, 0.15, 0.15]} />
            <meshStandardMaterial roughness={0.2} metalness={0.8} />
        </instancedMesh>
    );
}


export default function DigitalTwin() {
    const { data: telemetry } = useLiveTelemetry();
    const [selectedJunction, setSelectedJunction] = useState<any | null>(null);

    const vehicleCount = telemetry?.vehicle_count || 45;
    const congestion = telemetry?.density || 65;
    const signalPhase = telemetry?.signal_phase || "ADAPTIVE";

    return (
        <div className="h-screen w-full relative bg-zinc-950 overflow-hidden">
            {/* ── HUD OVERLAYS ── */}
            <div className="absolute top-20 left-6 z-10 pointer-events-none">
                <h1 className="text-4xl font-heading font-black text-white tracking-widest drop-shadow-lg">DIGITAL TWIN</h1>
                <div className="flex items-center gap-3 mt-2 font-mono text-sm text-primary">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    LIVE BANGALORE NETWORK
                </div>
            </div>

            <div className="absolute top-24 right-6 z-10 w-80 space-y-4 pointer-events-auto">
                <div className="glass p-4 rounded-xl border border-primary/20 backdrop-blur-md">
                    <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        Global Telemetry
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-muted-foreground font-mono">DENSITY</div>
                            <div className="text-xl font-bold font-mono">{congestion.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground font-mono">VEHICLES</div>
                            <div className="text-xl font-bold font-mono">{vehicleCount}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground font-mono">AI STATE</div>
                            <div className="text-sm font-bold font-mono text-success">{signalPhase}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground font-mono">LATENCY</div>
                            <div className="text-sm font-bold font-mono text-cyan">42 ms</div>
                        </div>
                    </div>
                </div>

                {selectedJunction && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass p-4 rounded-xl border border-accent/30 bg-accent/5 backdrop-blur-md">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-heading font-bold text-lg text-accent">{selectedJunction.name}</h3>
                            <button onClick={() => setSelectedJunction(null)} className="text-muted-foreground hover:text-white">&times;</button>
                        </div>

                        <div className="space-y-3 font-mono text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Coordinates:</span>
                                <span>{selectedJunction.x}, {selectedJunction.z}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Local Density:</span>
                                <span className={(congestion > 70 ? "text-destructive" : "text-warning")}>
                                    {Math.min(100, congestion + (Math.random() * 15)).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Queue Length:</span>
                                <span>{Math.floor(vehicleCount * 0.15)} vehicles</span>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/20">
                                <Button className="w-full bg-accent hover:bg-accent/80 text-white font-bold" variant="default" size="sm">
                                    <Radio className="w-4 h-4 mr-2" /> Override Signal
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* ── 3D CANVAS ── */}
            <Canvas camera={{ position: [0, 15, 20], fov: 45 }} className="w-full h-full">
                <fog attach="fog" args={["#09090b", 10, 40]} />
                <ambientLight intensity={0.2} />
                <directionalLight position={[10, 20, 10]} intensity={1} color="#ffffff" castShadow />
                <spotLight position={[-10, 15, -10]} intensity={2} color="#8b5cf6" angle={0.5} penumbra={1} />
                <spotLight position={[10, 10, 15]} intensity={1} color="#38bdf8" angle={0.8} />

                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

                <Grid
                    position={[0, -0.01, 0]}
                    args={[50, 50]}
                    cellSize={1}
                    cellThickness={0.5}
                    cellColor="#18181b"
                    sectionSize={5}
                    sectionThickness={1}
                    sectionColor="#27272a"
                    fadeDistance={30}
                    fadeStrength={1}
                />

                <RoadNetwork telemetry={telemetry} />
                <Intersections telemetry={telemetry} onSelect={setSelectedJunction} />
                <MovingVehicles totalCount={vehicleCount} />

                {selectedJunction && (
                    <mesh position={[selectedJunction.x, 2, selectedJunction.z]}>
                        <sphereGeometry args={[0.3, 16, 16]} />
                        <meshBasicMaterial color="#38bdf8" />
                        <Html center position={[0, 0.5, 0]}>
                            <div className="bg-black/80 px-2 py-1 rounded text-xs font-mono border border-cyan/30 text-cyan animate-pulse">
                                TARGETED
                            </div>
                        </Html>
                    </mesh>
                )}

                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    maxPolarAngle={Math.PI / 2.1} // don't go below ground
                    minDistance={5}
                    maxDistance={40}
                />

                <Environment preset="night" />
            </Canvas>
        </div>
    );
}
