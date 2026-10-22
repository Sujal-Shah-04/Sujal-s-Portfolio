import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PROFILE, SECTIONS } from '../data';
import { ui } from '../ui';
import { audio } from '../audio';

/* The name: a title over the room as it opens, then a signature in the corner.
   Like the reference: letters rise (power4.out, 1.15 s, 35 ms apart), the line fades up,
   then the title flies to its corner in one move (expo.inOut, 1.25 s). */
export function Hero({ mode }) {
  const words = PROFILE.name.split(' ');
  const name = useRef();
  const prev = useRef(mode);
  const from = useRef(null);
  let n = 0;
  // measure the title where it is before the switch...
  if (prev.current === 'intro' && mode === 'sig' && name.current) from.current = name.current.getBoundingClientRect();
  // ...and fly it from there to where it lands
  useLayoutEffect(() => {
    const f = from.current;
    from.current = null;
    if (prev.current === 'intro' && mode === 'sig' && f && name.current) {
      const t = name.current.getBoundingClientRect();
      name.current.animate(
        [
          { transformOrigin: '0 0', transform: `translate(${f.left - t.left}px, ${f.top - t.top}px) scale(${f.width / t.width})` },
          { transformOrigin: '0 0', transform: 'none' },
        ],
        { duration: 1250, easing: 'cubic-bezier(.87, 0, .13, 1)' },
      );
    }
    prev.current = mode;
  }, [mode]);
  return (
    <header className={`ui ${mode}`}>
      <h1 className="hero-name" aria-label={PROFILE.name} ref={name}>
        {words.map((w) => (
          <span className="w" key={w} aria-hidden="true">
            {[...w].map((c, i) => (
              <span className="c" key={i} style={{ animationDelay: `${0.15 + n++ * 0.035}s` }}>{c}</span>
            ))}
          </span>
        ))}
      </h1>
      <p className="hero-line">{PROFILE.line}<i className="hero-caret" aria-hidden="true" /></p>
      <p className="hero-meta"><i aria-hidden="true" />{PROFILE.role} <span>·</span> {PROFILE.city}</p>
    </header>
  );
}

const NAV_ICONS = {
  projects: 'M3 5h18v11H3zM9 20h6M12 16v4',
  experience: 'M3 4h18v14H3zM7 8h4v5H7zM13 8h4M13 11h4M13 14h3',
  about: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5',
  contact: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
};

/* The index: a glass pill with a highlight that slides to the open section. */
export function IndexNav({ current, onGo, hidden }) {
  const nav = useRef();
  const [ind, setInd] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const btn = nav.current?.querySelector(`[data-go="${current}"]`);
      setInd(btn ? { x: btn.offsetLeft, w: btn.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [current]);
  return (
    <nav className={`index${hidden ? ' away' : ''}`} aria-label="Sections" ref={nav}>
      <span className="ind" aria-hidden="true" style={ind ? { opacity: 1, width: ind.w, translate: `${ind.x}px 0` } : undefined} />
      {SECTIONS.map((s) => (
        <button key={s.key} type="button" data-go={s.key} aria-current={current === s.key} onClick={() => onGo(s.key)}>
          <span className="n">{s.num}</span>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d={NAV_ICONS[s.key]} /></svg>
          <span className="l">{s.title}</span>
        </button>
      ))}
    </nav>
  );
}

export function SoundButton({ on, onToggle, hidden }) {
  return (
    <button className={`sound${hidden ? ' away' : ''}`} type="button" aria-pressed={on} aria-label="Sound" onClick={onToggle}>
      <i /><i /><i /><i />
    </button>
  );
}

export function Undock({ onClick }) {
  return (
    <button className="undock" type="button" onClick={onClick}>
      <span aria-hidden="true">◀</span> Back to the room
    </button>
  );
}

export function DragHint({ show }) {
  return (
    <div className={`drag-hint${show ? ' show' : ''}`} aria-hidden="true">
      <div className="drag-hint-icon">
        <svg className="drag-hint-arrow" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
        <svg className="drag-hint-hand" viewBox="0 0 24 24"><path d="M9 12V5a1.5 1.5 0 0 1 3 0v5.5M12 10V8.5a1.5 1.5 0 0 1 3 0V11M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.9-2.5l-2.8-4a1.6 1.6 0 0 1 2.5-2L9 14.5" /></svg>
        <svg className="drag-hint-arrow" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
      </div>
      <p>Drag to look around</p>
    </div>
  );
}

/* The cursor over the room: a point and a ring that opens into a label naming
   what a prop opens. Over the HTML surfaces the system cursor comes back. */
export function Cursor() {
  const root = useRef();
  const dot = useRef();
  const ring = useRef();
  const label = useRef();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('custom-cursor');
    const pos = { x: -100, y: -100, rx: -100, ry: -100 };
    let raf;
    const move = (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      ui.set({ overScene: e.target?.tagName === 'CANVAS' });
    };
    const down = () => root.current.classList.add('press');
    const up = () => root.current.classList.remove('press');
    const render = () => {
      pos.rx += (pos.x - pos.rx) * 0.22;
      pos.ry += (pos.y - pos.ry) * 0.22;
      if (!dot.current || !ring.current) return;
      dot.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      ring.current.style.transform = `translate(${pos.rx}px, ${pos.ry}px)`;
      raf = requestAnimationFrame(render);
    };
    const sync = () => {
      const c = root.current.classList;
      c.toggle('on', ui.overScene);
      c.toggle('drag', ui.drag);
      c.toggle('label', !!ui.label && !ui.drag);
      if (ui.label) label.current.textContent = ui.label;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    const unsub = ui.subscribe(sync);
    raf = requestAnimationFrame(render);
    return () => {
      html.classList.remove('custom-cursor');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="cursor" ref={root} aria-hidden="true">
      <i className="cursor-dot" ref={dot} />
      <span className="cursor-ring-wrap" ref={ring}>
        <span className="cursor-ring" />
        <span className="cursor-label" ref={label} />
      </span>
    </div>
  );
}

/* What the speaker is playing, beside the sound button. Click to open the speaker. */
export function NowPlaying({ hidden, onOpen }) {
  const [, tick] = useState(0);
  useEffect(() => audio.subscribe(() => tick((n) => n + 1)), []);
  if (!audio.playing) return null;
  return (
    <button type="button" className={`np-pill${hidden ? ' away' : ''}`} onClick={onOpen} aria-label={`Now playing: ${audio.label}. Open the speaker`}>
      <span className={`eq${audio.source === 'spotify' ? ' sp' : ''}`} aria-hidden="true"><i /><i /><i /></span>
      <span className="tt">{audio.label}</span>
    </button>
  );
}
