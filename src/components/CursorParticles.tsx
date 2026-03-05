import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  hue: number;
  type: "spark" | "trail";
}

export default function CursorParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: 0, y: 0, prevX: 0, prevY: 0 });
  const raf = useRef<number>(0);

  const spawnParticles = useCallback((x: number, y: number, dx: number, dy: number) => {
    const speed = Math.sqrt(dx * dx + dy * dy);
    const count = Math.min(Math.floor(speed * 0.4) + 2, 8);

    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
      const vel = Math.random() * 2 + 0.5;
      particles.current.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: -Math.cos(angle) * vel * 0.8,
        vy: -Math.sin(angle) * vel * 0.8,
        life: 1,
        size: Math.random() * 5 + 2,
        hue: Math.random() > 0.4 ? 270 : 185,
        type: "spark",
      });
    }

    // Comet trail (larger, slower fading)
    particles.current.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 1,
      size: Math.random() * 8 + 6,
      hue: Math.random() > 0.5 ? 270 : 185,
      type: "trail",
    });

    if (particles.current.length > 250) {
      particles.current.splice(0, particles.current.length - 250);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const dx = e.clientX - mouse.current.x;
      const dy = e.clientY - mouse.current.y;
      mouse.current.prevX = mouse.current.x;
      mouse.current.prevY = mouse.current.y;
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      spawnParticles(e.clientX, e.clientY, dx, dy);
    };
    window.addEventListener("mousemove", handleMouse);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current = particles.current.filter((p) => {
        p.life -= p.type === "trail" ? 0.015 : 0.025;
        p.x += p.vx;
        p.y += p.vy;
        if (p.type === "spark") {
          p.vy += 0.03;
          p.vx *= 0.98;
        }

        if (p.life <= 0) return false;

        const alpha = p.life;
        const radius = p.size * (p.type === "trail" ? p.life * 0.8 : p.life);

        if (p.type === "trail") {
          // Glow layer
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2);
          gradient.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${alpha * 0.4})`);
          gradient.addColorStop(0.4, `hsla(${p.hue}, 80%, 55%, ${alpha * 0.15})`);
          gradient.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 2, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 85%, ${p.type === "trail" ? 65 : 70}%, ${alpha * 0.8})`;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, ${alpha})`;
        ctx.shadowBlur = p.type === "trail" ? 20 : 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        return true;
      });

      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      cancelAnimationFrame(raf.current);
    };
  }, [spawnParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[5] pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
