import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Grid2X2, Layers, MousePointer2, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const InteractiveDotGrid = lazy(() =>
  import('./landing/InteractiveDotGrid').then((mod) => ({ default: mod.InteractiveDotGrid }))
);

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
    <div className="min-h-screen w-screen bg-[#0f0f12] text-white overflow-x-hidden">
      <style>{`
        .landing-grid {
          background: transparent;
        }
        .landing-orb {
          filter: blur(64px);
          opacity: 0.38;
          pointer-events: none;
        }
        [data-reveal] {
          opacity: 0;
          transform: translateY(32px) scale(0.985);
          transition: opacity 760ms cubic-bezier(.2,.8,.2,1), transform 760ms cubic-bezier(.2,.8,.2,1);
        }
        [data-reveal].is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-reveal] {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
        .clip-shell {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background: linear-gradient(160deg, rgba(204,139,237,0.15), rgba(20,20,28,0.85));
          box-shadow: 0 30px 70px -40px rgba(0,0,0,0.75);
        }
        .clip-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(10,10,14,0.72), rgba(10,10,14,0.08) 55%);
          z-index: 2;
          pointer-events: none;
        }
        .clip-shell video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.86;
        }
        .noise-layer {
          background-image:
            radial-gradient(rgba(255,255,255,0.08) 0.6px, transparent 0.6px),
            linear-gradient(120deg, rgba(204,139,237,0.08), rgba(127,140,255,0.05));
          background-size: 3px 3px, cover;
          mix-blend-mode: soft-light;
          opacity: 0.32;
          pointer-events: none;
        }
      `}</style>

      <nav className="fixed top-0 inset-x-0 z-50">
        <div className="h-16 glass-panel rounded-b-2xl border-b border-x border-white/20 bg-[#0f0f12]/85 backdrop-blur-xl shadow-lg">
          <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#cc8bed] to-[#9966cc] shadow-lg shadow-[#cc8bed]/40" />
              <span className="font-semibold tracking-tight">LineAccurate</span>
            </button>

            <div className="hidden md:flex items-center gap-7 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
              <a href="#start" className="hover:text-white transition-colors">Get Started</a>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                className="hidden sm:inline-flex px-3 py-2 text-sm rounded-lg hover:bg-white/10 transition"
              >
                {user ? 'Dashboard' : 'Log in'}
              </button>
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#cc8bed] to-[#9966cc] text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition"
              >
                Start Drawing
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <header ref={heroRef} className="relative pt-32 pb-24 px-6 landing-grid overflow-hidden">
        <Suspense fallback={null}>
          <InteractiveDotGrid containerRef={heroRef} />
        </Suspense>
        <div
          className="landing-orb absolute z-[1] -top-10 left-[10%] w-80 h-80 rounded-full bg-[#cc8bed]"
          style={{ transform: `translateY(${scrollY * 0.14}px)` }}
        />
        <div
          className="landing-orb absolute z-[1] top-24 right-[8%] w-72 h-72 rounded-full bg-[#7f8cff]"
          style={{ transform: `translateY(${scrollY * -0.08}px)` }}
        />

        <div className="max-w-6xl mx-auto text-center relative z-[2]" data-reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cc8bed]/40 bg-[#cc8bed]/10 px-3 py-1 text-xs text-[#e4c7f5] mb-6">
            <Sparkles size={14} />
            Built for engineering drawing practice
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Precision drawing,
            <span className="block bg-gradient-to-r from-white to-[#cc8bed] bg-clip-text text-transparent">without the CAD overload.</span>
          </h1>

          <p className="max-w-2xl mx-auto mt-6 text-base md:text-lg text-white/65 leading-relaxed">
            LineAccurate gives students a focused digital drafting board for clean lines, better alignment, and faster revisions.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-[#cc8bed] to-[#9966cc] font-semibold shadow-xl shadow-[#cc8bed]/25 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Open App
              <ArrowRight size={16} />
            </button>
            <a href="#features" className="inline-flex rounded-full border border-white/20 px-6 py-3 text-white/85 hover:bg-white/10 transition">
              Explore Features
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-16 relative z-[2]" data-reveal>
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/30">
            <div className="absolute inset-0 bg-gradient-to-br from-[#cc8bed]/20 via-transparent to-[#7f8cff]/20" />
            <div className="relative grid md:grid-cols-3 gap-0">
              <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Canvas</p>
                <p className="text-2xl font-semibold">Snap + Draw</p>
                <p className="text-sm text-white/60 mt-2">Draw technical lines with less manual correction.</p>
              </div>
              <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Structure</p>
                <p className="text-2xl font-semibold">Pages + Layers</p>
                <p className="text-sm text-white/60 mt-2">Keep diagrams organized as complexity grows.</p>
              </div>
              <div className="p-6 md:p-8">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Output</p>
                <p className="text-2xl font-semibold">Export PDF</p>
                <p className="text-sm text-white/60 mt-2">Submit and share clean drawing sheets quickly.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="relative px-6 pt-20 pb-10 overflow-hidden">
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

      <section id="workflow" className="px-6 py-24 bg-white/[0.02] border-y border-white/10">
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
                className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3 bg-white text-[#0f0f12] font-semibold hover:scale-[1.02] active:scale-[0.98] transition"
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/45">
          <p>© 2026 LineAccurate</p>
          <p>Engineering drawing, simplified.</p>
        </div>
      </footer>
    </div>
  );
}
