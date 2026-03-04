import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Grid2X2, Layers, MousePointer2, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const InteractiveDotGrid = lazy(() =>
  import('./landing/InteractiveDotGrid').then((mod) => ({ default: mod.InteractiveDotGrid }))
);

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const workflowRef = useRef<HTMLElement>(null);
  const canvas3dRef = useRef<HTMLDivElement>(null);
  const heroLayersRef = useRef<HTMLDivElement[]>([]);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const canvas = canvas3dRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;
      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;
      const layer = heroLayersRef.current[0];
      if (layer) {
        const depth = 15;
        const moveX = x * 0.2;
        const moveY = y * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      }
    };

    canvas.style.opacity = '0';
    canvas.style.transform = 'rotateX(90deg) rotateZ(0deg) scale(0.8)';
    const entranceTimeout = setTimeout(() => {
      canvas.style.transition = 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
      canvas.style.opacity = '1';
      canvas.style.transform = 'rotateX(55deg) rotateZ(-25deg) scale(1)';
    }, 300);

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(entranceTimeout);
    };
  }, []);

  useEffect(() => {
    const btn = ctaBtnRef.current;
    if (!btn) return;
    const setPath = () => {
      btn.style.setProperty('--orbit-path', `path('M 0 0 H ${btn.offsetWidth} V ${btn.offsetHeight} H 0 V 0')`);
    };
    setPath();
    window.addEventListener('resize', setPath);
    return () => window.removeEventListener('resize', setPath);
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.14 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const features = useMemo(
    () => [
      {
        title: 'Snap-to-grid line control',
        description: 'Place cleaner technical lines quickly with consistent spacing and alignment.',
        clip: '/videos/snap-grid.mp4',
        icon: Grid2X2,
        classes: 'md:col-span-7 md:-rotate-[1.2deg] md:translate-y-4',
      },
      {
        title: 'Tool switching in flow',
        description: 'Move between line, freehand, text, angle, selection, and eraser in one canvas rhythm.',
        clip: '/videos/tool-flow.mp4',
        icon: MousePointer2,
        classes: 'md:col-span-5 md:rotate-[1.3deg] md:-translate-y-5',
      },
      {
        title: 'Layer + page organization',
        description: 'Handle complex diagrams by isolating structure, notes, and revisions.',
        clip: '/videos/layers-pages.mp4',
        icon: Layers,
        classes: 'md:col-span-5 md:-rotate-[1deg] md:translate-y-2',
      },
      {
        title: 'Export-ready sheets',
        description: 'Generate clean PDF output when your drawing is ready to submit or share.',
        clip: '/videos/pdf-export.mp4',
        icon: Zap,
        classes: 'md:col-span-7 md:rotate-[1.1deg] md:translate-y-10',
      },
    ],
    []
  );

  return (
    <div className="min-h-screen w-screen bg-[#0a0a0e] text-white overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&display=swap');

        /* ── Reveal animations ── */
        [data-reveal] {
          opacity: 0;
          transform: translateY(32px) scale(0.985);
          transition: opacity 760ms cubic-bezier(.2,.8,.2,1), transform 760ms cubic-bezier(.2,.8,.2,1);
        }
        [data-reveal].is-visible { opacity: 1; transform: translateY(0) scale(1); }
        @media (prefers-reduced-motion: reduce) {
          [data-reveal] { opacity: 1; transform: none; transition: none; }
        }

        /* ── Video feature cards ── */
        .clip-shell {
          position: relative; overflow: hidden;
          border: 1px solid rgba(204,139,237,0.18);
          background: linear-gradient(160deg, rgba(153,85,204,0.14), rgba(16,12,28,0.94));
          box-shadow: 0 30px 70px -40px rgba(0,0,0,0.75);
        }
        .clip-shell::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(10,10,20,0.78), rgba(10,10,20,0.06) 55%);
          z-index: 2; pointer-events: none;
        }
        .clip-shell video { width: 100%; height: 100%; object-fit: cover; opacity: 0.82; }
        .noise-layer {
          background-image:
            radial-gradient(rgba(204,139,237,0.10) 0.6px, transparent 0.6px),
            linear-gradient(120deg, rgba(153,85,204,0.10), rgba(127,100,255,0.06));
          background-size: 3px 3px, cover;
          mix-blend-mode: soft-light; opacity: 0.32; pointer-events: none;
        }

        /* ── Flat nav ── */
        .ha-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          padding: 1.55rem 2.5rem;
          display: flex; align-items: center; justify-content: space-between;
          font-family: 'Syncopate', monospace;
          font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase;
          pointer-events: none;
          background: linear-gradient(to bottom,
            rgba(8,6,14,0.72) 0%,
            rgba(8,6,14,0.38) 70%,
            transparent 100%);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
        }
        .ha-nav > * { pointer-events: auto; }
        .ha-nav-brand {
          font-weight: 700; font-size: 0.86rem; letter-spacing: 0.06em;
          color: #fff; text-transform: none;
          background: none; border: none; cursor: pointer;
          font-family: inherit; padding: 0;
          transition: opacity 0.2s;
        }
        .ha-nav-brand:hover { opacity: 0.8; }
        .ha-nav-brand .brand-init {
          font-size: 1.5em;
          background: linear-gradient(135deg, #e4c7f5, #cc8bed);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ha-nav-links { display: none; gap: 2.5rem; color: rgba(255,255,255,0.5); }
        @media(min-width:768px){ .ha-nav-links { display: flex; } }
        .ha-nav-links a {
          position: relative; transition: color 0.25s;
          padding-bottom: 2px;
        }
        .ha-nav-links a::after {
          content: ''; position: absolute; bottom: -2px; left: 0;
          width: 0; height: 1px;
          background: linear-gradient(to right, #cc8bed, #9966cc);
          transition: width 0.3s cubic-bezier(.4,0,.2,1);
        }
        .ha-nav-links a:hover { color: #e4c7f5; }
        .ha-nav-links a:hover::after { width: 100%; }
        .ha-nav-login {
          color: rgba(255,255,255,0.7); font-weight: 700;
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: inherit;
          letter-spacing: inherit; text-transform: inherit;
          margin-right: clamp(0.5rem, 4vw, 4rem);
          transition: color 0.2s;
          position: relative; padding-bottom: 2px;
        }
        .ha-nav-login::after {
          content: ''; position: absolute; bottom: -2px; left: 0;
          width: 0; height: 1px;
          background: linear-gradient(to right, #cc8bed, #9966cc);
          transition: width 0.3s cubic-bezier(.4,0,.2,1);
        }
        .ha-nav-login:hover { color: #e4c7f5; }
        .ha-nav-login:hover::after { width: 100%; }

        /* ── Hero background orbs ── */
        .hero-orb {
          position: absolute; border-radius: 50%;
          filter: blur(90px); opacity: 0; pointer-events: none;
          animation: orb-fade-in 2.5s ease forwards;
        }
        @keyframes orb-fade-in { to { opacity: 1; } }

        /* ── Hero 3-D canvas ── */
        .hero-grain-overlay {
          position: absolute; inset: 0;
          pointer-events: none; z-index: 3; opacity: 0.10;
        }
        .hero-3d-viewport {
          position: absolute; inset: 0; perspective: 2000px;
          display: flex; align-items: center; justify-content: flex-end;
          padding-right: 2%; overflow: hidden; z-index: 0;
        }
        .hero-canvas-3d {
          position: relative; width: min(960px, 88vw);
          aspect-ratio: 1.84;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hero-layer {
          position: absolute; inset: 0;
          border: 1px solid rgba(153,85,204,0.28);
          background-size: contain;
          background-position: center center;
          background-repeat: no-repeat;
          transition: transform 0.5s ease;
          border-radius: 6px;
          overflow: hidden;
        }
        .hero-layer-1 {
          background-image: url('/hero section Screenshot.webp');
          box-shadow: 0 0 0 1px rgba(153,85,204,0.22),
                      0 24px 80px -20px rgba(100,50,180,0.55);
        }
        .hero-contours {
          position: absolute; width: 200%; height: 200%; top: -50%; left: -50%;
          background-image: repeating-radial-gradient(
            circle at 50% 50%,
            transparent 0, transparent 50px,
            rgba(153,85,204,0.16) 51px, transparent 52px
          );
          transform: translateZ(-10px); pointer-events: none; z-index: 0;
        }
        .hero-vignette {
          position: absolute; inset: 0;
          background:
            linear-gradient(to right, rgba(8,6,18,0.82) 0%, rgba(8,6,18,0.08) 52%, rgba(8,6,18,0.52) 100%),
            linear-gradient(to bottom, rgba(8,6,18,0.65) 0%, transparent 28%, transparent 62%, rgba(8,6,18,0.94) 100%);
          pointer-events: none; z-index: 1;
        }

        /* ── Hero interface grid overlay ── */
        .hero-interface {
          position: absolute; inset: 0;
          padding: 0 clamp(3rem, 6%, 6rem);
          display: flex; flex-direction: column;
          justify-content: space-between;
          z-index: 10; pointer-events: none;
        }
        .hero-spacer-top { height: 88px; flex-shrink: 0; }
        .hero-title-block {
          flex: 1; display: flex; flex-direction: column;
          justify-content: flex-start; padding: 3rem 0 1rem;
        }
        .hero-giant-title {
          font-family: 'Syncopate', sans-serif;
          font-size: clamp(1.8rem, 3.8vw, 4.6rem);
          font-weight: 700; line-height: 1.1; letter-spacing: -0.01em;
          text-transform: uppercase; margin: 0;
        }
        .hero-giant-title .title-line-1 { color: #ffffff; display: block; white-space: nowrap; }
        .hero-giant-title .title-line-2 {
          display: block; white-space: nowrap;
          background: linear-gradient(100deg, rgba(230,215,255,0.95) 0%, #cc8bed 35%, #9966cc 65%, #7f6bff 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-caps {
          display: flex; gap: 0.55rem; flex-wrap: wrap;
          align-items: center; padding-top: 1.2rem;
        }
        .hero-cap-pill {
          display: inline-flex; align-items: center; gap: 0.45rem;
          border: 1px solid rgba(153,85,204,0.5);
          background: rgba(153,85,204,0.12);
          color: rgba(210,170,240,0.92);
          font-family: monospace; font-size: 0.68rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          padding: 0.42rem 1rem; border-radius: 2px; white-space: nowrap;
          transition: background 0.25s, border-color 0.25s, color 0.25s;
        }
        .hero-cap-pill:hover {
          background: rgba(153,85,204,0.28);
          border-color: rgba(204,139,237,0.8);
          color: #e4c7f5;
        }
        .hero-cap-pill .cap-num { color: rgba(153,85,204,0.75); font-size: 0.5rem; }
        .hero-bottom-bar {
          display: flex; flex-direction: row;
          align-items: flex-end; justify-content: space-between;
          padding-bottom: 9.5rem; gap: 2rem;
        }
        .hero-bottom-left { flex: 0 1 460px; }
        .hero-tagline {
          font-family: monospace; font-size: 0.75rem; letter-spacing: 0.13em;
          text-transform: uppercase; color: rgba(255,255,255,0.45); line-height: 1.7;
          margin-bottom: 0.75rem;
        }
        .hero-tagline p { margin: 0; }
        .hero-desc {
          font-size: 0.97rem; letter-spacing: 0.02em;
          color: rgba(255,255,255,0.6); line-height: 1.8; max-width: 420px;
        }
        .hero-cta-wrap {
          flex: 0 0 auto; align-self: flex-end;
          pointer-events: auto; margin-right: 8%;
        }

        /* ── CTA button (polygon, with purple ripple) ── */
        .hero-cta-btn {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #d8d8d8 0%, #efefef 100%);
          color: #0a0a0a;
          padding: 1.1rem 2.5rem 1.1rem 2.1rem;
          font-family: 'Syncopate', monospace; font-weight: 700;
          font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase;
          clip-path: polygon(0 0, 100% 0, 100% 65%, 88% 100%, 0 100%);
          border: none; cursor: pointer; white-space: nowrap;
          transition: background 0.35s, color 0.35s, transform 0.25s,
                      box-shadow 0.35s;
        }
        .hero-cta-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #cc8bed 0%, #9966cc 100%);
          opacity: 0;
          transition: opacity 0.35s;
        }
        .hero-cta-btn:hover::before { opacity: 1; }
        .hero-cta-btn:hover {
          color: #fff;
          transform: translateY(-4px);
          box-shadow: 0 12px 36px -8px rgba(153,85,204,0.55);
        }
        .hero-cta-btn span { position: relative; z-index: 1; }
        /* orbit light */
        .cta-orbit-light {
          position: absolute;
          width: 90px; aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.3) 30%, transparent 70%);
          offset-path: var(--orbit-path);
          offset-distance: 0%;
          transform: translate(-50%, -50%);
          animation: cta-orbit 2.4s linear infinite;
          pointer-events: none; z-index: 3;
          mix-blend-mode: soft-light;
        }
        @keyframes cta-orbit {
          0%   { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }

        /* ── Scroll hint ── */
        .hero-scroll-hint {
          position: absolute; bottom: 2.2rem; left: 50%;
          width: 1px; height: 64px;
          background: linear-gradient(to bottom, rgba(204,139,237,0.7), transparent);
          animation: hint-flow 2.2s infinite ease-in-out;
          z-index: 11; pointer-events: none;
        }
        @keyframes hint-flow {
          0%   { transform: translateX(-50%) scaleY(0); transform-origin: top; }
          48%  { transform: translateX(-50%) scaleY(1); transform-origin: top; }
          50%  { transform: translateX(-50%) scaleY(1); transform-origin: bottom; }
          98%  { transform: translateX(-50%) scaleY(0); transform-origin: bottom; }
          100% { transform: translateX(-50%) scaleY(0); transform-origin: top; }
        }

        /* ── Generic purple button (used in workflow / start sections) ── */
        .btn-purple {
          position: relative; overflow: hidden; cursor: pointer;
          transition: transform 0.22s, box-shadow 0.3s;
        }
        .btn-purple::after {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(circle at center, rgba(204,139,237,0.35) 0%, transparent 70%);
          opacity: 0; transform: scale(0.6);
          transition: opacity 0.4s, transform 0.4s;
          pointer-events: none;
        }
        .btn-purple:hover::after { opacity: 1; transform: scale(1.15); }
        .btn-purple:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 32px -8px rgba(153,85,204,0.5);
        }
        .btn-purple:active { transform: scale(0.97); }

        /* ── Logo mark shorthand ── */
        .la-mark {
          font-family: 'Syncopate', monospace; font-weight: 700;
          letter-spacing: 0.06em; text-transform: none;
        }
        .la-mark .mi {
          font-size: 1.5em; line-height: 1;
          background: linear-gradient(135deg, #e4c7f5, #cc8bed);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <nav className="ha-nav">
        <button className="ha-nav-brand" onClick={() => navigate('/')}>
          <span className="brand-init">L</span>ine<span className="brand-init">A</span>ccurate
        </button>
        <div className="ha-nav-links">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#start">Start</a>
        </div>
        <button className="ha-nav-login" onClick={() => navigate(user ? '/dashboard' : '/login')}>
          {user ? 'Dashboard' : 'Log in'}
        </button>
      </nav>

      <header ref={heroRef} style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: '#08060e' }}>
        {/* Purple background orbs */}
        <div className="hero-orb" style={{ width: 520, height: 520, top: '-8%', left: '-5%', background: 'radial-gradient(circle, rgba(120,50,180,0.38) 0%, transparent 70%)', animationDelay: '0s' }} />
        <div className="hero-orb" style={{ width: 400, height: 400, top: '10%', right: '5%', background: 'radial-gradient(circle, rgba(90,50,200,0.28) 0%, transparent 70%)', animationDelay: '0.4s' }} />
        <div className="hero-orb" style={{ width: 300, height: 300, bottom: '5%', left: '30%', background: 'radial-gradient(circle, rgba(153,85,204,0.22) 0%, transparent 70%)', animationDelay: '0.8s' }} />
        {/* SVG grain filter */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="hero-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div className="hero-grain-overlay" style={{ filter: 'url(#hero-grain)' }} />

        {/* 3-D parallax canvas */}
        <div className="hero-3d-viewport">
          <div className="hero-canvas-3d" ref={canvas3dRef}>
            <div className="hero-contours" />
            <div className="hero-layer hero-layer-1" ref={(el) => { heroLayersRef.current[0] = el!; }} />
          </div>
        </div>

        {/* Vignette */}
        <div className="hero-vignette" />

        {/* Interface grid overlay */}
        <div className="hero-interface">
          {/* spacer — nav height */}
          <div className="hero-spacer-top" />

          {/* title + pills — vertically centred in remaining space */}
          <div className="hero-title-block">
            <h1 className="hero-giant-title">
              <span className="title-line-1">Engineering precision,</span>
              <span className="title-line-2">effortlessly achieved.</span>
            </h1>
            <div className="hero-caps">
              <div className="hero-cap-pill"><span className="cap-num">01</span>&nbsp;Snap&nbsp;&amp;&nbsp;Draw</div>
              <div className="hero-cap-pill"><span className="cap-num">02</span>&nbsp;Layer&nbsp;Rhythm</div>
              <div className="hero-cap-pill"><span className="cap-num">03</span>&nbsp;Export&nbsp;PDF</div>
            </div>
          </div>

          {/* bottom bar — tagline+desc left, CTA toward centre-right */}
          <div className="hero-bottom-bar">
            <div className="hero-bottom-left">
              <div className="hero-tagline">
                <p>For Students &amp; Engineers — Without the CAD Overload</p>
              </div>
              <div className="hero-desc">
                LineAccurate gives students a focused digital drafting board — clean lines, layered precision, and export-ready sheets in minutes.
              </div>
            </div>
            <div className="hero-cta-wrap">
              <button
                ref={ctaBtnRef}
                className="hero-cta-btn"
                onClick={() => navigate(user ? '/dashboard' : '/login')}
              >
                <div className="cta-orbit-light" />
                <span>Open Canvas</span>
              </button>
            </div>
          </div>
        </div>

        {/* animated scroll hint only */}
        <div className="hero-scroll-hint" />
      </header>

      <section id="features" ref={featuresRef} className="relative px-6 pt-20 pb-10 overflow-hidden">
        <Suspense fallback={null}>
          <InteractiveDotGrid containerRef={featuresRef} />
        </Suspense>
        <div className="absolute -top-24 right-[8%] w-64 h-64 rounded-full bg-[#cc8bed]/20 blur-[90px]" />
        <div className="absolute top-[38%] -left-20 w-52 h-52 rounded-full bg-[#7f8cff]/20 blur-[85px]" />

        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6" data-reveal>
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-[#cc8bed]">Feature Showcase</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3">Scroll through what the canvas can actually do.</h2>
            </div>
            <p className="text-white/55 text-sm md:max-w-xs md:text-right">
              Each tile is a looping demo clip. Drop your own videos in the same paths to make this fully real.
            </p>
          </div>

          <div className="relative mt-14 grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
            <div className="hidden md:block absolute -top-7 right-20 px-3 py-1 rounded-full border border-white/15 text-[10px] tracking-widest text-white/50 bg-white/[0.03] rotate-[-6deg]">
              LIVE MOTION REEL
            </div>
            <div className="hidden md:block absolute top-[45%] left-8 px-3 py-1 rounded-full border border-white/15 text-[10px] tracking-widest text-white/50 bg-white/[0.03] rotate-[5deg]">
              TOOL FLOW
            </div>

            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  data-reveal
                  style={{
                    transitionDelay: `${70 + index * 90}ms`,
                    transform: `translateY(${Math.sin((scrollY + index * 60) / 220) * 6}px)`,
                  }}
                  className={`clip-shell rounded-[22px] min-h-[280px] md:min-h-[340px] ${feature.classes}`}
                >
                  <video autoPlay loop muted playsInline preload="metadata" className="absolute inset-0">
                    <source src={feature.clip} type="video/mp4" />
                  </video>
                  <div className="noise-layer absolute inset-0 z-[1]" />

                  <div className="relative z-[3] p-5 md:p-6 h-full flex flex-col justify-end">
                    <div className="inline-flex w-10 h-10 rounded-xl items-center justify-center border border-white/25 bg-black/30 backdrop-blur-md mb-4">
                      <Icon size={18} className="text-[#efdcfa]" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold leading-tight">{feature.title}</h3>
                    <p className="text-sm text-white/70 mt-2 max-w-md">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" ref={workflowRef} className="relative px-6 py-24 bg-white/[0.02] border-y border-white/10 overflow-hidden">
        <Suspense fallback={null}>
          <InteractiveDotGrid containerRef={workflowRef} />
        </Suspense>
        <div className="max-w-7xl mx-auto md:grid md:grid-cols-12 gap-6">
          <div className="md:col-span-5 md:sticky md:top-24 md:h-fit" data-reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-[#cc8bed]">How it feels</p>
            <h2 className="text-3xl md:text-4xl font-bold mt-3">Less “software maze”, more drawing momentum.</h2>
            <p className="text-white/65 mt-4 max-w-md">
              The app stays focused so students can practice fundamentals instead of fighting heavy CAD UI.
            </p>
          </div>

          <div className="md:col-span-7 mt-10 md:mt-0 space-y-6">
            {[
              {
                step: '01',
                title: 'Open project and begin instantly',
                text: 'No setup maze. Launch the canvas and start constructing lines right away.',
              },
              {
                step: '02',
                title: 'Build with tool + layer rhythm',
                text: 'Switch tools, isolate layers, adjust details, and keep your sheet readable.',
              },
              {
                step: '03',
                title: 'Export final output',
                text: 'When your drawing is complete, export a clean PDF for review or submission.',
              },
            ].map((item, idx) => (
              <div
                key={item.step}
                data-reveal
                style={{ transitionDelay: `${90 + idx * 70}ms` }}
                className={`rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm ${idx % 2 === 0 ? 'md:mr-12' : 'md:ml-12'}`}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#cc8bed]/20 text-[#e4c7f5] font-semibold">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mt-4">{item.title}</h3>
                <p className="text-sm text-white/60 mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="px-6 py-24">
        <div className="max-w-5xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#cc8bed]/18 via-[#131318] to-[#131318] p-8 md:p-12" data-reveal>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5">
            <Zap className="text-[#e4c7f5]" size={22} />
          </div>
          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-end">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Make the showcase real with your own clips.</h2>
              <p className="text-white/70 mt-4 max-w-xl">
                Add your feature demo videos to the defined paths and this page becomes a moving product story as users scroll.
              </p>
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                className="mt-8 btn-purple inline-flex items-center gap-2 rounded-full px-7 py-3 bg-gradient-to-r from-[#cc8bed] to-[#9966cc] text-white font-semibold"
              >
                {user ? 'Go to Dashboard' : 'Sign in to Start'}
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="clip-shell rounded-2xl min-h-[230px] rotate-[1.4deg]">
              <video autoPlay loop muted playsInline preload="metadata" className="absolute inset-0">
                <source src="/videos/final-showcase.mp4" type="video/mp4" />
              </video>
              <div className="noise-layer absolute inset-0 z-[1]" />
              <div className="relative z-[3] p-5 h-full flex flex-col justify-end">
                <p className="text-xs uppercase tracking-widest text-white/60">Final Pass</p>
                <p className="text-lg font-semibold mt-2">From first line to export-ready sheet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <span className="la-mark text-white/70"><span className="mi">L</span>ine<span className="mi">A</span>ccurate</span>
          <p>Engineering drawing, simplified.</p>
          <p>© 2026 LineAccurate</p>
        </div>
      </footer>
    </div>
  );
}
