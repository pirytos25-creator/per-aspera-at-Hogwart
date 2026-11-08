/*
 * Generated ambience: wind, a sparse celesta-like melody and small events that
 * depend on the place and the time of day (owls at night, birds in the
 * morning, a crackling hearth indoors). No audio files are downloaded.
 */
export function createAudio() {
  let ctx = null,
    master = null,
    windGain = null,
    windFilter = null,
    musicBus = null,
    noise = null,
    melodyTimer = 0,
    eventTimer = 0;
  let scene = { interior: false, roomType: '', time: 'dusk', weather: 'clear' };
  let rainGain = null,
    rainFilter = null,
    chordIndex = 0;

  const HEARTH_ROOMS = new Set(['common', 'office', 'kitchen']);
  // A slow music-box progression in a minor key (i – VI – iv – V), voiced as
  // broken chords. Night drops a fourth, morning and day brighten to the relative major.
  const CHORDS = [
    [329.63, 392, 493.88, 659.25],
    [261.63, 329.63, 392, 523.25],
    [220, 261.63, 329.63, 440],
    [246.94, 311.13, 369.99, 493.88],
  ];
  const BRIGHT = [
    [392, 493.88, 587.33, 783.99],
    [261.63, 329.63, 392, 523.25],
    [293.66, 369.99, 440, 587.33],
    [329.63, 392, 493.88, 659.25],
  ];
  const TRANSPOSE = { dusk: 1, night: 0.75, morning: 1, day: 1 };

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 1;
    musicBus.connect(master);

    // Brownian noise: a soft, seamless wind bed and the raw material for events.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.025) / 1.02;
      data[i] = last;
    }
    noise = buffer;
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 350;
    windGain = ctx.createGain();
    windGain.gain.value = 1;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();
    // Rain: brighter noise on its own bus, muffled when you step indoors.
    const rain = ctx.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    rain.playbackRate.value = 6;
    rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 2600;
    rainFilter.Q.value = 0.5;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    rain.start();
    applyScene(true);
  }

  function envelope(gain, peak, attack, release, at = ctx.currentTime) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  }

  function tone(
    frequency,
    { type = 'sine', peak = 0.05, attack = 0.6, release = 4.4, bus = musicBus, at } = {},
  ) {
    const start = at ?? ctx.currentTime;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    envelope(gain, peak, attack, release, start);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + attack + release + 0.1);
    return osc;
  }

  function burst({ frequency = 1500, q = 2, peak = 0.08, length = 0.05, type = 'bandpass', at } = {}) {
    const start = at ?? ctx.currentTime;
    const src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    src.buffer = noise;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    envelope(gain, peak, 0.004, length, start);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start, Math.random() * 3);
    src.stop(start + length + 0.05);
  }

  function owl() {
    const t = ctx.currentTime;
    for (const [offset, from, to, length] of [
      [0, 392, 350, 0.55],
      [0.8, 370, 330, 0.25],
      [1.12, 370, 320, 0.7],
    ]) {
      const osc = tone(from, { peak: 0.035, attack: 0.08, release: length, at: t + offset });
      osc.frequency.exponentialRampToValueAtTime(to, t + offset + length);
    }
  }

  function chirp() {
    const t = ctx.currentTime,
      base = 2600 + Math.random() * 1500,
      notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const osc = tone(base, { peak: 0.012, attack: 0.012, release: 0.07, at: t + i * 0.11 });
      osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + i * 0.11 + 0.07);
    }
  }

  function applyScene(instant = false) {
    if (!ctx) return;
    const at = ctx.currentTime,
      ramp = instant ? 0.01 : 1.2;
    const indoor = scene.interior;
    const snowing = scene.weather === 'snow',
      raining = scene.weather === 'rain';
    windFilter.frequency.setTargetAtTime(
      indoor ? 170 : snowing ? 220 : scene.time === 'night' ? 260 : 360,
      at,
      ramp / 3,
    );
    windGain.gain.setTargetAtTime(indoor ? 0.45 : snowing ? 0.7 : raining ? 1.25 : 1, at, ramp / 3);
    rainGain.gain.setTargetAtTime(raining ? (indoor ? 0.9 : 2.4) : 0, at, ramp);
    rainFilter.frequency.setTargetAtTime(indoor ? 700 : 2600, at, ramp / 3);
    musicBus.gain.setTargetAtTime(indoor ? 0.7 : 1, at, ramp / 3);
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    // Roughly once a second: decide whether something small happens.
    if (scene.interior) {
      if (HEARTH_ROOMS.has(scene.roomType))
        for (let i = 0; i < 3; i++)
          if (Math.random() < 0.55)
            burst({
              frequency: 1200 + Math.random() * 2600,
              peak: 0.03 + Math.random() * 0.05,
              at: ctx.currentTime + Math.random(),
            });
      if (scene.roomType === 'potions' && Math.random() < 0.25)
        tone(140 + Math.random() * 60, { peak: 0.018, attack: 0.02, release: 0.18, bus: master });
    } else if (scene.weather === 'rain') {
      if (Math.random() < 0.02) burst({ frequency: 90, q: 0.6, peak: 0.12, length: 2.6, type: 'lowpass' }); // distant thunder
    } else if (scene.time === 'night') {
      if (Math.random() < 0.035) owl();
    } else if (scene.time === 'morning' || scene.time === 'day') {
      if (Math.random() < (scene.weather === 'snow' ? 0.05 : 0.28)) chirp();
    }
  }

  /** A celesta-like voice: a sine with a quiet, fast-fading octave shimmer. */
  function bell(frequency, at, peak) {
    tone(frequency, { peak, attack: 0.008, release: 2.6, at });
    tone(frequency * 2, { type: 'triangle', peak: peak * 0.18, attack: 0.004, release: 0.7, at });
  }
  function melody() {
    if (!ctx || ctx.state !== 'running') return;
    const bright = scene.time === 'morning' || scene.time === 'day';
    const chord = (bright ? BRIGHT : CHORDS)[chordIndex++ % 4];
    const shift = (TRANSPOSE[scene.time] || 1) * (scene.interior ? 0.5 : 1);
    const peak = scene.interior ? 0.032 : 0.04;
    const start = ctx.currentTime + 0.05;
    const pattern = Math.random() < 0.5 ? [0, 1, 2, 3] : [0, 2, 1, 3, 2];
    pattern.forEach((n, i) => bell(chord[n] * shift, start + i * 0.34, peak * (i === 0 ? 1.1 : 0.85)));
    // A low, soft pad under the first note.
    tone(chord[0] * shift * 0.5, { peak: 0.022, attack: 1.2, release: 3.2, at: start });
  }

  return {
    get enabled() {
      return !!ctx && ctx.state === 'running';
    },
    async toggle(force) {
      const wantOn = force ?? !(ctx && ctx.state === 'running');
      if (!wantOn) {
        if (ctx) await ctx.suspend();
        return false;
      }
      if (!ctx) build();
      await ctx.resume();
      clearInterval(melodyTimer);
      clearInterval(eventTimer);
      melodyTimer = setInterval(melody, 4200);
      eventTimer = setInterval(tick, 1000);
      return ctx.state === 'running';
    },
    setScene(next) {
      scene = { ...scene, ...next };
      applyScene();
    },
    spell(color = 0) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime,
        base = 480 + (color % 7) * 40;
      const osc = tone(base, { peak: 0.055, attack: 0.01, release: 0.64, bus: master, at: t });
      osc.frequency.exponentialRampToValueAtTime(base * 2.7, t + 0.28);
      tone(base * 2, {
        type: 'triangle',
        peak: 0.012,
        attack: 0.02,
        release: 0.5,
        bus: master,
        at: t + 0.05,
      });
    },
    step() {
      if (!ctx || ctx.state !== 'running') return;
      burst({ frequency: 300 + Math.random() * 120, q: 0.7, peak: 0.05, length: 0.07, type: 'lowpass' });
    },
    chime() {
      if (!ctx || ctx.state !== 'running') return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, { peak: 0.03, attack: 0.01, release: 1.4, bus: master, at: ctx.currentTime + i * 0.09 }),
      );
    },
  };
}
