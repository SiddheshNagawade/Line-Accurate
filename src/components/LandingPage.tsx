import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Grid2X2, Layers, MousePointer2, Zap } from 'lucide-react';
import './landing/landing.css';

export function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const workflowRef = useRef<HTMLElement>(null);
  const canvas3dRef = useRef<HTMLDivElement>(null);
  const heroLayersRef = useRef<HTMLDivElement[]>([]);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);
  const featureCardsRef = useRef<(HTMLElement | null)[]>([]);
  const scrollRafRef = useRef(0);
  const [disableHeavyMotion, setDisableHeavyMotion] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tabletDown = window.matchMedia('(max-width: 1024px)');
    const coarsePointer = window.matchMedia('(pointer: coarse)');

    const updateMotionMode = () => {
      setDisableHeavyMotion(reducedMotion.matches || tabletDown.matches || coarsePointer.matches);
    };

    updateMotionMode();

    const mediaQueries = [reducedMotion, tabletDown, coarsePointer];
    mediaQueries.forEach((mq) => {
      if ('addEventListener' in mq) {
        mq.addEventListener('change', updateMotionMode);
      } else {
        mq.addListener(updateMotionMode);
      }
    });

    return () => {
      mediaQueries.forEach((mq) => {
        if ('removeEventListener' in mq) {
          mq.removeEventListener('change', updateMotionMode);
        } else {
          mq.removeListener(updateMotionMode);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (disableHeavyMotion) return;

    const onScroll = () => {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        featureCardsRef.current.forEach((el, i) => {
          if (el) el.style.transform = `translateY(${Math.sin((y + i * 60) / 220) * 6}px)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollRafRef.current);
    };
  }, [disableHeavyMotion]);

  useEffect(() => {
    if (disableHeavyMotion) return;

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
  }, [disableHeavyMotion]);

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
      <nav className="ha-nav">
        <button className="ha-nav-brand" onClick={() => navigate('/')}>
          <span className="brand-init">L</span>ine<span className="brand-init">A</span>ccurate
        </button>
        <div className="ha-nav-links">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#start">Start</a>
        </div>
        <button className="ha-nav-login" onClick={() => navigate('/login')}>
          Log in
        </button>
      </nav>

      <header ref={heroRef} className="hero-header">
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

          {/* title block — vertically centred in remaining space */}
          <div className="hero-title-block">
            <h1 className="hero-giant-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
              <span className="title-desktop title-line-1">Engineering precision</span>
              <span className="title-desktop title-line-2">effortlessly accurate</span>
              <span className="title-mobile title-line-1">Engineering</span>
              <span className="title-mobile title-line-1">precision</span>
              <span className="title-mobile title-line-2">effortlessly</span>
              <span className="title-mobile title-line-2">accurate</span>
            </h1>
          </div>

          <div className="hero-mobile-card-slot" aria-hidden="true">
            <div className="hero-mobile-card" />
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
                onClick={() => navigate('/login')}
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

      <section id="features" ref={featuresRef} className="relative px-4 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-10 overflow-hidden">
        <div className="absolute -top-24 right-[8%] w-64 h-64 rounded-full bg-[#cc8bed]/20 blur-[90px]" />
        <div className="absolute top-[38%] -left-20 w-52 h-52 rounded-full bg-[#7f8cff]/20 blur-[85px]" />

        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6" data-reveal>
            <div className="max-w-2xl">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[#cc8bed]">Feature Showcase</p>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mt-2 sm:mt-3 leading-tight">Scroll through what the canvas can actually do.</h2>
            </div>
            <p className="text-white/55 text-xs sm:text-sm md:max-w-xs md:text-right">
              Each tile is a looping demo clip. Drop your own videos in the same paths to make this fully real.
            </p>
          </div>

          <div className="relative mt-8 sm:mt-12 md:mt-14 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-5 md:gap-6">
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
                  ref={(el) => { featureCardsRef.current[index] = el; }}
                  style={{
                    transitionDelay: `${70 + index * 90}ms`,
                  }}
                  className={`clip-shell rounded-lg sm:rounded-[22px] min-h-[220px] sm:min-h-[280px] md:min-h-[340px] ${feature.classes}`}
                >
                  <video autoPlay loop muted playsInline preload={index === 0 ? 'metadata' : 'none'} className="absolute inset-0">
                    <source src={feature.clip} type="video/mp4" />
                  </video>
                  <div className="noise-layer absolute inset-0 z-[1]" />

                  <div className="relative z-[3] p-4 sm:p-5 md:p-6 h-full flex flex-col justify-end">
                    <div className="inline-flex w-9 sm:w-10 h-9 sm:h-10 rounded-lg sm:rounded-xl items-center justify-center border border-white/25 bg-black/30 backdrop-blur-md mb-3 sm:mb-4">
                      <Icon size={16} className="text-[#efdcfa]" />
                    </div>
                    <h3 className="text-base sm:text-xl md:text-2xl font-semibold leading-tight">{feature.title}</h3>
                    <p className="text-xs sm:text-sm text-white/70 mt-1 sm:mt-2 max-w-md">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" ref={workflowRef} className="relative px-4 sm:px-6 py-12 sm:py-24 bg-white/[0.02] border-y border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto md:grid md:grid-cols-12 gap-4 md:gap-6">
          <div className="md:col-span-5 md:sticky md:top-24 md:h-fit" data-reveal>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[#cc8bed]">How it feels</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mt-2 sm:mt-3 leading-tight">Less "software maze", more drawing momentum.</h2>
            <p className="text-white/65 text-sm sm:text-base mt-2 sm:mt-4 max-w-md">
              The app stays focused so students can practice fundamentals instead of fighting heavy CAD UI.
            </p>
          </div>

          <div className="md:col-span-7 mt-8 md:mt-0 space-y-3 sm:space-y-4 md:space-y-6">
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
                className={`rounded-xl sm:rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 md:p-6 backdrop-blur-sm ${idx % 2 === 0 ? 'md:mr-12' : 'md:ml-12'}`}
              >
                <div className="inline-flex items-center justify-center w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-[#cc8bed]/20 text-[#e4c7f5] font-semibold text-sm sm:text-base">
                  {item.step}
                </div>
                <h3 className="text-base sm:text-lg font-semibold mt-3 sm:mt-4">{item.title}</h3>
                <p className="text-xs sm:text-sm text-white/60 mt-1 sm:mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="px-4 sm:px-6 py-12 sm:py-24">
        <div className="max-w-5xl mx-auto rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-[#cc8bed]/18 via-[#131318] to-[#131318] p-6 sm:p-8 md:p-12" data-reveal>
          <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center mb-4 sm:mb-5">
            <Zap className="text-[#e4c7f5]" size={18} />
          </div>
          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-6 md:gap-8 items-end">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">Make the showcase real with your own clips.</h2>
              <p className="text-white/70 text-sm sm:text-base mt-3 sm:mt-4 max-w-xl">
                Add your feature demo videos to the defined paths and this page becomes a moving product story as users scroll.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-6 sm:mt-8 btn-purple inline-flex items-center gap-2 rounded-full px-5 sm:px-7 py-2.5 sm:py-3 bg-gradient-to-r from-[#cc8bed] to-[#9966cc] text-white font-semibold text-sm sm:text-base"
              >
                Sign in to Start
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="clip-shell rounded-xl sm:rounded-2xl min-h-[200px] sm:min-h-[230px] rotate-[1.4deg] hidden sm:block">
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

      <footer className="border-t border-white/10 px-4 sm:px-6 py-6 sm:py-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:gap-4 text-center sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-white/40">
          <span className="la-mark text-white/70 text-xs sm:text-sm"><span className="mi">L</span>ine<span className="mi">A</span>ccurate</span>
          <p>Engineering drawing, simplified.</p>
          <p>© 2026 LineAccurate</p>
        </div>
      </footer>
    </div>
  );
}
