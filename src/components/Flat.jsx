import { PROFILE } from '../data';
import { Hero, IndexNav } from './Ui';
import { ExperienceSurface, MusicSurface, PhoneSurface, ProjectsSurface, TvSurface } from './Surfaces';

// The page, in one column: only for a machine that can't draw the room.
export default function Flat() {
  const go = (key) => document.getElementById(key)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <div className="flat-page">
      <Hero mode="flat" />
      <p className="flat-note">
        <span className="k">Flat version</span>
        WebGL isn't available in this browser, so the room is laid out as a page.
      </p>
      <IndexNav current={null} onGo={go} />
      <section className="surface desk" id="projects" aria-label="Projects"><ProjectsSurface flat /></section>
      <section className="surface board" id="experience" aria-label="Experience"><ExperienceSurface flat /></section>
      <section className="surface tv" id="about" aria-label={`Ask about ${PROFILE.first}`}><TvSurface onGo={go} /></section>
      <section className="surface phone" id="contact" aria-label="Contact"><PhoneSurface onGo={go} /></section>
      <section className="surface music" id="music" aria-label="Music"><MusicSurface /></section>
      <footer className="flat-foot">
        <span>© {new Date().getFullYear()} {PROFILE.name}</span>
        <span>{PROFILE.city} · IST</span>
      </footer>
    </div>
  );
}
