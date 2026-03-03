import { RefObject, useEffect, useRef } from 'react';

type InteractiveDotGridProps = {
  containerRef: RefObject<HTMLElement>;
  spacingPx?: number;
  dotSize?: number;
  color?: string;
};

type Dot = {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  jitter: number;
  cooldown: number;
  life: number;
};

function hexToRgba(hexColor: string, alpha: number) {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length !== 6) {
    return `rgba(204,139,237,${alpha})`;
  }
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function InteractiveDotGrid({
  containerRef,
  spacingPx = 28,
  dotSize = 1.75,
  color = '#CC8BED',
}: InteractiveDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const animationRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, speed: 0, active: false });
  const lastPointerRef = useRef({ x: 0, y: 0, t: 0, seeded: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const pointer = pointerRef.current;
    let width = 0;
    let height = 0;

    const buildDots = () => {
      const columns = Math.max(12, Math.floor(width / spacingPx) + 1);
      const rows = Math.max(8, Math.floor(height / spacingPx) + 1);
      const dots: Dot[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = (column / Math.max(1, columns - 1)) * width;
          const y = (row / Math.max(1, rows - 1)) * height;

          dots.push({
            baseX: x,
            baseY: y,
            x,
            y,
            vx: 0,
            vy: 0,
            phase: Math.random() * Math.PI * 2,
            jitter: 0.45 + Math.random() * 0.8,
            cooldown: 0,
            life: 0,
          });
        }
      }

      dotsRef.current = dots;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    };

    const onMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        pointer.active = false;
        pointer.speed *= 0.86;
        return;
      }

      const now = performance.now();
      const last = lastPointerRef.current;
      if (!last.seeded) {
        last.x = event.clientX;
        last.y = event.clientY;
        last.t = now;
        last.seeded = true;
      }

      const dt = Math.max(8, now - last.t);
      const vx = ((event.clientX - last.x) / dt) * 1000;
      const vy = ((event.clientY - last.y) / dt) * 1000;

      last.x = event.clientX;
      last.y = event.clientY;
      last.t = now;

      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.vx = vx;
      pointer.vy = vy;
      pointer.speed = Math.min(2400, Math.hypot(vx, vy));
      pointer.active = true;
    };

    const onLeave = () => {
      pointer.active = false;
      pointer.speed = 0;
    };

    let prevTime = performance.now();
    const draw = (time: number) => {
      const deltaSeconds = Math.min((time - prevTime) / 1000, 0.033);
      prevTime = time;

      context.clearRect(0, 0, width, height);
      context.fillStyle = hexToRgba(color, 0.38);

      const influenceRadius = Math.max(width, height) * 0.09;
      const repelStrength = 0.46;
      const baseSpring = 0.05;
      const damping = 0.972;
      const maxSpeed = 2.7;

      for (const dot of dotsRef.current) {
        if (pointer.active) {
          const dx = dot.x - pointer.x;
          const dy = dot.y - pointer.y;
          const distance = Math.hypot(dx, dy);

          if (distance < influenceRadius && dot.cooldown <= 0) {
            const t = 1 - distance / influenceRadius;
            const invDistance = 1 / Math.max(distance, 0.001);
            const radialX = dx * invDistance;
            const radialY = dy * invDistance;
            const tangentX = -radialY;
            const tangentY = radialX;

            const pointerSpeed = Math.min(1, pointer.speed / 1400);
            const pointerMagnitudeInv = 1 / Math.max(Math.hypot(pointer.vx, pointer.vy), 0.001);
            const pointerDirX = pointer.vx * pointerMagnitudeInv;
            const pointerDirY = pointer.vy * pointerMagnitudeInv;

            const randomX = Math.cos(dot.phase + time * 0.0008);
            const randomY = Math.sin(dot.phase + time * 0.0008);

            const scatterX = radialX * 0.22 + tangentX * 0.42 + randomX * 0.26 + pointerDirX * 0.1;
            const scatterY = radialY * 0.22 + tangentY * 0.42 + randomY * 0.26 + pointerDirY * 0.1;

            const impulse = (0.5 + pointerSpeed * 0.6) * t * repelStrength * dot.jitter;
            dot.vx += scatterX * impulse;
            dot.vy += scatterY * impulse;
            dot.life = Math.max(dot.life, 0.72 + t * 0.2);
            dot.cooldown = 0.09 + Math.random() * 0.18;
          }
        }

        dot.cooldown = Math.max(0, dot.cooldown - deltaSeconds);
        dot.life *= 0.992;

        const wander = dot.life * 0.65 * dot.jitter;
        const driftX = Math.sin(time * 0.00075 + dot.phase) * wander;
        const driftY = Math.cos(time * 0.00068 + dot.phase * 1.4) * wander;

        dot.vx += driftX * deltaSeconds;
        dot.vy += driftY * deltaSeconds;

        const springStrength = baseSpring + (1 - dot.life) * 0.08;
        dot.vx += (dot.baseX - dot.x) * springStrength * deltaSeconds * 60;
        dot.vy += (dot.baseY - dot.y) * springStrength * deltaSeconds * 60;

        const speed = Math.hypot(dot.vx, dot.vy);
        if (speed > maxSpeed) {
          const clamp = maxSpeed / speed;
          dot.vx *= clamp;
          dot.vy *= clamp;
        }

        dot.vx *= damping;
        dot.vy *= damping;
        dot.x += dot.vx;
        dot.y += dot.vy;

        context.beginPath();
        context.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
        context.fill();
      }

      animationRef.current = window.requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    animationRef.current = window.requestAnimationFrame(draw);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [containerRef, spacingPx, dotSize, color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
