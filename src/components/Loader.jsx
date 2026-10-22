import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { setSoundOn } from '../sound';

const EPOCHS = [
  [8, 'tokenizer loaded · 32k vocab'],
  [22, 'epoch 1/4 · projects.bin'],
  [42, 'epoch 2/4 · experience.bin'],
  [62, 'epoch 3/4 · about.bin'],
  [82, 'epoch 4/4 · contact.bin'],
];

const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lossAt = (p, jitter = 0) => 2.59 * Math.exp(-p / 21) + 0.038 + jitter;

// A model "training" while the room loads: its progress is the room's.
export default function Loader({ onEnter }) {
  const { active } = useProgress();
  const activeRef = useRef(active);
  activeRef.current = active;
  const [p, setP] = useState(0);
  const [live, setLive] = useState({ tps: 0, gpu: 0 });
  const points = useRef([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setP((prev) => {
        if (prev >= 100) return 100;
        const next = Math.min(activeRef.current ? 95 : 100, prev + (reduced ? 10 : 0.5 + Math.random() * 1.6));
        const l = lossAt(next, (Math.random() - 0.5) * 0.08 * (1 - next / 100));
        points.current.push(`${(next * 3).toFixed(1)},${(8 + (1 - l / 2.65) * 76).toFixed(1)}`);
        return next;
      });
      setLive({ tps: 9 + Math.random() * 3.4, gpu: Math.round(92 + Math.random() * 7) });
    }, 45);
    return () => clearInterval(id);
  }, []);

  const done = p >= 100;
  const last = points.current[points.current.length - 1]?.split(',') || [0, 8];
  const enter = (sound) => {
    setSoundOn(sound); // inside the click, so the browser allows audio
    setLeaving(true);
    onEnter(sound);
  };

  return (
    <div className={`loader${leaving ? ' done' : ''}`} role="status" aria-label="Loading the room">
      <div className="boot">
        <p className="boot-head"><span>$</span> python train.py --model <b>sujal-1</b> --data ./room</p>
        <div className="train-chart">
          <svg viewBox="0 0 300 90" preserveAspectRatio="none">
            <polyline points={points.current.join(' ')} />
            <circle r="2.5" cx={last[0]} cy={last[1]} />
          </svg>
          <p className="train-axis"><span>loss</span><span>{lossAt(p).toFixed(3)}</span></p>
        </div>
        <ol className="boot-log">
          {EPOCHS.filter(([at]) => p >= at).map(([at, line]) => (
            <li key={at}><i>✓</i>{line} · loss {lossAt(at).toFixed(3)}</li>
          ))}
          <li className="wait"><i>{done ? '✓' : '·'}</i>{done ? 'converged · waking sujal-1' : 'training…'}</li>
        </ol>
        <p className="train-live">
          step {Math.round(p * 60)}/6000 · {done ? '0.0' : live.tps.toFixed(1)}k tok/s · gpu {done ? 0 : live.gpu}%
        </p>
        <div className="loader-status">
          <p className="kicker"><span>{done ? 'Converged' : 'Booting'}</span><span>{Math.floor(p)}%</span></p>
          <div className="loader-bar"><i style={{ transform: `scaleX(${p / 100})` }} /></div>
        </div>
      </div>
      {done && (
        <div className="enter">
          <button type="button" data-sound="on" onClick={() => enter(true)}>Enter with sound</button>
          <button type="button" data-sound="off" onClick={() => enter(false)}>Enter without</button>
        </div>
      )}
    </div>
  );
}
