import { useEffect, useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { BADGES, EMAILJS, FACTS, JOURNEY, PROFILE, PROJECTS, SKILLS, SPOKEN, SPOTIFY, STATS } from '../data';
import { nowIST, ui } from '../ui';
import { player } from '../music';
import { mountSpotify, spotify } from '../spotify';
import { audio } from '../audio';

const BASE = import.meta.env.BASE_URL;
const CV_URL = `${BASE}${PROFILE.cv}`;

function useNow(ms = 15000) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const Icon = ({ d, ...p }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    {d.map((x) => <path key={x} d={x} />)}
  </svg>
);
const I = {
  wifi: ['M1.5 9a15 15 0 0 1 21 0', 'M5 12.6a10 10 0 0 1 14 0', 'M8.6 16.1a5 5 0 0 1 6.8 0'],
  vol: ['M2 9h4l5-4v14l-5-4H2z', 'M15.5 8.5a5 5 0 0 1 0 7'],
  mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  gh: ['M9 19c-4 1.4-4-2-6-2.5M15 21v-3.4a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.2a4.8 4.8 0 0 0-1.3-3.3 4.5 4.5 0 0 0-.1-3.3s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.2 5.4 2.5 5.4 2.5a4.5 4.5 0 0 0-.1 3.3A4.8 4.8 0 0 0 4 9.1c0 4.8 3 5.9 5.8 6.2a3 3 0 0 0-.8 2.3V21'],
  li: ['M4 9h3.5v11H4zM5.8 4.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM10 9h3.3v1.6c.5-.9 1.7-1.9 3.6-1.9 3.6 0 4.1 2.3 4.1 5.3V20h-3.5v-5.3c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H10z'],
  chat: ['M4 5h16v11H9l-5 4z', 'M8 9.5h8M8 12.5h5'],
  down: ['M12 4v12M6 11l6 6 6-6M5 20h14'],
  back: ['M15 6l-6 6 6 6'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1'],
  globe: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16'],
  cam: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  prev: ['M18 6v12L9 12z', 'M6 6v12'],
  next: ['M6 6v12l9-6z', 'M18 6v12'],
  play: ['M7 5v14l12-7z'],
  pause: ['M7 5h3.5v14H7zM13.5 5H17v14h-3.5z'],
  ext: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  signal: ['M3 18h2v-2H3zM8 18h2v-5H8zM13 18h2v-8h-2zM18 18h2V6h-2z'],
  doc: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6M9 15h6M9 18h4'],
  compass: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  pin: ['M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z', 'M12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  spotify: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M7.5 9.5c3-1 6.5-.7 9 .8', 'M8 12.6c2.5-.7 5.2-.4 7.3.8', 'M8.6 15.4c2-.5 4-.3 5.6.6'],
};

/* ================= 01 projects: the monitor's desktop ================= */

function Poster({ kind }) {
  return (
    <div className={`poster poster-${kind}`} aria-hidden="true">
      {kind === 'rag' && (
        <>
          <span className="doc d1"><i /><i /><b /><i /><i /></span>
          <span className="doc d2"><i /><b /><i /><i /></span>
          <span className="bubble">2 contradictions found · synopsis ready</span>
        </>
      )}
      {kind === 'sat' && (
        <>
          <span className="field f1" /><span className="field f2" /><span className="field f3" /><span className="road" />
          <span className="det d1"><em>building 0.94</em></span>
          <span className="det d2"><em>encroach 0.88</em></span>
        </>
      )}
      {kind === 'xai' && (
        <>
          <span className="person" /><span className="heat" />
          <span className="alert">FALL DETECTED · 0.4 s</span>
          <span className="bars"><i style={{ width: '82%' }} /><i style={{ width: '54%' }} /><i style={{ width: '31%' }} /></span>
        </>
      )}
      {kind === 'leaf' && (
        <>
          <span className="leaf"><span className="spot s1" /><span className="spot s2" /></span>
          <span className="pred">Tomato · Early blight <b>92%</b></span>
        </>
      )}
      {kind === 'pos' && (
        <>
          <span className="receipt"><i /><i /><i /><b /></span>
          <span className="chart">{[40, 65, 50, 90, 75, 55].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
        </>
      )}
      {kind === 'water' && (
        <>
          <span className="mini-phone"><i /><i /><i /><b /></span>
          <span className="drop" />
          <span className="sync">offline · 12 queued</span>
        </>
      )}
    </div>
  );
}

// A project's picture: its screenshot when there is one, else the drawn poster.
function Visual({ p }) {
  if (p.image) return <img className="shot" src={`${BASE}${p.image}`} alt={`${p.name} screenshot`} loading="lazy" />;
  return <Poster kind={p.poster} />;
}

const WinButtons = ({ onBack }) => (
  <span className="btns">
    <button type="button" onClick={onBack} aria-label="Minimise, back to all projects">−</button>
    <button type="button" tabIndex={-1} aria-hidden="true">□</button>
    <button type="button" className="x" onClick={onBack} aria-label="Close, back to all projects">×</button>
  </span>
);

const host = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2, .8, .2, 1)';

// The transform that puts an element at `from` (a rect) when it really sits at `to`.
const fromRect = (from, to) =>
  `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;

function Case({ p, onBack, origin, closing, onClosed }) {
  const app = useRef();
  const term = useRef();

  // Opening: the app window grows out of the tile that was clicked, then the terminal slides in.
  useEffect(() => {
    if (!app.current || reduceMotion()) return;
    const a = app.current.getBoundingClientRect();
    const o = origin?.();
    if (o) {
      app.current.animate(
        [{ transformOrigin: '0 0', transform: fromRect(o, a), opacity: 0.5, borderRadius: '.45em' }, { transformOrigin: '0 0', transform: 'none', opacity: 1 }],
        { duration: 560, easing: EASE },
      );
    } else {
      app.current.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: EASE });
    }
    term.current?.animate([{ opacity: 0, transform: 'translateX(12%)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 200, easing: EASE, fill: 'backwards' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing: the reverse, back into its tile.
  useEffect(() => {
    if (!closing) return;
    if (!app.current || reduceMotion()) return onClosed();
    const a = app.current.getBoundingClientRect();
    const o = origin?.();
    term.current?.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(12%)' }], { duration: 260, easing: EASE, fill: 'forwards' });
    const anim = app.current.animate(
      [{ transformOrigin: '0 0', transform: 'none', opacity: 1 }, { transformOrigin: '0 0', transform: o ? fromRect(o, a) : 'scale(.985)', opacity: 0.2 }],
      { duration: 420, easing: 'cubic-bezier(.6, 0, .4, 1)', fill: 'forwards' },
    );
    anim.onfinish = onClosed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  let k = 0;
  const line = () => ({ style: { '--k': k++ } });
  return (
    <article className="case">
      <div className="win app" ref={app}>
        <div className="t"><b>{p.name}</b>{onBack && <WinButtons onBack={onBack} />}</div>
        <div className="appbody">
          <h3>{p.name}</h3>
          <p className="tagline">{p.full}</p>
          <figure>
            {p.url ? (
              <a className="live" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${host(p.url)}`}>
                <iframe src={p.url} title={`${p.name}, live`} loading="lazy" tabIndex={-1} />
                <span className="live-tag"><i />live · {host(p.url)} <Icon d={I.ext} /></span>
              </a>
            ) : (
              <Visual p={p} />
            )}
            <figcaption>{p.pitch} <span>{p.when}</span></figcaption>
          </figure>
        </div>
      </div>
      <div className="win term" ref={term}>
        <div className="t"><b>terminal</b>&nbsp;· ~/projects/{p.slug}{onBack && <WinButtons onBack={onBack} />}</div>
        <div className="readme">
          <p className="cmd typed-cmd" {...line()}><em>~/projects/{p.slug}</em> $ <span className="type">glow README.md</span></p>
          <h4 {...line()}>What it is</h4>
          <p {...line()}>{p.full}. {p.pitch}</p>
          <h4 {...line()}>What I built</h4>
          <ul>{p.built.map((b) => <li key={b} {...line()}>{b}</li>)}</ul>
          <p className="deps" {...line()}>"<b>dependencies</b>": [{p.stack.map((s, i) => <span key={s}><em>"{s}"</em>{i < p.stack.length - 1 ? ', ' : ''}</span>)}]</p>
          {p.url && <p className="gh" {...line()}><a href={p.url} target="_blank" rel="noopener noreferrer">{host(p.url)}</a> <span>· live</span></p>}
          <p className="gh" {...line()}><a href={PROFILE.github} target="_blank" rel="noopener noreferrer">github.com/{PROFILE.githubUser}</a></p>
        </div>
      </div>
    </article>
  );
}

const AREAS = ['a', 'b', 'c', 'd', 'e', 'g'];

export function ProjectsSurface({ flat }) {
  const [open, setOpen] = useState(null);
  const [closing, setClosing] = useState(false);
  const view = useRef();
  const rects = useRef({}); // each tile's place, relative to the desktop, for the open/close animation
  useNow();
  const current = PROJECTS.find((p) => p.slug === open);

  // Remember where every tile sits while they're on screen.
  useEffect(() => {
    if (open || !view.current) return;
    const v = view.current.getBoundingClientRect();
    view.current.querySelectorAll('.tile[data-slug]').forEach((t) => {
      const r = t.getBoundingClientRect();
      rects.current[t.dataset.slug] = { left: r.left - v.left, top: r.top - v.top, width: r.width, height: r.height };
    });
  });
  const originOf = (slug) => () => {
    const r = rects.current[slug];
    const v = view.current?.getBoundingClientRect();
    return r && v ? { left: r.left + v.left, top: r.top + v.top, width: r.width, height: r.height } : null;
  };

  const show = (slug) => {
    setClosing(false);
    setOpen(slug);
  };
  const back = () => (open ? setClosing(true) : null);

  if (flat)
    return (
      <>
        <h2 className="kicker">Projects</h2>
        {PROJECTS.map((p) => <Case key={p.slug} p={p} />)}
      </>
    );

  return (
    <>
      <div className="dbar">
        <nav className="ws" aria-label="Projects">
          <button type="button" aria-pressed={!open} onClick={back}>0 <b>all</b></button>
          {PROJECTS.map((p, i) => (
            <button key={p.slug} type="button" aria-pressed={open === p.slug} onClick={() => show(p.slug)}>
              {i + 1} <b>{p.ws}</b>
            </button>
          ))}
        </nav>
        <span className="clock">{nowIST({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span className="tray" aria-hidden="true"><Icon d={I.wifi} /><Icon d={I.vol} /><span>IST</span></span>
      </div>
      <div className="dview" ref={view}>
        {current ? (
          <Case
            key={current.slug}
            p={current}
            origin={originOf(current.slug)}
            closing={closing}
            onBack={back}
            onClosed={() => {
              setClosing(false);
              setOpen(null);
            }}
          />
        ) : (
          <div className="tiles">
            {PROJECTS.map((p, i) => (
              <button key={p.slug} type="button" data-slug={p.slug} className="tile" style={{ gridArea: AREAS[i], '--n': i }} onClick={() => show(p.slug)}>
                <span className="t"><b>{p.name}</b>{p.url && <span className="tlive">live</span>}<span className="ctl"><i /><i /><i /></span></span>
                <Visual p={p} />
                <span className="meta"><span className="nm">{p.name}</span><span className="pitch">{p.pitch}</span></span>
              </button>
            ))}
            <div className="tile term" style={{ gridArea: 'f', '--n': PROJECTS.length }} aria-hidden="true">
              <span className="t"><b>terminal</b>&nbsp;· ~<span className="ctl"><i /><i /><i /></span></span>
              <span className="sh">
                <span className="ln"><span className="ps">sujal@desk <em>~</em> $</span> fetch</span>
                <span className="fetch">
                  <span className="tvface" />
                  <span>
                    <span className="ln"><span className="k">sujal</span><span className="c">@</span><span className="k">desk</span></span>
                    <span className="ln"><span className="k">role</span> {PROFILE.role}</span>
                    <span className="ln"><span className="k">based</span> {PROFILE.city}, {PROFILE.country}</span>
                    <span className="ln"><span className="k">builds</span> CV, RAG, ML APIs</span>
                    <span className="ln"><span className="k">projects</span> {PROJECTS.length}, click one</span>
                    <span className="swatch"><i /><i /><i /><i /><i /></span>
                  </span>
                </span>
                <span className="ln"><span className="ps">sujal@desk <em>~</em> $</span> <span className="caret" /></span>
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ================= 02 experience: badges on the pegboard ================= */

function Badge({ b, i, active, flipped, onClick }) {
  return (
    <button
      type="button"
      className={`badge${active ? ' active' : ''}${flipped ? ' flipped' : ''}`}
      style={{ '--c': b.color, '--i': i }}
      onClick={onClick}
      aria-label={`${b.org}, ${b.role}. ${active ? 'Flip the badge' : 'Show this badge'}`}
    >
      <span className="strap" aria-hidden="true" />
      <span className="card">
        <span className="face front">
          <span className="head"><i className="slot" />{b.org}</span>
          <span className="avatar"><img src={`${BASE}sujal.jpg`} alt="" /></span>
          <span className="role">{b.role}</span>
          <span className="when">{b.when}</span>
          <span className="code" aria-hidden="true" />
          <span className="hint">click to flip</span>
        </span>
        <span className="face back">
          <span className="head small"><i className="slot" />{b.org}</span>
          <span className="pts">{b.points.map((pt) => <span key={pt}>{pt}</span>)}</span>
          <span className="hint">click to flip back</span>
        </span>
      </span>
    </button>
  );
}

// Docked on the board: the badges are the 3D ones; this is just the count, the arrows and the CV.
function BoardControls() {
  const [, tick] = useState(0);
  useEffect(() => ui.subscribe(() => tick((n) => n + 1)), []);
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'ArrowRight') ui.set({ badge: (ui.badge + 1) % BADGES.length, flip: false });
      if (e.key === 'ArrowLeft') ui.set({ badge: (ui.badge - 1 + BADGES.length) % BADGES.length, flip: false });
      if (e.key === 'Enter' || e.key === ' ') ui.set({ flip: !ui.flip });
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  const go = (n) => ui.set({ badge: (n + BADGES.length) % BADGES.length, flip: false });
  const b = BADGES[ui.badge];
  return (
    <>
      <a className="cv" href={CV_URL} download="Sujal-Shah-Resume.pdf">Download CV</a>
      <div className="badge-nav" role="group" aria-label="Experience">
        <button type="button" onClick={() => go(ui.badge - 1)} aria-label="Previous badge">‹</button>
        <span className="count">{String(ui.badge + 1).padStart(2, '0')} / {String(BADGES.length).padStart(2, '0')}</span>
        <button type="button" onClick={() => go(ui.badge + 1)} aria-label="Next badge">›</button>
        <p className="said" aria-live="polite">{b.org} · {b.role}{ui.flip ? ` — ${b.points.join(' ')}` : ''}</p>
      </div>
    </>
  );
}

export function ExperienceSurface({ flat }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const go = (n) => {
    setIdx((n + BADGES.length) % BADGES.length);
    setFlipped(false);
  };

  if (flat)
    return (
      <>
        <div className="board-head">
          <h2 className="kicker">Experience</h2>
          <a className="cv" href={CV_URL} download="Sujal-Shah-Resume.pdf">Download CV</a>
        </div>
        <div className="notes">
          {BADGES.map((b) => (
            <article className="note" key={b.org} style={{ '--c': b.color }}>
              <h3>{b.org}</h3>
              <p className="role">{b.role}</p>
              <p className="when">{b.when}</p>
              <ul>{b.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
            </article>
          ))}
        </div>
      </>
    );

  return <BoardControls />;
}

/* ================= 03 about: the TV, with channels ================= */

const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]);
const proj = (slug) => PROJECTS.find((p) => p.slug === slug);
const projAnswer = (slug) => {
  const p = proj(slug);
  return { text: `${p.full} (${p.when}). ${p.built[0]}`, go: 'projects', label: `Open ${p.name}`, chips: ['What else did you build?', 'Your skills?'] };
};

// Answers come only from the CV in data.js: an offline stand-in for the real me, not a model.
function answer(q) {
  const s = q.toLowerCase();
  const has = (re) => re.test(s);
  if (has(/\b(hi|hello|hey|yo|namaste|hii+)\b/) && s.length < 24)
    return { text: `Hey! 👋 I'm the TV-headed Sujal. Ask about projects, skills, experience, education or how to reach me.`, chips: ['What do you build?', 'Experience?', 'Fun facts?'], mood: 'happy' };
  if (has(/speak|spoken|german|marathi|hindi|english/)) return { text: `I speak ${list(SPOKEN)}.`, chips: ['Where are you based?'] };
  if (has(/rag|tender|langchain|document|promptivo/)) {
    const a = projAnswer('tender-rag');
    return { ...a, text: `${a.text} It's live at promptivo.live.` };
  }
  if (has(/satellite|encroach|yolo|sentinel|sar|unauthori[sz]ed|construction/)) return projAnswer('encroachment');
  if (has(/xai|elder|fall|shap|grad-?cam|explain/)) return projAnswer('xai-care');
  if (has(/plant|leaf|disease|crop/)) return projAnswer('plant-doctor');
  if (has(/pos|restaurant|billing|order/)) return projAnswer('pos');
  if (has(/water|survey|meter|field/)) return projAnswer('water-survey');
  if (has(/intern|endureva|experience|job|work(ed|ing)? (at|for)/))
    return { text: `AI / ML Intern at Endureva Innovations since January 2026: a 92%-accurate, 38-class plant disease CNN served via FastAPI under 200 ms, and 30% faster inference through quantization and batching.`, go: 'experience', label: 'See my badges', chips: ['Hackathons?', 'Education?'] };
  if (has(/project|built|build|made|portfolio|else/))
    return { text: `Six so far: ${list(PROJECTS.map((p) => p.name))}. Tender RAG is live at promptivo.live.`, go: 'projects', label: 'Open the monitor', chips: ['Tell me about Tender RAG', 'Plant Doctor?', 'Encroachment AI?'] };
  if (has(/skill|stack|tech|tool|framework|python|tensorflow|pytorch|language/))
    return { text: `Mostly Python: TensorFlow, PyTorch, OpenCV and scikit-learn for models; FastAPI, Docker and AWS to ship them; React and Flutter for the screens around them. Flip to channel 2 for the full list.`, channel: 'skills', label: 'Show channel 2', chips: ['Experience?', 'What do you build?'] };
  if (has(/educat|college|universit|degree|cgpa|gpa|study|studies|b\.?tech|school|12th/))
    return { text: `B.Tech in AI & Machine Learning at Sanjay Ghodawat University, expected June 2026, CGPA 8.15/10. Before that, 12th Science (Computer Science) at Yashwantrao Chavan College of Science, Karad, in 2022.`, channel: 'journey', label: 'Show my journey', chips: ['Hackathons?', 'Certifications?'] };
  if (has(/hackathon|achiev|award|win|sih|prabal|gdg|accenture/))
    return { text: `Top 3 in the Smart India Hackathon college round with a sign language learning app, led the creative team for GDG SGU's 40-hour Prabal Hackathon (600+ participants), and built an AI fashion recommender at the Accenture Hackathon.`, go: 'experience', label: 'See the badges', chips: ['Certifications?', 'Fun facts?'], mood: 'happy' };
  if (has(/cert|aws|cloud/)) return { text: `AWS Cloud Practitioner, plus Accenture's Software Engineering Simulation and Technology Apprenticeship.`, chips: ['Your skills?'] };
  if (has(/contact|email|mail|reach|hire|linkedin|github|cv|resume|call/))
    return { text: `Email ${PROFILE.email}. GitHub ${PROFILE.githubUser}, LinkedIn ${PROFILE.linkedinUser}. My CV is on the phone too.`, go: 'contact', label: 'Pick up the phone', chips: ['Are you open to work?'] };
  if (has(/where|location|based|live|from|city/)) return { text: `${PROFILE.city}, Maharashtra, ${PROFILE.country}. My clock runs on IST.`, chips: ['Languages?', 'Education?'] };
  if (has(/looking|role|open to|available|goal|hire/)) return { text: PROFILE.seeking, go: 'contact', label: 'Get in touch', mood: 'happy' };
  if (has(/fun|fact|hobby|hobbies|design|art/)) return { text: `I design too: Figma and Canva sit next to my Python. Channel 4 has a few more things.`, channel: 'facts', label: 'Show channel 4', chips: ['Hackathons?'] };
  if (has(/music|song|play/)) return { text: `The speaker on the cabinet plays lo-fi I wrote in code. Click it.`, go: 'music', label: 'Open the speaker', mood: 'happy' };
  if (has(/who|about|yourself|introduce|you\b/)) return { text: `${PROFILE.summary} ${PROFILE.seeking}`, chips: ['What do you build?', 'Your skills?'] };
  return { text: `I'm the offline version, so I only know what's on my CV. Try one of these:`, chips: ['What do you build?', 'Experience?', 'Your skills?', 'How do I reach you?'], mood: 'think' };
}

// Text that types itself out, the way a model streams.
function Typed({ text, onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) {
      onDone?.();
      return;
    }
    const id = setTimeout(() => setN((v) => Math.min(text.length, v + 2)), 14);
    return () => clearTimeout(id);
  }, [n, text, onDone]);
  return <>{text.slice(0, n)}</>;
}

// Eyes that follow the pointer, and change with the mood.
function Eyes({ mood }) {
  const ref = useRef();
  const [off, setOff] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300);
      setOff({ x: (dx / d) * k, y: (dy / d) * k });
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  return (
    <div className={`eyes ${mood}`} ref={ref} aria-hidden="true" style={{ '--ex': off.x, '--ey': off.y }}>
      <span /><span />
    </div>
  );
}

const SUGGEST = ['What do you build?', 'Your skills?', 'Experience?', 'How do I reach you?'];

function Chat({ onGo, setChannel, setMood }) {
  const [log, setLog] = useState([
    { who: 'him', text: `Hey, I'm ${PROFILE.first}. Well, the TV-headed version, the one that never logs off. Ask me anything, or turn the channel.`, done: true, chips: SUGGEST },
  ]);
  const [typing, setTyping] = useState(false);
  const [q, setQ] = useState('');
  const logRef = useRef();

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  });

  const ask = (text) => {
    const t = text.trim();
    if (!t || typing) return;
    setQ('');
    setLog((l) => [...l, { who: 'you', text: t }]);
    setTyping(true);
    setMood('think');
    setTimeout(() => {
      const a = answer(t);
      setTyping(false);
      setMood(a.mood || 'happy');
      setTimeout(() => setMood('idle'), 1400);
      setLog((l) => [...l, { who: 'him', ...a }]);
    }, 500 + Math.random() * 350);
  };
  const markDone = (i) => setLog((l) => (l[i].done ? l : l.map((m, j) => (j === i ? { ...m, done: true } : m))));
  const last = log[log.length - 1];

  return (
    <>
      <div className="log" ref={logRef} aria-live="polite">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            {m.who === 'him' && !m.done ? <Typed text={m.text} onDone={() => markDone(i)} /> : m.text}
            {m.who === 'him' && m.done && (m.go || m.channel) && (
              <button type="button" className="act" onClick={() => (m.go ? onGo?.(m.go) : setChannel(m.channel))}>
                {m.label} →
              </button>
            )}
          </div>
        ))}
        {typing && <p className="msg him typing"><i /><i /><i /></p>}
      </div>
      {!typing && last.who === 'him' && last.done && last.chips && (
        <div className="suggest">
          {last.chips.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} autoComplete="off" placeholder="Type a message" aria-label={`Ask a question about ${PROFILE.first}`} />
        <button type="submit">Send</button>
      </form>
    </>
  );
}

const usedIn = (skill) => {
  const s = skill.toLowerCase().replace(/\.js$/, '');
  return PROJECTS.filter((p) => [...p.stack, ...p.built].some((x) => x.toLowerCase().includes(s))).map((p) => p.name);
};

function Skills() {
  const groups = Object.keys(SKILLS);
  const [g, setG] = useState(groups[1]);
  const [pick, setPick] = useState(null);
  const where = pick ? usedIn(pick) : [];
  return (
    <div className="ch-skills">
      <div className="tabs">
        {groups.map((k) => (
          <button key={k} type="button" aria-pressed={g === k} onClick={() => { setG(k); setPick(null); }}>{k}</button>
        ))}
      </div>
      <div className="chips">
        {SKILLS[g].map((s, i) => (
          <button key={s} type="button" aria-pressed={pick === s} style={{ animationDelay: `${i * 40}ms` }} onClick={() => setPick(pick === s ? null : s)}>{s}</button>
        ))}
      </div>
      <p className="used">
        {!pick && 'Tap a skill to see where I used it.'}
        {pick && (where.length ? <>Used <b>{pick}</b> in {list(where)}.</> : <><b>{pick}</b>: in my toolkit, not yet in a listed project.</>)}
      </p>
    </div>
  );
}

function Journey() {
  const [i, setI] = useState(JOURNEY.length - 3);
  const j = JOURNEY[i];
  return (
    <div className="ch-journey">
      <div className="track" role="tablist">
        {JOURNEY.map((x, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} className={k <= i ? 'past' : ''} onClick={() => setI(k)} aria-label={`${x.when}: ${x.title}`}>
            <i />
          </button>
        ))}
      </div>
      <div className="stop" key={i}>
        <p className="when">{j.when}</p>
        <h3>{j.title}</h3>
        <p className="where">{j.where}</p>
      </div>
      <div className="steps">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>‹ earlier</button>
        <button type="button" onClick={() => setI(Math.min(JOURNEY.length - 1, i + 1))} disabled={i === JOURNEY.length - 1}>later ›</button>
      </div>
    </div>
  );
}

function Count({ n, suffix }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100);
      setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <b>{v}{suffix}</b>;
}

function Facts() {
  const [open, setOpen] = useState(null);
  return (
    <div className="ch-facts">
      <div className="stats">
        {STATS.map((s) => <p key={s.label}><Count n={s.n} suffix={s.suffix} /><span>{s.label}</span></p>)}
      </div>
      <div className="flips">
        {FACTS.map((f, i) => (
          <button key={f.front} type="button" className={open === i ? 'flipped' : ''} onClick={() => setOpen(open === i ? null : i)}>
            <span className="f">{f.front}</span>
            <span className="b">{f.back}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const CHANNELS = [
  ['chat', 'Chat'],
  ['skills', 'Skills'],
  ['journey', 'Journey'],
  ['facts', 'Facts'],
];

export function TvSurface({ onGo }) {
  const [channel, setChannelRaw] = useState('chat');
  const [glitch, setGlitch] = useState(0);
  const [mood, setMood] = useState('idle');
  const setChannel = (c) => {
    if (c === channel) return;
    setGlitch((g) => g + 1);
    setChannelRaw(c);
  };
  return (
    <>
      <h2 className="kicker">About</h2>
      <Eyes mood={mood} />
      <div className="channels" role="tablist" aria-label="Channels">
        {CHANNELS.map(([k, label], i) => (
          <button key={k} type="button" role="tab" aria-selected={channel === k} onClick={() => setChannel(k)}>
            <span>CH{i + 1}</span> {label}
          </button>
        ))}
      </div>
      <div className="screen glitch" key={glitch}>
        {channel === 'chat' && <Chat onGo={onGo} setChannel={setChannel} setMood={setMood} />}
        {channel === 'skills' && <Skills />}
        {channel === 'journey' && <Journey />}
        {channel === 'facts' && <Facts />}
      </div>
    </>
  );
}

/* ================= 04 contact: the iPhone 14 Plus ================= */

function Compose({ onBack }) {
  const form = useRef();
  const [status, setStatus] = useState(null);
  const send = (e) => {
    e.preventDefault();
    setStatus('sending');
    emailjs.sendForm(EMAILJS.serviceId, EMAILJS.templateId, form.current, { publicKey: EMAILJS.publicKey }).then(
      () => {
        setStatus('sent');
        form.current.reset();
      },
      () => setStatus('error'),
    );
  };
  return (
    <form ref={form} className="compose" onSubmit={send}>
      <div className="compose-head">
        <button type="button" onClick={onBack} aria-label="Back to home screen"><Icon d={I.back} /></button>
        <span className="who"><img src={`${BASE}sujal.jpg`} alt="" />{PROFILE.first}</span>
        <span />
      </div>
      <p className="bubble-in">Hey! Write me a message, I'll reply by email. 👋</p>
      <input name="name" placeholder="Your name" required autoComplete="name" />
      <input name="email" type="email" placeholder="your@email.com" required autoComplete="email" />
      <textarea name="message" placeholder="iMessage" required rows={4} />
      <button type="submit" className="send" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Delivered ✓' : 'Send'}
      </button>
      {status === 'error' && <p className="err">Couldn't send. Email {PROFILE.email} instead.</p>}
    </form>
  );
}

const APP = {
  mail: { label: 'Mail', bg: 'linear-gradient(180deg,#5ac8fa,#1a7cf2)', d: I.mail },
  messages: { label: 'Messages', bg: 'linear-gradient(180deg,#67e57e,#2bb94b)', d: I.chat },
  github: { label: 'GitHub', bg: 'linear-gradient(180deg,#3a3f47,#161b22)', d: I.gh },
  linkedin: { label: 'LinkedIn', bg: 'linear-gradient(180deg,#2a85e0,#0a66c2)', d: I.li },
  cv: { label: 'CV', bg: 'linear-gradient(180deg,#ffffff,#e9e9ee)', d: I.doc, ink: '#1a7cf2' },
  safari: { label: 'Promptivo', bg: 'linear-gradient(180deg,#ffffff,#e9e9ee)', d: I.compass, ink: '#1a7cf2' },
  maps: { label: 'Kolhapur', bg: 'linear-gradient(135deg,#6fd36f 0 40%,#f5f0e1 40% 60%,#7cc4f7 60%)', d: I.pin, ink: '#e8453c' },
  spotify: { label: 'Spotify', bg: '#191414', d: I.spotify, ink: '#1ed760' },
};

function AppIcon({ id, href, download, onClick, label = true }) {
  const a = APP[id];
  const inner = (
    <>
      <span className="ico" style={{ background: a.bg, color: a.ink || '#fff' }}><Icon d={a.d} /></span>
      {label && <span className="lbl">{a.label}</span>}
    </>
  );
  if (onClick) return <button type="button" className="app-i" onClick={onClick} aria-label={a.label}>{inner}</button>;
  return (
    <a className="app-i" href={href} aria-label={a.label} {...(download ? { download } : { target: '_blank', rel: 'noopener noreferrer' })}>
      {inner}
    </a>
  );
}

export function PhoneSurface({ onGo }) {
  const [screen, setScreen] = useState('home');
  useNow();
  const time = nowIST({ hour: '2-digit', minute: '2-digit', hour12: false });
  const rag = PROJECTS.find((p) => p.url);
  return (
    <>
      <h2 className="kicker">Contact</h2>
      <span className="notch" aria-hidden="true" />
      <div className="ios-status" aria-hidden="true">
        <span className="t">{time}</span>
        <span className="ic">
          <Icon d={I.signal} />
          <Icon d={I.wifi} />
          <span className="batt"><i /></span>
        </span>
      </div>
      {screen === 'compose' ? (
        <Compose onBack={() => setScreen('home')} />
      ) : (
        <div className="ios-home">
          <div className="widgets">
            <div className="wg clockw">
              <span className="k">{PROFILE.city}</span>
              <b>{time}</b>
              <span className="v">{nowIST({ weekday: 'long' })} · IST</span>
            </div>
            <div className="wg statusw">
              <span className="dot" />
              <span className="k">Status</span>
              <b>Open to work</b>
              <span className="v">AI / ML roles</span>
            </div>
          </div>
          <div className="wg card">
            <img src={`${BASE}sujal.jpg`} alt="" />
            <div>
              <b>{PROFILE.name}</b>
              <span>{PROFILE.role}</span>
              <span className="mail">{PROFILE.email}</span>
            </div>
          </div>
          <div className="grid">
            <AppIcon id="github" href={PROFILE.github} />
            <AppIcon id="linkedin" href={PROFILE.linkedin} />
            <AppIcon id="cv" href={CV_URL} download="Sujal-Shah-Resume.pdf" />
            <AppIcon id="maps" href={`https://maps.google.com/?q=${encodeURIComponent(`${PROFILE.city}, ${PROFILE.country}`)}`} />
          </div>
          <p className="pages" aria-hidden="true"><i className="on" /><i /></p>
          <div className="dock">
            <AppIcon id="mail" href={`mailto:${PROFILE.email}`} label={false} />
            <AppIcon id="messages" onClick={() => setScreen('compose')} label={false} />
            {rag && <AppIcon id="safari" href={rag.url} label={false} />}
            <AppIcon id="spotify" onClick={() => onGo?.('music')} label={false} />
          </div>
        </div>
      )}
      <span className="home-bar" aria-hidden="true" />
    </>
  );
}

/* ================= the speaker: Spotify, and a lo-fi radio ================= */

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function useSubscribe(src) {
  const [, tick] = useState(0);
  useEffect(() => src.subscribe(() => tick((n) => n + 1)), [src]);
}

function Art({ t, className = '' }) {
  if (t.cover) return <img className={`art ${className}`} src={t.cover} alt="" />;
  return (
    <span className={`art gen ${className}`} style={{ '--h': t.hue ?? 330 }} aria-hidden="true">
      <i /><i /><b>{t.title.split(' ').map((w) => w[0]).join('')}</b>
    </span>
  );
}

function Bars({ spotifyBeat }) {
  const ref = useRef();
  useEffect(() => {
    let raf;
    const draw = () => {
      const t = performance.now() / 1000;
      const bands = spotifyBeat
        ? Array.from({ length: 18 }, (_, i) => (spotify.playing ? 0.25 + 0.6 * Math.abs(Math.sin(t * (2 + (i % 5) * 0.7) + i)) : 0))
        : player.bands(18);
      ref.current?.querySelectorAll('i').forEach((el, i) => (el.style.transform = `scaleY(${0.08 + bands[i] * 0.92})`));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [spotifyBeat]);
  return <div className="bars" ref={ref} aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>;
}

function SpotifyPanel() {
  useSubscribe(spotify);
  const host = useRef();
  useEffect(() => mountSpotify(host.current), []);
  return (
    <div className="sp">
      <div className="sp-head">
        <span className="sp-logo"><Icon d={I.spotify} /></span>
        <div>
          <b>{spotify.track || spotify.title || 'Spotify'}</b>
          <span>{spotify.track ? spotify.title : spotify.playing ? 'Playing on Spotify' : 'Press play on the player below'}</span>
        </div>
      </div>
      {/* Spotify's own player: cover, track list and controls, streaming from Spotify */}
      <div className={`sp-embed${spotify.ready || spotify.failed ? ' ready' : ''}`}>
        <div className="sp-host" ref={host} hidden={spotify.failed} />
        {spotify.failed && spotify.embedUrl && (
          <iframe src={spotify.embedUrl} title="Spotify player" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        )}
        {!spotify.ready && !spotify.failed && (
          <div className="sp-wait" aria-hidden="true">
            <span className="sp-logo big"><Icon d={I.spotify} /></span>
            <span>Connecting to Spotify…</span>
          </div>
        )}
      </div>
      <a className="sp-open" href={SPOTIFY.url} target="_blank" rel="noopener noreferrer">Open in Spotify <Icon d={I.ext} /></a>
    </div>
  );
}

function RadioPanel() {
  useSubscribe(player);
  const p = player;
  const t = p.track;
  const el = p.elapsed();
  const dur = p.duration() || 1;
  return (
    <div className="radio">
      <Art t={t} />
      <div className="np">
        <h3>{t.title}</h3>
        <p className="artist">{t.artist}</p>
      </div>
      <Bars />
      <div className="progress"><i style={{ width: `${Math.min(100, (el / dur) * 100)}%` }} /></div>
      <p className="times"><span>{fmt(el)}</span><span>{fmt(dur)}</span></p>
      <div className="controls">
        <button type="button" onClick={() => p.prev()} aria-label="Previous track"><Icon d={I.prev} /></button>
        <button type="button" className="pp" onClick={() => p.toggle()} aria-label={p.playing ? 'Pause' : 'Play'}><Icon d={p.playing ? I.pause : I.play} /></button>
        <button type="button" onClick={() => p.next()} aria-label="Next track"><Icon d={I.next} /></button>
      </div>
      <ol className="queue">
        {p.tracks.map((x, i) => (
          <li key={x.title}>
            <button type="button" aria-current={i === p.index} onClick={() => p.play(i)}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="tt">{x.title}</span>
              <span className="d">{x.kind === 'synth' ? fmt(x.duration) : ''}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MusicSurface() {
  const [tab, setTab] = useState(spotify.enabled ? 'spotify' : 'radio');
  useSubscribe(audio);
  const hue = audio.source === 'lofi' ? player.track.hue ?? 330 : 145;
  return (
    <>
      <span className="np-bg" style={{ '--h': hue, backgroundImage: tab === 'spotify' && spotify.art ? `url(${spotify.art})` : undefined }} aria-hidden="true" />
      <p className="kicker"><i className={audio.playing ? 'on' : ''} />{audio.playing ? `Now playing · ${audio.source === 'spotify' ? 'Spotify' : 'Lo-fi radio'}` : tab === 'spotify' ? 'Spotify' : 'Lo-fi radio'}</p>
      <div className="m-tabs" role="tablist">
        {spotify.enabled && (
          <button type="button" role="tab" aria-selected={tab === 'spotify'} onClick={() => setTab('spotify')}>
            <Icon d={I.spotify} /> Spotify
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === 'radio'} onClick={() => setTab('radio')}>Lo-fi radio</button>
      </div>
      {/* both stay mounted, so Spotify keeps playing while you look at the radio */}
      {spotify.enabled && <div className={`m-panel${tab === 'spotify' ? ' on' : ''}`}><SpotifyPanel /></div>}
      <div className={`m-panel${tab === 'radio' ? ' on' : ''}`}><RadioPanel /></div>
    </>
  );
}

export const SURFACE_PARTS = {
  projects: { cls: 'desk', Body: ProjectsSurface, label: 'Projects' },
  experience: { cls: 'board', Body: ExperienceSurface, label: 'Experience' },
  about: { cls: 'tv', Body: TvSurface, label: `Ask about ${PROFILE.first}` },
  contact: { cls: 'phone', Body: PhoneSurface, label: 'Contact' },
  music: { cls: 'music', Body: MusicSurface, label: 'Music' },
};
