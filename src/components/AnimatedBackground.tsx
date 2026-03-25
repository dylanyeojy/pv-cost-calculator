import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';

interface Dot {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
}

const SPACING = 30;
const INFLUENCE_RADIUS = 130;
const REPULSION = 6.5;
const SPRING = 0.055;
const DAMPING = 0.72;
const DOT_RADIUS = 1.4;

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef<number>(0);
  const { resolvedTheme } = useTheme();

  const buildDots = useCallback((w: number, h: number) => {
    const dots: Dot[] = [];
    const cols = Math.ceil(w / SPACING) + 2;
    const rows = Math.ceil(h / SPACING) + 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ox = c * SPACING;
        const oy = r * SPACING;
        dots.push({ x: ox, y: oy, originX: ox, originY: oy, vx: 0, vy: 0 });
      }
    }
    return dots;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = resolvedTheme === 'dark';

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      dotsRef.current = buildDots(canvas.width, canvas.height);
    };
    resize();

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dot color adapts to theme
      ctx.fillStyle = isDark
        ? 'rgba(99, 155, 230, 0.22)'   // steel blue tint in dark
        : 'rgba(30, 60, 110, 0.13)';   // deep navy in light

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const dot of dotsRef.current) {
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const distSq = dx * dx + dy * dy;

        if (distSq < INFLUENCE_RADIUS * INFLUENCE_RADIUS && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / INFLUENCE_RADIUS) ** 2;
          dot.vx += (dx / dist) * force * REPULSION;
          dot.vy += (dy / dist) * force * REPULSION;
        }

        // Spring back to origin
        dot.vx += (dot.originX - dot.x) * SPRING;
        dot.vy += (dot.originY - dot.y) * SPRING;

        // Damping
        dot.vx *= DAMPING;
        dot.vy *= DAMPING;

        dot.x += dot.vx;
        dot.y += dot.vy;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', resize);
    };
  }, [resolvedTheme, buildDots]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none no-print"
      aria-hidden="true"
    />
  );
}
