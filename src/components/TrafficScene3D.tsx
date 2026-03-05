import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function Road({ position, rotation, length = 8, width = 2 }: { position: [number, number, number]; rotation?: [number, number, number]; length?: number; width?: number }) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]} receiveShadow>
      <boxGeometry args={[length, 0.05, width]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      {/* Center line */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[length, 0.01, 0.05]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
    </mesh>
  );
}

function Building({ position, height, width = 0.8, color }: { position: [number, number, number]; height: number; width?: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const windowEmissive = useMemo(() => Math.random() > 0.5 ? 0.5 : 0.1, []);

  return (
    <group position={position}>
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Windows */}
      {Array.from({ length: Math.floor(height / 0.4) }).map((_, i) => (
        <mesh key={i} position={[width / 2 + 0.01, 0.3 + i * 0.4, 0]} castShadow>
          <boxGeometry args={[0.01, 0.15, 0.15]} />
          <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={windowEmissive} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function TrafficLight({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
        <meshStandardMaterial color="#333" metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.15, 0.35, 0.1]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 1.3, 0.06]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

function Car({ startPosition, direction, speed, color }: { startPosition: [number, number, number]; direction: [number, number, number]; speed: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = ((state.clock.elapsedTime * speed + offset) % 8) - 4;
    ref.current.position.set(
      startPosition[0] + direction[0] * t,
      startPosition[1],
      startPosition[2] + direction[2] * t
    );
  });

  return (
    <group ref={ref}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.12, 0.15]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0.02, 0.1, 0]} castShadow>
        <boxGeometry args={[0.15, 0.08, 0.13]} />
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.7} />
      </mesh>
      {/* Headlights */}
      <mesh position={[0.16, 0, 0.05]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#fff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-0.16, 0, 0.05]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function GridFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#0a0a15" roughness={0.9} />
    </mesh>
  );
}

function Scene({ density, emergency }: { density: number; emergency: boolean }) {
  const carCount = Math.max(2, Math.floor(density / 12));
  const carColors = ["#a855f7", "#06b6d4", "#f59e0b", "#ef4444", "#22c55e", "#ec4899"];

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 10, 5]} intensity={0.4} castShadow color="#c4b5fd" />
      <pointLight position={[0, 3, 0]} intensity={0.8} color={emergency ? "#22c55e" : "#a855f7"} />
      <pointLight position={[-3, 2, 3]} intensity={0.3} color="#06b6d4" />
      <pointLight position={[3, 2, -3]} intensity={0.3} color="#ec4899" />

      {/* Fog */}
      <fog attach="fog" args={["#0a0a15", 8, 20]} />

      <GridFloor />

      {/* Roads */}
      <Road position={[0, 0, 0]} length={16} width={1.8} />
      <Road position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]} length={16} width={1.8} />

      {/* Buildings */}
      <Building position={[-3, 0, -3]} height={2.5} color="#1a1a3e" />
      <Building position={[-2, 0, -3.5]} height={1.8} color="#1e1e45" />
      <Building position={[-3.5, 0, -2]} height={3.2} width={1} color="#15153a" />
      <Building position={[3, 0, -3]} height={2} color="#1a1a3e" />
      <Building position={[3.5, 0, -2.5]} height={2.8} color="#1e1e45" />
      <Building position={[3, 0, 3]} height={1.5} color="#1a1a3e" />
      <Building position={[2.5, 0, 3.5]} height={3.5} width={1.2} color="#15153a" />
      <Building position={[-3, 0, 3]} height={2.2} color="#1e1e45" />
      <Building position={[-3.5, 0, 2.5]} height={1.6} color="#1a1a3e" />

      {/* Traffic Lights */}
      <TrafficLight position={[1.2, 0, 1.2]} color={emergency ? "#22c55e" : "#ef4444"} />
      <TrafficLight position={[-1.2, 0, -1.2]} color={emergency ? "#22c55e" : "#22c55e"} />
      <TrafficLight position={[1.2, 0, -1.2]} color={emergency ? "#22c55e" : "#fbbf24"} />
      <TrafficLight position={[-1.2, 0, 1.2]} color={emergency ? "#22c55e" : "#ef4444"} />

      {/* Cars */}
      {Array.from({ length: carCount }).map((_, i) => {
        const isHorizontal = i % 2 === 0;
        return (
          <Car
            key={i}
            startPosition={isHorizontal ? [0, 0.08, (i % 3 - 1) * 0.4] : [(i % 3 - 1) * 0.4, 0.08, 0]}
            direction={isHorizontal ? [1, 0, 0] : [0, 0, 1]}
            speed={0.3 + Math.random() * 0.4}
            color={carColors[i % carColors.length]}
          />
        );
      })}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={12}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  );
}

export default function TrafficScene3D({ density = 65, emergency = false, className = "" }: { density?: number; emergency?: boolean; className?: string }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows
        camera={{ position: [5, 4, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene density={density} emergency={emergency} />
      </Canvas>
    </div>
  );
}
