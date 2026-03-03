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
  pointerRef: MutableRefObject<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
    active: boolean;
    lastMoveAt: number;
    isDragging: boolean;
  }>;
  spacingPx: number;
  dotSize: number;
  color: string;
};

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function DotFieldInner({ pointerRef, spacingPx, dotSize, color }: DotFieldInnerProps) {
  const pointsRef = useRef<Points>(null);
  const hoverPointsRef = useRef<Points>(null);
  const { size, viewport } = useThree();
  const baseRgb = useMemo(() => hexToRgb01(color), [color]);
  const hoverRgb = useMemo<[number, number, number]>(() => [0.97, 0.92, 1], []);

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
    const hoverIntensity = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const hoverPositions = new Float32Array(count * 3);
    const hoverColors = new Float32Array(count * 3);

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
        hoverIntensity[index] = 0;

        colors[i3] = baseRgb[0];
        colors[i3 + 1] = baseRgb[1];
        colors[i3 + 2] = baseRgb[2];

        hoverPositions[i3] = 0;
        hoverPositions[i3 + 1] = 0;
        hoverPositions[i3 + 2] = 0;

        hoverColors[i3] = hoverRgb[0];
        hoverColors[i3 + 1] = hoverRgb[1];
        hoverColors[i3 + 2] = hoverRgb[2];
      }
    }

    return {
      base,
      current,
      velocity,
      driftLife,
      phase,
      jitter,
      cooldown,
      hoverIntensity,
      colors,
      hoverPositions,
      hoverColors,
      count,
    };
  }, [size.width, size.height, spacingPx, viewport.width, viewport.height, baseRgb, hoverRgb]);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(data.current, 3));
    g.setAttribute('color', new BufferAttribute(data.colors, 3));
    return g;
  }, [data]);

  const hoverGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(data.hoverPositions, 3));
    g.setAttribute('color', new BufferAttribute(data.hoverColors, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [data]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      hoverGeometry.dispose();
    };
  }, [geometry, hoverGeometry]);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const pointer = pointerRef.current;
    const pointerX = (pointer.x * viewport.width) / 2;
    const pointerY = (pointer.y * viewport.height) / 2;
    const pointerIsStable = pointer.active && pointer.speed < 28 && performance.now() - pointer.lastMoveAt > 170;

    const influenceRadius = Math.max(viewport.width, viewport.height) * 0.12;
    const repelStrength = 0.34;
    const baseSpring = 0.05;
    const damping = 0.95;
    const maxSpeed = 0.038;
    const dt = Math.min(delta, 0.033);
    let hoverCount = 0;

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
      let intensity = data.hoverIntensity[i];

      if (pointer.active && !pointerIsStable) {
        const dx = currentX - pointerX;
        const dy = currentY - pointerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < influenceRadius && dotCooldown <= 0) {
          const t = 1 - distance / influenceRadius;
          const inv = 1 / Math.max(distance, 0.001);
          const radialX = dx * inv;
          const radialY = dy * inv;

          const pointerSpeed = Math.min(1, pointer.speed / 1800);
          const pointerInv = 1 / Math.max(Math.hypot(pointer.vx, pointer.vy), 0.001);
          const pointerDirX = pointer.vx * pointerInv;
          const pointerDirY = pointer.vy * pointerInv;

          const flowX = radialX * 0.92 + pointerDirX * 0.08;
          const flowY = radialY * 0.92 + pointerDirY * 0.08;

          const impulse = (0.05 + pointerSpeed * 0.07) * t * repelStrength * data.jitter[i];
          velocityX += flowX * impulse;
          velocityY += flowY * impulse;
          life = Math.max(life, 0.24 + t * 0.12);
          dotCooldown = 0.03 + Math.random() * 0.07;
          intensity = Math.min(1, intensity + t * 0.32);
        }
      }

      dotCooldown = Math.max(0, dotCooldown - dt);
      life *= pointerIsStable ? 0.88 : 0.94;
      intensity *= pointerIsStable ? 0.9 : 0.955;

      const springStrength = baseSpring + (1 - life) * (pointerIsStable ? 0.24 : 0.13);
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
      data.hoverIntensity[i] = intensity;

      const glow = Math.max(0, Math.min(1, intensity));
      data.colors[i3] = baseRgb[0] + (hoverRgb[0] - baseRgb[0]) * glow;
      data.colors[i3 + 1] = baseRgb[1] + (hoverRgb[1] - baseRgb[1]) * glow;
      data.colors[i3 + 2] = baseRgb[2] + (hoverRgb[2] - baseRgb[2]) * glow;

      if (glow > 0.08) {
        const hi3 = hoverCount * 3;
        data.hoverPositions[hi3] = currentX;
        data.hoverPositions[hi3 + 1] = currentY;
        data.hoverPositions[hi3 + 2] = 0;

        const hg = Math.min(1, glow * 1.15);
        data.hoverColors[hi3] = hoverRgb[0] * hg;
        data.hoverColors[hi3 + 1] = hoverRgb[1] * hg;
        data.hoverColors[hi3 + 2] = hoverRgb[2] * hg;
        hoverCount += 1;
      }
    }

    const position = points.geometry.getAttribute('position') as BufferAttribute;
    position.needsUpdate = true;
    const colorAttr = points.geometry.getAttribute('color') as BufferAttribute;
    colorAttr.needsUpdate = true;

    const hoverPoints = hoverPointsRef.current;
    if (hoverPoints) {
      const hPos = hoverPoints.geometry.getAttribute('position') as BufferAttribute;
      const hColor = hoverPoints.geometry.getAttribute('color') as BufferAttribute;
      hPos.needsUpdate = true;
      hColor.needsUpdate = true;
      hoverPoints.geometry.setDrawRange(0, hoverCount);
    }
  });

  return (
    <>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={dotSize}
          sizeAttenuation={false}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </points>
      <points ref={hoverPointsRef} geometry={hoverGeometry}>
        <pointsMaterial
          vertexColors
          size={dotSize * 1.55}
          sizeAttenuation={false}
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </points>
    </>
  );
}

export function InteractiveDotGrid({
  containerRef,
  spacingPx = 28,
  dotSize = 1.75,
  color = '#CC8BED',
}: InteractiveDotGridProps) {
  const pointerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, speed: 0, active: false, lastMoveAt: 0, isDragging: false });
  const moveStateRef = useRef({ lastTime: 0, lastX: 0, lastY: 0, seeded: false });

  useEffect(() => {
    const setPointerFromEvent = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return false;

      const rect = container.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      const isTouchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
      if (!inside || (isTouchLike && !pointerRef.current.isDragging)) {
        pointerRef.current.active = false;
        pointerRef.current.speed *= 0.9;
        return false;
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
      return true;
    };

    const handleDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        pointerRef.current.isDragging = true;
        setPointerFromEvent(event);
      }
    };

    const handleUp = () => {
      pointerRef.current.isDragging = false;
      pointerRef.current.active = false;
      pointerRef.current.speed = 0;
      pointerRef.current.lastMoveAt = performance.now();
    };

    const handleMove = (event: PointerEvent) => {
      setPointerFromEvent(event);
    };

    const handleLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.speed = 0;
      pointerRef.current.lastMoveAt = performance.now();
      pointerRef.current.isDragging = false;
    };

    window.addEventListener('pointerdown', handleDown, { passive: true });
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp, { passive: true });
    window.addEventListener('pointercancel', handleUp, { passive: true });
    window.addEventListener('pointerleave', handleLeave);

    return () => {
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
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
