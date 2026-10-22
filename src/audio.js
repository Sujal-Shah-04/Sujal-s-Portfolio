// One view over the two music sources, Spotify and the lo-fi radio: what's playing,
// how loud (for the speaker rings), and only one of them at a time.
import { player } from './music';
import { spotify } from './spotify';

let last = spotify.enabled ? 'spotify' : 'lofi';

export const audio = {
  get playing() {
    return spotify.playing || player.playing;
  },
  get source() {
    return spotify.playing ? 'spotify' : player.playing ? 'lofi' : null;
  },
  get label() {
    if (spotify.playing) return spotify.track || spotify.title || 'Spotify';
    return player.playing ? player.track.title : '';
  },
  // Spotify's audio lives in its own iframe, out of our analyser's reach, so its pulse is a soft beat.
  level(t = performance.now() / 1000) {
    if (spotify.playing) return 0.25 + 0.3 * Math.pow(Math.abs(Math.sin(t * Math.PI * 1.45)), 3);
    return player.level();
  },
  pause() {
    spotify.pause();
    player.pause();
  },
  // Spotify when it's the chosen source (it starts once its player is up), else the radio.
  resume() {
    if (last === 'spotify' && spotify.enabled) spotify.play();
    else player.play();
  },
  // On entering with sound: Spotify if it starts, else the radio, which always can.
  start() {
    if (spotify.enabled && spotify.ready) {
      spotify.play();
      setTimeout(() => !spotify.playing && player.play(), 2500);
    } else player.play();
  },
  subscribe(fn) {
    const a = player.subscribe(fn);
    const b = spotify.subscribe(fn);
    return () => {
      a();
      b();
    };
  },
};

spotify.subscribe(() => {
  if (!spotify.playing) return;
  last = 'spotify';
  if (player.playing) player.pause();
});
player.subscribe(() => {
  if (!player.playing) return;
  last = 'lofi';
  if (spotify.playing) spotify.pause();
});
