import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

const cities = [
  { name: "New York", lat: 40.7, lng: -74.0 },
  { name: "London", lat: 51.5, lng: -0.1 },
  { name: "Tokyo", lat: 35.7, lng: 139.7 },
  { name: "Dubai", lat: 25.2, lng: 55.3 },
  { name: "Sydney", lat: -33.9, lng: 151.2 },
  { name: "São Paulo", lat: -23.5, lng: -46.6 },
  { name: "Singapore", lat: 1.3, lng: 103.8 },
  { name: "Mumbai", lat: 19.1, lng: 72.9 },
  { name: "Berlin", lat: 52.5, lng: 13.4 },
  { name: "Lagos", lat: 6.5, lng: 3.4 },
  { name: "Seoul", lat: 37.6, lng: 127.0 },
  { name: "Mexico City", lat: 19.4, lng: -99.1 },
];

const connections = [
  [0, 1], [0, 5], [1, 3], [1, 8], [2, 6], [2, 10],
  [3, 7], [4, 6], [5, 11], [6, 7], [8, 9], [9, 3],
  [10, 2], [11, 0], [7, 4], [1, 2],
];

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function CityNode({ position, name }: { position: THREE.Vector3; name: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color={hovered ? "hsl(50, 100%, 70%)" : "hsl(185, 100%, 50%)"} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.06, 0.09, 24]} />
        <meshBasicMaterial color="hsl(185, 100%, 50%)" transparent opacity={hovered ? 0.8 : 0.4} side={THREE.DoubleSide} />
      </mesh>
      {hovered && (
        <Html distanceFactor={6} center style={{ pointerEvents: "none" }}>
          <div className="px-3 py-1.5 rounded-lg bg-background/90 border border-primary/40 backdrop-blur-md text-primary text-xs font-mono tracking-wider whitespace-nowrap shadow-lg shadow-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan inline-block mr-2 animate-pulse" />
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}

function ArcParticle({ curve, speed, delay }: { curve: THREE.QuadraticBezierCurve3; speed: number; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.getElapsedTime() * speed + delay) % 1);
    const pos = curve.getPoint(t);
    ref.current.position.copy(pos);
    const opacity = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.9;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.018, 6, 6]} />
      <meshBasicMaterial color="hsl(185, 100%, 65%)" transparent />
    </mesh>
  );
}

function GlobeWireframe() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.08;
  });

  const nodePositions = useMemo(
    () => cities.map((c) => latLngToVec3(c.lat, c.lng, 2.02)),
    []
  );

  const arcData = useMemo(() => {
    return connections.map(([a, b]) => {
      const start = nodePositions[a];
      const end = nodePositions[b];
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(2.6);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(48);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return { curve, geo };
    });
  }, [nodePositions]);

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[2, 36, 24]} />
        <meshBasicMaterial color="hsl(270, 80%, 60%)" wireframe opacity={0.12} transparent />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.98, 36, 24]} />
        <meshBasicMaterial color="#0a0a14" opacity={0.9} transparent />
      </mesh>

      {/* City nodes with hover labels */}
      {nodePositions.map((pos, i) => (
        <CityNode key={i} position={pos} name={cities[i].name} />
      ))}

      {/* Connection arcs */}
      {arcData.map(({ geo }, i) => (
        <primitive key={`arc-${i}`} object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "hsl(270, 80%, 60%)", transparent: true, opacity: 0.35 }))} />
      ))}

      {/* Animated particles along arcs */}
      {arcData.map(({ curve }, i) => (
        <group key={`particles-${i}`}>
          <ArcParticle curve={curve} speed={0.25} delay={i * 0.15} />
          <ArcParticle curve={curve} speed={0.25} delay={i * 0.15 + 0.5} />
        </group>
      ))}

      {/* Pulse rings */}
      {nodePositions.map((pos, i) => (
        <PulseRing key={`pulse-${i}`} position={pos} delay={i * 0.5} />
      ))}
    </group>
  );
}

function PulseRing({ position, delay }: { position: THREE.Vector3; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.getElapsedTime() + delay) % 3) / 3;
    ref.current.scale.setScalar(1 + t * 3);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
  });

  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.03, 0.045, 24]} />
      <meshBasicMaterial color="hsl(185, 100%, 50%)" transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

import SafeCanvas from "./SafeCanvas";

export default function Globe3D({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <SafeCanvas
        camera={{ position: [0, 1.5, 5], fov: 40 }}
        dpr={[1, 1.5]}
        componentName="Global Intelligence Globe"
      >
        <ambientLight intensity={0.5} />
        <GlobeWireframe />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI * 0.3}
          maxPolarAngle={Math.PI * 0.7}
        />
      </SafeCanvas>
    </div>
  );
}
