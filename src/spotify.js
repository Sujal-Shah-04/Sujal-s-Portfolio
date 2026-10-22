// Spotify, through Spotify's own embed player and its iFrame API
// (https://developer.spotify.com/documentation/embeds). The player is created once and
// kept alive, so music keeps playing when you leave the speaker.
import { SPOTIFY } from './data';

const listeners = new Set();
export const spotify = {
  enabled: !!SPOTIFY.url,
  ready: false,
  playing: false,
  position: 0,
  duration: 0,
  title: '',
  subtitle: 'Spotify',
  art: '',
  track: '',
  failed: false, // the control API didn't come up: fall back to Spotify's plain embed
  embedUrl: '',
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  play() {
    if (!controller || !spotify.ready) {
      wantPlay = true; // play as soon as the player is ready
      return;
    }
    started ? controller.resume() : controller.play(); // play() starts from the top, resume() picks up
    started = true;
  },
  pause() {
    controller?.pause();
  },
  toggle() {
    spotify.playing ? spotify.pause() : spotify.play();
  },
};

let controller = null;
let started = false;
let wantPlay = false;
const emit = () => listeners.forEach((f) => f());

// open.spotify.com/playlist/ID?si=… → spotify:playlist:ID
function toUri(url) {
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? `spotify:${m[1]}:${m[2]}` : url;
}

async function oembed(url) {
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// What's playing: the playlist's name and cover, then the track's once Spotify reports it.
async function describe(url, isTrack) {
  const info = await oembed(url);
  if (!info) return;
  if (isTrack) {
    spotify.track = info.title;
  } else {
    spotify.title = info.title;
  }
  spotify.art = info.thumbnail_url || spotify.art;
  emit();
}

let lastUri = '';
const m = SPOTIFY.url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/);
spotify.embedUrl = m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : '';

export function mountSpotify(host) {
  if (!spotify.enabled || controller || !host) return;
  describe(SPOTIFY.url, false);
  setTimeout(() => {
    if (!spotify.ready) {
      spotify.failed = true;
      emit();
    }
  }, 8000);
  const create = (IFrameAPI) => {
    const el = document.createElement('div');
    host.appendChild(el);
    IFrameAPI.createController(el, { uri: toUri(SPOTIFY.url), width: '100%', height: '100%' }, (c) => {
      controller = c;
      c.addListener('ready', () => {
        spotify.ready = true;
        if (wantPlay) spotify.play();
        emit();
      });
      c.addListener('playback_update', (e) => {
        const d = e.data || {};
        spotify.playing = !d.isPaused;
        if (spotify.playing) started = true;
        spotify.position = (d.position || 0) / 1000;
        spotify.duration = (d.duration || 0) / 1000;
        const uri = d.playingURI;
        if (uri && uri !== lastUri && uri.startsWith('spotify:track:')) {
          lastUri = uri;
          describe(`https://open.spotify.com/track/${uri.split(':')[2]}`, true);
        }
        emit();
      });
    });
  };
  if (window.SpotifyIframeApi) create(window.SpotifyIframeApi);
  else {
    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api;
      create(api);
    };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    document.body.appendChild(s);
  }
}
