import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Html, Stars } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { Activity, Radio } from "lucide-react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSystemNetwork, type SystemZoneSnapshot } from "@/hooks/useSystemStatus";

const JUNCTIONS = [
  { id: "silk-board", zoneId: "silk-board", name: "Silk Board", x: 6, z: 8 },
  { id: "marathahalli", zoneId: "marathahalli", name: "Marathahalli", x: 12, z: -2 },
  { id: "hebbal", zoneId: "hebbal-flyover", name: "Hebbal Flyover", x: 2, z: -12 },
  { id: "kr-puram", zoneId: "kr-puram", name: "KR Puram", x: 14, z: -8 },
  { id: "ecity", zoneId: "ecity-flyover", name: "Electronic City", x: 4, z: 14 },
  { id: "outer-ring", zoneId: "outer-ring-road", name: "Outer Ring Road", x: 10, z: 2 },
  { id: "majestic", zoneId: "majestic", name: "Majestic", x: -4, z: 0 },
  { id: "koramangala", zoneId: "koramangala", name: "Koramangala", x: 2, z: 5 },
  { id: "indiranagar", zoneId: "indiranagar", name: "Indiranagar", x: 8, z: -1 },
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

const VEHICLE_COLORS = ["#e2e8f0", "#38bdf8", "#ef4444", "#facc15"];

type JunctionMetric = {
  zone?: SystemZoneSnapshot;
  density: number | null;
  vehicleEstimate: number | null;
  available: boolean;
};

function getCoords(id: string) {
  return JUNCTIONS.find((junction) => junction.id === id) || { x: 0, z: 0 };
}

function getDensityColor(density: number | null) {
  if (density == null) {
    return "#71717a";
  }
  if (density > 75) {
    return "#ef4444";
  }
  if (density > 55) {
    return "#f59e0b";
  }
  return "#22c55e";
}

function RoadNetwork({ junctionMetrics, globalDensity }: { junctionMetrics: Record<string, JunctionMetric>; globalDensity: number | null }) {
  return (
    <group>
      {ROADS.map((road, index) => {
        const p1 = getCoords(road.from);
        const p2 = getCoords(road.to);
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);
        const startDensity = junctionMetrics[road.from]?.density ?? globalDensity;
        const endDensity = junctionMetrics[road.to]?.density ?? globalDensity;
        const roadDensity = startDensity != null && endDensity != null ? (startDensity + endDensity) / 2 : globalDensity;
        const color = getDensityColor(roadDensity);
        const opacity = roadDensity != null ? 0.25 + Math.min(0.45, roadDensity / 200) : 0.18;

        return (
          <group key={index} position={[p1.x + dx / 2, 0.01, p1.z + dz / 2]} rotation={[0, -angle, 0]}>
            <mesh>
              <boxGeometry args={[length, 0.05, 0.6]} />
              <meshStandardMaterial color="#27272a" />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <planeGeometry args={[length, 0.5]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <planeGeometry args={[length, 0.05]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Intersections({
  junctionMetrics,
  globalSignal,
  onSelect,
}: {
  junctionMetrics: Record<string, JunctionMetric>;
  globalSignal: string | null;
  onSelect: (junctionId: string | null) => void;
}) {
  return (
    <group>
      {JUNCTIONS.map((junction) => {
        const metric = junctionMetrics[junction.id];
        const densityColor = getDensityColor(metric?.density ?? null);
        const signalColor = !metric?.available ? "#71717a" : globalSignal === "EW_GREEN" ? "#38bdf8" : "#22c55e";

        return (
          <group key={junction.id} position={[junction.x, 0, junction.z]} onClick={(event) => { event.stopPropagation(); onSelect(junction.id); }}>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 0.1, 16]} />
              <meshStandardMaterial color="#3f3f46" />
            </mesh>
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.8, 1.2, 32]} />
              <meshBasicMaterial color={densityColor} transparent opacity={0.28} />
            </mesh>
            <group position={[0.6, 0, -0.6]}>
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[0, 1.1, 0]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color={signalColor} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}

function MovingVehicles({ totalCount }: { totalCount: number }) {
  const meshesRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const vehicles = useMemo(() => {
    const count = Math.min(120, Math.max(0, Math.floor(totalCount * 0.35)));
    return Array.from({ length: count }, (_, index) => ({
      baseRoadIndex: index % ROADS.length,
      direction: index % 2 === 0 ? 1 : -1,
      speed: 0.45 + (index % 6) * 0.09,
      phaseOffset: (index % 19) / 19,
      color: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
    }));
  }, [totalCount]);

  useFrame((state) => {
    if (!meshesRef.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    vehicles.forEach((vehicle, index) => {
      const roadIndex = Math.floor((elapsed / 18 + vehicle.baseRoadIndex + index * 0.03) % ROADS.length);
      const road = ROADS[roadIndex];
      const p1 = getCoords(road.from);
      const p2 = getCoords(road.to);
      const cycle = (elapsed * vehicle.speed * 0.05 + vehicle.phaseOffset) % 1;
      const progress = vehicle.direction === 1 ? cycle : 1 - cycle;
      const x = p1.x + (p2.x - p1.x) * progress;
      const z = p1.z + (p2.z - p1.z) * progress;
      const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
      const laneOffset = vehicle.direction === 1 ? 0.2 : -0.2;
      const ox = Math.sin(angle) * laneOffset;
      const oz = -Math.cos(angle) * laneOffset;

      dummy.position.set(x + ox, 0.1, z + oz);
      dummy.rotation.y = vehicle.direction === 1 ? -angle : -angle + Math.PI;
      dummy.updateMatrix();

      meshesRef.current.setMatrixAt(index, dummy.matrix);
      meshesRef.current.setColorAt(index, new THREE.Color(vehicle.color));
    });

    meshesRef.current.instanceMatrix.needsUpdate = true;
    if (meshesRef.current.instanceColor) {
      meshesRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (vehicles.length === 0) {
    return null;
  }

  return (
    <instancedMesh ref={meshesRef} args={[undefined, undefined, vehicles.length]}>
      <boxGeometry args={[0.3, 0.15, 0.15]} />
      <meshStandardMaterial roughness={0.2} metalness={0.8} />
    </instancedMesh>
  );
}

export default function DigitalTwin() {
  const { data: telemetry } = useLiveTelemetry();
  const { data: network } = useSystemNetwork();
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);

  const zoneMap = useMemo(() => {
    const entries = (network?.zones || []).map((zone) => [zone.id, zone]);
    return Object.fromEntries(entries) as Record<string, SystemZoneSnapshot>;
  }, [network?.zones]);

  const globalDensity = telemetry.density > 0 ? telemetry.density : network?.avg_congestion_pct ?? null;
  const fallbackVehicles = useMemo(() => {
    const liveVehicleSum = (network?.zones || []).reduce((sum, zone) => sum + (zone.vehicle_estimate || 0), 0);
    return liveVehicleSum > 0 ? liveVehicleSum : 0;
  }, [network?.zones]);

  const vehicleCount = telemetry.vehicle_count > 0 ? telemetry.vehicle_count : fallbackVehicles;
  const signalPhase = telemetry.signal_phase || null;
  const latency = network?.network_latency_ms ?? telemetry.network_latency ?? null;

  const junctionMetrics = useMemo(() => {
    const metrics: Record<string, JunctionMetric> = {};
    JUNCTIONS.forEach((junction) => {
      const zone = zoneMap[junction.zoneId];
      metrics[junction.id] = {
        zone,
        density: zone?.congestion_pct ?? globalDensity,
        vehicleEstimate: zone?.vehicle_estimate ?? null,
        available: Boolean(zone?.available),
      };
    });
    return metrics;
  }, [globalDensity, zoneMap]);

  const selectedMetric = selectedJunctionId ? junctionMetrics[selectedJunctionId] : null;
  const selectedJunction = selectedJunctionId ? JUNCTIONS.find((junction) => junction.id === selectedJunctionId) || null : null;

  return (
    <div className="h-screen w-full relative bg-zinc-950 overflow-hidden">
      <div className="absolute top-20 left-6 z-10 pointer-events-none">
        <h1 className="text-4xl font-heading font-black text-white tracking-widest drop-shadow-lg">DIGITAL TWIN</h1>
        <div className="flex items-center gap-3 mt-2 font-mono text-sm text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {telemetry.telemetry_status === "live" ? "LIVE NETWORK VISUALIZATION" : "WAITING FOR LIVE NETWORK DATA"}
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
              <div className="text-xl font-bold font-mono">{globalDensity != null ? `${globalDensity.toFixed(1)}%` : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono">VEHICLES</div>
              <div className="text-xl font-bold font-mono">{vehicleCount > 0 ? vehicleCount : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono">AI STATE</div>
              <div className="text-sm font-bold font-mono text-success">{signalPhase || "UNAVAILABLE"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono">LATENCY</div>
              <div className="text-sm font-bold font-mono text-cyan">{latency != null ? `${latency.toFixed(0)} ms` : "—"}</div>
            </div>
          </div>
        </div>

        {selectedJunction && selectedMetric && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass p-4 rounded-xl border border-accent/30 bg-accent/5 backdrop-blur-md">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-heading font-bold text-lg text-accent">{selectedJunction.name}</h3>
              <button onClick={() => setSelectedJunctionId(null)} className="text-muted-foreground hover:text-white">&times;</button>
            </div>

            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span>{selectedMetric.zone?.data_source || "Unavailable"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Area:</span>
                <span className="text-right max-w-[160px]">{selectedMetric.zone?.area || "Unavailable"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Local Density:</span>
                <span className={selectedMetric.density != null && selectedMetric.density > 70 ? "text-destructive" : "text-warning"}>
                  {selectedMetric.density != null ? `${selectedMetric.density.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Vehicles:</span>
                <span>{selectedMetric.vehicleEstimate != null ? selectedMetric.vehicleEstimate : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Speed:</span>
                <span>{selectedMetric.zone?.current_speed_kmph != null ? `${selectedMetric.zone.current_speed_kmph.toFixed(1)} km/h` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coords:</span>
                <span>{selectedMetric.zone ? `${selectedMetric.zone.lat.toFixed(4)}, ${selectedMetric.zone.lon.toFixed(4)}` : "—"}</span>
              </div>
              <div className="pt-3 border-t border-border/20 text-xs text-muted-foreground flex items-center gap-2">
                <Radio className="w-3 h-3 text-primary" />
                {network?.updated_at ? `Updated ${new Date(network.updated_at).toLocaleTimeString()}` : "Waiting for live refresh"}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <Canvas camera={{ position: [0, 15, 20], fov: 45 }} className="w-full h-full" onPointerMissed={() => setSelectedJunctionId(null)}>
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

        <RoadNetwork junctionMetrics={junctionMetrics} globalDensity={globalDensity} />
        <Intersections junctionMetrics={junctionMetrics} globalSignal={signalPhase} onSelect={setSelectedJunctionId} />
        <MovingVehicles totalCount={vehicleCount} />

        {selectedJunction && (
          <mesh position={[selectedJunction.x, 2, selectedJunction.z]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color="#38bdf8" />
            <Html center position={[0, 0.5, 0]}>
              <div className="bg-black/80 px-2 py-1 rounded text-xs font-mono border border-cyan/30 text-cyan animate-pulse">
                SELECTED
              </div>
            </Html>
          </mesh>
        )}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={40}
        />

        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
