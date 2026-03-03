import { MutableRefObject, RefObject, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Points } from 'three';

type InteractiveDotGridProps = {
  containerRef: RefObject<HTMLElement>;
  spacingPx?: number;
  dotSize?: number;
  color?: string;
};

type DotFieldInnerProps = {
  pointerRef: MutableRefObject<{ x: number; y: number; vx: number; vy: number; speed: number; active: boolean; lastMoveAt: number }>;
  spacingPx: number;
  dotSize: number;
  color: string;
};

function DotFieldInner({ pointerRef, spacingPx, dotSize, color }: DotFieldInnerProps) {
  const pointsRef = useRef<Points>(null);
  const { size, viewport } = useThree();

  const data = useMemo(() => {
    const columns = Math.max(12, Math.floor(size.width / spacingPx) + 1);
    const rows = Math.max(8, Math.floor(size.height / spacingPx) + 1);
    const count = columns * rows;

    const base = new Float32Array(count * 3);
    const current = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const driftLife = new Float32Array(count);
    const phase = new Float32Array(count);
    const jitter = new Float32Array(count);
    const cooldown = new Float32Array(count);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const index = row * columns + col;
        const i3 = index * 3;

        const x = -viewport.width / 2 + (col / Math.max(1, columns - 1)) * viewport.width;
        const y = viewport.height / 2 - (row / Math.max(1, rows - 1)) * viewport.height;

        base[i3] = x;
        base[i3 + 1] = y;
        base[i3 + 2] = 0;

        current[i3] = x;
        current[i3 + 1] = y;
        current[i3 + 2] = 0;

        velocity[i3] = 0;
        velocity[i3 + 1] = 0;
        velocity[i3 + 2] = 0;

        driftLife[index] = 0;
        phase[index] = Math.random() * Math.PI * 2;
        jitter[index] = 0.45 + Math.random() * 0.8;
        cooldown[index] = 0;
      }
    }

    return { base, current, velocity, driftLife, phase, jitter, cooldown, count };
  }, [size.width, size.height, spacingPx, viewport.width, viewport.height]);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(data.current, 3));
    return g;
  }, [data]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const pointer = pointerRef.current;
    const pointerX = (pointer.x * viewport.width) / 2;
    const pointerY = (pointer.y * viewport.height) / 2;
    const pointerIsStable = pointer.active && pointer.speed < 28 && performance.now() - pointer.lastMoveAt > 170;

    const influenceRadius = Math.max(viewport.width, viewport.height) * 0.14;
    const repelStrength = 0.78;
    const baseSpring = 0.05;
    const damping = 0.972;
    const maxSpeed = 0.072;
    const dt = Math.min(delta, 0.033);

    for (let i = 0; i < data.count; i += 1) {
      const i3 = i * 3;

      const baseX = data.base[i3];
      const baseY = data.base[i3 + 1];
      let currentX = data.current[i3];
      let currentY = data.current[i3 + 1];
      let velocityX = data.velocity[i3];
      let velocityY = data.velocity[i3 + 1];
      let life = data.driftLife[i];
      let dotCooldown = data.cooldown[i];

      if (pointer.active && !pointerIsStable) {
        const dx = currentX - pointerX;
        const dy = currentY - pointerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < influenceRadius && dotCooldown <= 0) {
          const t = 1 - distance / influenceRadius;
          const inv = 1 / Math.max(distance, 0.001);
          const radialX = dx * inv;
          const radialY = dy * inv;

          const tangentX = -radialY;
          const tangentY = radialX;

          const pointerSpeed = Math.min(1, pointer.speed / 1400);
          const pointerInv = 1 / Math.max(Math.hypot(pointer.vx, pointer.vy), 0.001);
          const pointerDirX = pointer.vx * pointerInv;
          const pointerDirY = pointer.vy * pointerInv;

          const randAngle = data.phase[i] + state.clock.elapsedTime * 0.8;
          const randomX = Math.cos(randAngle);
          const randomY = Math.sin(randAngle);

          const scatterX = radialX * 0.22 + tangentX * 0.42 + randomX * 0.26 + pointerDirX * 0.1;
          const scatterY = radialY * 0.22 + tangentY * 0.42 + randomY * 0.26 + pointerDirY * 0.1;

          const impulse = (0.22 + pointerSpeed * 0.24) * t * repelStrength * data.jitter[i];
          velocityX += scatterX * impulse;
          velocityY += scatterY * impulse;
          life = Math.max(life, 0.9 + t * 0.32);
          dotCooldown = 0.04 + Math.random() * 0.1;
        }
      }

      dotCooldown = Math.max(0, dotCooldown - dt);
      life *= pointerIsStable ? 0.95 : 0.992;
      const wander = (pointerIsStable ? 0 : life * 0.013 * data.jitter[i]);
      const driftX = Math.sin(state.clock.elapsedTime * (0.75 + data.jitter[i] * 0.45) + data.phase[i]) * wander;
      const driftY = Math.cos(state.clock.elapsedTime * (0.68 + data.jitter[i] * 0.35) + data.phase[i] * 1.4) * wander;

      velocityX += driftX;
      velocityY += driftY;

      const springStrength = baseSpring + (1 - life) * (pointerIsStable ? 0.2 : 0.08);
      velocityX += (baseX - currentX) * springStrength * dt * 60;
      velocityY += (baseY - currentY) * springStrength * dt * 60;

      const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      if (speed > maxSpeed) {
        const clamp = maxSpeed / speed;
        velocityX *= clamp;
        velocityY *= clamp;
      }

      velocityX *= damping;
      velocityY *= damping;

      currentX += velocityX;
      currentY += velocityY;

      data.current[i3] = currentX;
      data.current[i3 + 1] = currentY;
      data.current[i3 + 2] = 0;

      data.velocity[i3] = velocityX;
      data.velocity[i3 + 1] = velocityY;
      data.driftLife[i] = life;
      data.cooldown[i] = dotCooldown;
    }

    const position = points.geometry.getAttribute('position') as BufferAttribute;
    position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={dotSize}
        sizeAttenuation={false}
        transparent
        opacity={0.38}
        depthWrite={false}
      />
    </points>
  );
}

export function InteractiveDotGrid({
  containerRef,
  spacingPx = 28,
  dotSize = 1.75,
  color = '#CC8BED',
}: InteractiveDotGridProps) {
  const pointerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, speed: 0, active: false, lastMoveAt: 0 });
  const moveStateRef = useRef({ lastTime: 0, lastX: 0, lastY: 0, seeded: false });

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        pointerRef.current.active = false;
        pointerRef.current.speed *= 0.9;
        return;
      }

      const now = performance.now();
      const moveState = moveStateRef.current;
      if (!moveState.seeded) {
        moveState.lastTime = now;
        moveState.lastX = event.clientX;
        moveState.lastY = event.clientY;
        moveState.seeded = true;
      }

      const dt = Math.max(8, now - moveState.lastTime);
      const prevX = moveState.lastX;
      const prevY = moveState.lastY;
      const vx = ((event.clientX - prevX) / dt) * 1000;
      const vy = ((event.clientY - prevY) / dt) * 1000;

      moveState.lastTime = now;
      moveState.lastX = event.clientX;
      moveState.lastY = event.clientY;

      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      pointerRef.current.x = x;
      pointerRef.current.y = y;
      pointerRef.current.vx = vx;
      pointerRef.current.vy = vy;
      pointerRef.current.speed = Math.min(3200, Math.hypot(vx, vy));
      pointerRef.current.lastMoveAt = now;
      pointerRef.current.active = true;
    };

    const handleLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.speed = 0;
      pointerRef.current.lastMoveAt = performance.now();
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerleave', handleLeave);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, [containerRef]);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ zoom: 80, position: [0, 0, 10] }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
      >
        <DotFieldInner pointerRef={pointerRef} spacingPx={spacingPx} dotSize={dotSize} color={color} />
      </Canvas>
    </div>
  );
}
