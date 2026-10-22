import { useCallback, useEffect, useRef, useState } from 'react';
import { SECTIONS } from './data';
import { setSoundOn, whoosh } from './sound';
import { audio } from './audio';
import Loader from './components/Loader';
import Room from './components/Room';
import Flat from './components/Flat';
import { Cursor, DragHint, Hero, IndexNav, NowPlaying, SoundButton, Undock } from './components/Ui';
import { SURFACE_PARTS } from './components/Surfaces';

const params = new URLSearchParams(window.location.search);

// The room for every screen whose GPU can draw it; the page only when there's
// no WebGL 2, or WebGL drawn in software, where the room crawls.
// ?room forces the room, ?flat forces the page.
function detectFlat() {
  if (params.has('flat')) return true;
  if (params.has('room')) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
  } catch {
    return true;
  }
}

const FLAT = detectFlat();
document.documentElement.classList.toggle('flat', FLAT);
const KEYS = SECTIONS.map((s) => s.key);
const STATIONS = [...KEYS, 'music']; // the speaker has no index entry, like the reference

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function App() {
  if (FLAT) return <Flat />;
  return <RoomApp />;
}

function RoomApp() {
  const skip = params.has('skip');
  const [phase, setPhase] = useState(skip ? 'room' : 'loading'); // loading → opening → room
  const [loaderGone, setLoaderGone] = useState(skip);
  const [hero, setHero] = useState(skip ? 'sig' : 'wait');
  const [station, setStation] = useState(null);
  const [docked, setDocked] = useState(false);
  const [sound, setSound] = useState(false);
  const [explored, setExplored] = useState(false);
  const sheet = useMedia('(max-width: 760px), (max-height: 520px)');
  const finePointer = useMedia('(pointer: fine)');
  const surfaces = useRef({});

  const open = useCallback(
    (key) => {
      if (phase !== 'room') return;
      setStation((cur) => {
        if (cur !== key) whoosh();
        return key;
      });
      if (key === 'music' && !audio.playing) audio.resume(); // the click on the speaker starts it
      setExplored(true);
    },
    [phase],
  );
  const close = useCallback(() => {
    setStation((cur) => {
      if (cur) whoosh();
      return null;
    });
  }, []);
  const onArrive = useCallback((v) => setDocked(v), []);
  const onExplore = useCallback(() => setExplored(true), []);

  const enter = (withSound) => {
    setSound(withSound);
    if (withSound) audio.start(); // in the click, so the browser lets it play
    setPhase('opening');
    setTimeout(() => setLoaderGone(true), 500);
    // the reference's timeline: the room is yours at 4.8 s; the name rises at 4.7 s
    // and flies to the corner 3.6 s later (sooner if you click or press a key)
    setTimeout(() => setPhase('room'), 4800);
    setTimeout(() => setHero('intro'), 4700);
    const settle = setTimeout(() => setHero('sig'), 4700 + 3600);
    const skip = () => {
      clearTimeout(settle);
      setHero((h) => (h === 'intro' ? 'sig' : h));
    };
    setTimeout(() => {
      addEventListener('pointerdown', skip, { once: true });
      addEventListener('keydown', skip, { once: true });
    }, 4800);
  };

  // deep links like /#projects open that section once the room is ready
  useEffect(() => {
    if (phase !== 'room') return;
    const key = window.location.hash.slice(1);
    if (STATIONS.includes(key)) open(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'room') return;
    window.history.replaceState(null, '', station ? `#${station}` : window.location.pathname + window.location.search);
  }, [station, phase]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') close();
      const n = Number(e.key);
      if (n >= 1 && n <= KEYS.length) open(KEYS[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // the drag hint shows for a few seconds after arriving, or until the visitor explores
  useEffect(() => {
    if (phase !== 'room') return;
    const id = setTimeout(() => setExplored(true), 9000);
    return () => clearTimeout(id);
  }, [phase]);

  const target = phase === 'loading' ? 'intro' : phase === 'opening' ? null : station;
  const isDocked = !!station && docked;

  return (
    <div className={`app${isDocked ? ' docked' : ''}${phase !== 'room' ? ' opening' : ''}`}>
      <Room
        target={target}
        live={phase === 'room' && !station}
        track={phase === 'room' && station !== 'projects' && station !== 'about'}
        awake={phase !== 'loading'}
        sheet={sheet}
        surfaces={surfaces}
        onOpen={open}
        onArrive={onArrive}
        onExplore={onExplore}
      />

      {STATIONS.map((key) => {
        const { cls, Body, label } = SURFACE_PARTS[key];
        return (
          <section
            key={key}
            id={key}
            ref={(el) => (surfaces.current[key] = el)}
            className={`surface ${cls}${sheet ? ' sheet' : ''}${station === key && docked ? ' on' : ''}`}
            hidden={station !== key}
            aria-label={label}
          >
            <Body onGo={open} />
          </section>
        );
      })}

      <Hero mode={hero} />
      <DragHint show={phase === 'room' && !explored && !station} />
      {station && <Undock onClick={close} />}
      <IndexNav current={station} onGo={(k) => (k === station ? close() : open(k))} hidden={phase !== 'room'} />
      <SoundButton
        on={sound}
        hidden={phase !== 'room'}
        onToggle={() => {
          setSoundOn(!sound);
          if (sound) audio.pause();
          else audio.resume();
          setSound(!sound);
        }}
      />
      <NowPlaying hidden={phase !== 'room'} onOpen={() => open('music')} />
      {finePointer && <Cursor />}
      {!loaderGone && <Loader onEnter={enter} />}
    </div>
  );
}
