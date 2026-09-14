const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const roots = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9 };
const modes = { lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], pentatonic: [0, 2, 4, 7, 9] };
const scenes = {
  still: { chordChance: .22, shimmer: [10, 23] },
  forest: { chordChance: .28, shimmer: [14, 28] },
  tide: { chordChance: .35, shimmer: [8, 19] },
  ember: { chordChance: .16, shimmer: [18, 32] }
};
const sceneProfiles = {
  still: { label: '静かな水面', root: 'G', mode: 'pentatonic', pace: 1, register: 0, speed: 1.2, wet: .48, brightness: .85, layers: ['piano', 'haze', 'stream'], description: '余白のあるピアノと小川。静かにほどける響き' },
  forest: { label: '深い森', root: 'D', mode: 'dorian', pace: 2, register: 0, speed: 1, wet: .42, brightness: .7, layers: ['flute', 'kalimba', 'stream'], description: '木陰に響くフルートとカリンバ、小川の流れ' },
  tide: { label: '潮の満ち引き', root: 'F', mode: 'lydian', pace: 1, register: 0, speed: 1.5, wet: .7, brightness: .65, layers: ['strings', 'haze', 'ocean'], description: '波の上をゆっくり広がる弦とパッド' },
  ember: { label: '残り火', root: 'A', mode: 'dorian', pace: 1, register: -1, speed: 1.3, wet: .18, brightness: .45, layers: ['epiano', 'bowl', 'fireplace', 'tape'], description: '丸いエレクトリックピアノと暖炉。近く温かな響き' },
  snow: { label: '雪原', root: 'C', mode: 'pentatonic', pace: 1, register: 1, speed: 2, wet: .82, brightness: 1.2, layers: ['shimmer', 'haze', 'wind'], description: 'まばらなガラスベルが長い余韻を残す雪の静寂' },
  city: { label: '雨の街', root: 'E', mode: 'dorian', pace: 3, register: 0, speed: .65, wet: .22, brightness: .6, layers: ['epiano', 'rain', 'tape'], description: '雨とテープノイズに重なる、短いエレクトリックピアノ' },
  desert: { label: '砂漠', root: 'D', mode: 'phrygian', pace: 1, register: -1, speed: 1.6, wet: .3, brightness: .5, layers: ['drone', 'flute', 'wind'], description: '低いドローンと異国的な旋律、乾いた風' },
  stars: { label: '星空', root: 'F', mode: 'lydian', pace: 2, register: 1, speed: 1.1, wet: .9, brightness: 1.6, layers: ['kalimba', 'shimmer', 'haze'], description: 'カリンバの弾き音とベルが深い残響の中できらめく' },
  bamboo: { label: '竹林', root: 'G', mode: 'pentatonic', pace: 2, register: 0, speed: .75, wet: .25, brightness: 1.1, layers: ['harp', 'kalimba', 'wind'], description: 'ハープと小さなカリンバ、風の通る余白' },
  deep: { label: '海底', root: 'E', mode: 'aeolian', pace: 1, register: -1, speed: 2, wet: .85, brightness: .3, layers: ['drone', 'strings', 'ocean'], description: '暗い低音と弦の持続音に沈む、重く遅い流れ' }
};
Object.entries(sceneProfiles).forEach(([id, profile]) => {
  scenes[id] = { chordChance: .2, shimmer: [10, 23], ...scenes[id], ...profile };
});
modes.phrygian = [0, 1, 3, 5, 7, 8, 10];
modes.aeolian = [0, 2, 3, 5, 7, 8, 10];
let context, master, ambience, wetGain, dryGain, output, volumeGain, isPlaying = false, isLoading = false, timers = [], nodes = [];
const retiringArrangements = new Set();
let sampleBuffers = {}, harmonyRevision = 0, harmony = [], soundingNotes = [];
const voices = new Map();
let phraseEvent = null, foreground = null, phraseMemory = null;
const SAMPLE_URLS = {
  rain: './assets/rain.mp3', wind: './assets/wind.mp3', ocean: './assets/ocean.mp3', stream: './assets/stream.mp3',
  birds: './assets/birds.mp3', fireplace: './assets/fireplace.mp3'
};
Object.values(acousticBanks).flat().forEach(sample => { SAMPLE_URLS[sample.name] = sample.url; });
const sampleTakes = new Map();
const performers = new Map();
const $ = id => document.getElementById(id);
const selected = id => $(id).checked;
const midiToHz = midi => 440 * Math.pow(2, (midi - 69) / 12);
const rand = (min, max) => min + Math.random() * (max - min);
const pick = values => values[Math.floor(Math.random() * values.length)];
const masterLevel = () => (+$('volume').value / 100) * 1;
const timeProfiles = [
  { id: 'midnight', label: '深夜', start: 0, speed: 1.8, brightness: .55, wet: .14, chords: .55, upper: .1, description: '音数を抑え、低めの旋律と深い余韻に' },
  { id: 'early', label: '早朝', start: 5, speed: 1.25, brightness: .85, wet: .08, chords: .8, upper: .3, description: '余白の中から、少しずつ明るい響きへ' },
  { id: 'morning', label: '朝', start: 8, speed: .8, brightness: 1.25, wet: -.08, chords: 1.2, upper: .65, description: '高めの旋律が軽やかに行き交う響き' },
  { id: 'day', label: '昼', start: 12, speed: .95, brightness: 1.1, wet: -.04, chords: 1.35, upper: .5, description: 'ほどよい動きと、豊かな和音の重なり' },
  { id: 'evening', label: '夕方', start: 17, speed: 1.2, brightness: .8, wet: .05, chords: 1.05, upper: .3, description: '温かな音色と、ゆったりした旋律に' },
  { id: 'night', label: '夜', start: 21, speed: 1.5, brightness: .65, wet: .12, chords: .7, upper: .18, description: '落ち着いた低めの音と、長い余韻に' }
];
let performance = { speed: 1, brightness: 1, degree: 0 };
function timeConfig(date = new Date()) {
  const selection = $('time-style').value;
  if (selection === 'off') return { label: '時間変化なし', speed: 1, brightness: 1, wet: 0, chords: 1, upper: .28, description: '景色本来の響きで演奏' };
  if (selection !== 'auto') return timeProfiles.find(profile => profile.id === selection);
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const index = timeProfiles.findLastIndex(profile => hour >= profile.start);
  const current = timeProfiles[index], next = timeProfiles[(index + 1) % timeProfiles.length];
  const boundary = next.start || 24;
  const blend = Math.max(0, Math.min(1, (hour - boundary + .5) / .5));
  const result = { ...current };
  for (const key of ['speed', 'brightness', 'wet', 'chords', 'upper']) result[key] += (next[key] - current[key]) * blend;
  return result;
}
function refreshTime() {
  if (context) soundingNotes = soundingNotes.filter(note => note.until > context.currentTime);
  const time = timeConfig();
  $('time-description').textContent = `${$('time-style').value === 'auto' ? '端末の現地時刻に連動 · ' : ''}${time.label}：${time.description}。再生ごと、演奏中も数分ごとにフレーズが変化します。`;
  if (isPlaying) { updateSpace(8); updateNowPlaying(); }
}
function varyPerformance() {
  performance = { speed: MusicTheory.clamp(performance.speed + rand(-.025, .025), .9, 1.1), brightness: MusicTheory.clamp(performance.brightness + rand(-.02, .02), .93, 1.07), degree: pick([0, 1, 2, 4]) };
  voices.forEach(voice => { voice.motif[Math.floor(rand(0, voice.motif.length))] = pick([-1, 0, 1, 2]); });
}

function track(...members) {
  nodes.push(...members);
  const sources = members.filter(node => typeof node.start === 'function');
  let remaining = sources.length;
  sources.forEach(source => source.addEventListener('ended', () => {
    if (--remaining) return;
    members.forEach(node => node.disconnect());
    nodes = nodes.filter(node => !members.includes(node));
  }, { once: true }));
}
function resetHarmony() {
  foreground = null; phraseMemory = null;
  harmonyRevision = 0; harmony = MusicTheory.nextChord(getScale()); voices.clear(); soundingNotes = [];
}
function updateSpace(seconds = 3) {
  const wet = sceneConfig().wet;
  wetGain.gain.setTargetAtTime(wet, context.currentTime, seconds);
  dryGain.gain.setTargetAtTime(1 - wet * .65, context.currentTime, seconds);
}

function noiseBuffer(seconds = 3) {
  const b = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}
async function loadSamples() {
  const entries = Object.entries(SAMPLE_URLS).filter(([name]) => !sampleBuffers[name]);
  const failures = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (entries.length) {
      const [name, url] = entries.shift();
      try { const response = await fetch(url); if (!response.ok) throw new Error(response.status); sampleBuffers[name] = await context.decodeAudioData(await response.arrayBuffer()); }
      catch (error) { failures.push(name); console.warn(`音源を読み込めませんでした: ${name}`, error); }
    }
  }));
  $('audio-notice').textContent = failures.length ? '一部の録音を読み込めませんでした。停止して再生すると再試行します。' : '';
}
function sampledTone(candidates, midi, duration, volume, attack = .008, offset = 0) {
  const available = candidates.filter(item => sampleBuffers[item.name] && Math.abs(item.midi - midi) <= 3);
  if (!available.length) return false;
  const distance = Math.min(...available.map(item => Math.abs(item.midi - midi)));
  const nearest = available.filter(item => Math.abs(item.midi - midi) === distance);
  const key = candidates[0].name, previous = sampleTakes.get(key);
  const alternatives = nearest.filter(item => item.name !== previous);
  const chosen = pick(alternatives.length ? alternatives : nearest); sampleTakes.set(key, chosen.name);
  if (!performers.has(key)) performers.set(key, MusicTheory.performer());
  const gesture = performers.get(key)();
  const t = context.currentTime + offset + gesture.delay, source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
  source.buffer = sampleBuffers[chosen.name];
  source.playbackRate.value = Math.pow(2, (midi - chosen.midi + (chosen.tune || 0) / 100) / 12);
  const length = Math.min((phraseEvent ? Math.min(duration, 6) : duration) * gesture.length, source.buffer.duration / source.playbackRate.value - .02);
  if (length <= .1) return false;
  const level = volume * .96 * gesture.level * (phraseEvent?.level ?? 1), release = Math.min(1.4, length * .22);
  gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(level, t + Math.min(attack * gesture.attack, length * .1));
  gain.gain.setValueAtTime(level, t + length - release); gain.gain.linearRampToValueAtTime(0, t + length);
  filter.type = 'lowpass'; filter.frequency.value = MusicTheory.clamp(9500 * Math.sqrt(sceneConfig().brightness) * gesture.brightness, 5000, 16000);
  source.connect(filter).connect(gain).connect(master); source.start(t); source.stop(t + length + .02); track(source, gain, filter); return true;
}

function ambienceLoop(name, level, type, frequency) {
  const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
  source.buffer = sampleBuffers[name]; source.loop = true; filter.type = type; filter.frequency.value = frequency; gain.gain.value = level;
  source.connect(filter).connect(gain).connect(master); source.start(); track(source, gain, filter); return { source, gain };
}
function makeAudio() {
  context = new AudioContextClass(); master = context.createGain(); master.gain.value = 0.0001;
  const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -2; compressor.knee.value = 0; compressor.ratio.value = 12; compressor.attack.value = .003; compressor.release.value = .16;
  volumeGain = context.createGain(); volumeGain.gain.value = masterLevel(); volumeGain.connect(compressor).connect(context.destination);
  const convolver = context.createConvolver(); convolver.buffer = impulse(); wetGain = context.createGain(); wetGain.gain.value = sceneConfig().wet;
  dryGain = context.createGain(); dryGain.gain.value = 1 - sceneConfig().wet * .65;
  const delay = context.createDelay(2), feedback = context.createGain(), damp = context.createBiquadFilter(), send = context.createGain();
  delay.delayTime.value = .79; feedback.gain.value = .35; send.gain.value = .12; damp.type = 'lowpass'; damp.frequency.value = 1800;
  delay.connect(damp).connect(feedback).connect(delay); damp.connect(convolver);
  output = context.createGain(); output.connect(dryGain).connect(volumeGain); output.connect(convolver).connect(wetGain).connect(volumeGain); output.connect(send).connect(delay); master.connect(output);
}
function impulse() { const b = context.createBuffer(2, context.sampleRate * 7, context.sampleRate); for (let c = 0; c < 2; c++) { let d = b.getChannelData(c); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length, 2.35); } return b; }
function sceneConfig() {
  const scene = scenes[$('scene-style').value], time = timeConfig();
  return { ...scene, speed: scene.speed * time.speed * performance.speed, brightness: scene.brightness * time.brightness * performance.brightness,
    wet: Math.max(.05, Math.min(.95, scene.wet + time.wet)), chordChance: Math.min(.8, scene.chordChance * time.chords) };
}
function getScale() { const root = roots[$('root').value]; return modes[$('mode').value].map(x => root + x); }
function updateNowPlaying() { $('now-playing').textContent = `${$('root').value} ${$('mode').value} · ${$('scene-style').selectedOptions[0].textContent} · ${timeConfig().label}`; }
let visualFrame, visualHash;
function drawAbstract(hash) {
  const canvas = $('art-canvas'), bounds = canvas.getBoundingClientRect(), scale = window.devicePixelRatio || 1;
  const widthPx = Math.max(1, Math.floor(bounds.width * scale)), heightPx = Math.max(1, Math.floor(bounds.height * scale));
  if (visualHash === hash && canvas.width === widthPx && canvas.height === heightPx) return;
  const previous = document.createElement('canvas'), next = document.createElement('canvas');
  previous.width = next.width = widthPx; previous.height = next.height = heightPx;
  // 連続操作でも、いま見えている混合画像から次の景色につなぐ。
  if (visualHash !== undefined) previous.getContext('2d').drawImage(canvas, 0, 0, widthPx, heightPx);
  const initialized = visualHash !== undefined; visualHash = hash;
  if (visualFrame) window.cancelAnimationFrame(visualFrame);
  canvas.width = widthPx; canvas.height = heightPx;
  const ctx = next.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  let state = hash || 1; const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const hue = hash % 360, alt = (hash >>> 7) % 360, width = bounds.width, height = bounds.height;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, `hsl(${hue} 12% 52%)`); background.addColorStop(1, `hsl(${alt} 14% 70%)`);
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); ctx.filter = 'blur(11px)';
  for (let i = 0; i < 12; i++) {
    const color = i % 3 === 0 ? hue : i % 3 === 1 ? alt : (hue + alt) / 2;
    ctx.fillStyle = `hsla(${color}, ${16 + random() * 30}%, ${32 + random() * 40}%, ${.22 + random() * .22})`;
    ctx.fillRect(-width * .1 + random() * width * .25, random() * height, width * (.56 + random() * .72), 16 + random() * height * .34);
  }
  ctx.filter = 'none'; ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 18; i++) {
    const color = i % 2 ? hue : alt, y = random() * height, thickness = 6 + random() * 34;
    ctx.strokeStyle = `hsla(${color}, ${18 + random() * 34}%, ${52 + random() * 28}%, ${.13 + random() * .25})`;
    ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(-20, y); ctx.bezierCurveTo(width * .28, y + (random() - .5) * 28, width * .7, y + (random() - .5) * 42, width + 30, y + (random() - .5) * 20); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 11; i++) {
    const color = i % 2 ? hue : alt;
    ctx.fillStyle = `hsla(${color}, ${12 + random() * 24}%, ${26 + random() * 26}%, ${.12 + random() * .23})`;
    ctx.fillRect(random() * width, random() * height, 18 + random() * width * .24, 4 + random() * height * .16);
  }
  ctx.globalCompositeOperation = 'source-over';
  const display = canvas.getContext('2d');
  if (!initialized || !window.requestAnimationFrame || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    display.drawImage(next, 0, 0); return;
  }
  let started;
  const frame = timestamp => {
    started ??= timestamp;
    const progress = Math.min(1, (timestamp - started) / 4000);
    display.globalAlpha = 1; display.drawImage(previous, 0, 0);
    display.globalAlpha = progress * progress * (3 - 2 * progress); display.drawImage(next, 0, 0); display.globalAlpha = 1;
    visualFrame = progress < 1 ? window.requestAnimationFrame(frame) : undefined;
  };
  display.drawImage(previous, 0, 0); visualFrame = window.requestAnimationFrame(frame);
}
function updateVisual() {
  const names = { pluck: 'サイン・プラック', piano: 'ピアノ', strings: '弦楽器', flute: 'フルート', harp: 'ハープ', bowl: 'シンギングボウル', epiano: 'エレクトリックピアノ', kalimba: 'カリンバ', drone: 'ドローン', haze: '霧のパッド', shimmer: 'シンセベル', tape: 'テープ・ノイズ', rain: '雨', wind: '風', ocean: '海', stream: '小川', birds: '鳥', fireplace: '暖炉' };
  $('scene-description').textContent = layerIds.filter(selected).map(id => names[id]).join(' · ') || '音のレイヤーを選んでください';
  const seed = `${$('root').value}-${$('mode').value}-${$('scene-style').value}-${$('pace').value}-${harmonyRevision}`;
  const hash = [...seed].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 17);
  drawAbstract(hash);
}
function randomizeLandscape() {
  const previousScale = getScale().map(MusicTheory.pc);
  const candidates = Object.keys(scenes).filter(id => id !== $('scene-style').value);
  $('scene-style').value = MusicTheory.weighted(candidates, id => {
    const scene = scenes[id], scale = modes[scene.mode].map(note => MusicTheory.pc(note + roots[scene.root]));
    const common = scale.filter(note => previousScale.includes(note)).length;
    const sharedLayers = scene.layers.filter(layer => selected(layer)).length;
    return (1 + common ** 3) * (1 + sharedLayers * .25) * MusicTheory.tension(roots[scene.root], roots[$('root').value]);
  });
  applyScene({ smooth: true });
}
function randomizeLayers(update = true, automatic = false) {
  const recipe = automatic ? Arrangement.choose($('scene-style').value, layerIds.filter(selected)) : sceneConfig().layers;
  layerIds.forEach(name => { $(name).checked = recipe.includes(name); });
  if (update) updateAmbience();
}
function applyScene({ smooth = false } = {}) {
  const previousHarmony = harmony, previousVoices = new Map(voices), previousNotes = soundingNotes;
  const config = sceneConfig();
  $('root').value = config.root; $('mode').value = config.mode; $('pace').value = config.pace; harmonyRevision = 0;
  resetHarmony();
  if (smooth) harmony = MusicTheory.nextChord(getScale(), previousHarmony);
  randomizeLayers(!isPlaying, smooth); updatePaceOutput(); updateVisual();
  if (isPlaying) {
    restartArrangement(smooth ? 14 : 2);
    if (smooth) {
      previousVoices.forEach((voice, name) => voices.set(name, voice));
      soundingNotes.push(...previousNotes.map(note => ({ ...note, until: Math.min(note.until, context.currentTime + 14) })));
    }
    updateNowPlaying();
  }
}
function noteMidi(octave, voiceName = 'piano', duration = 8) {
  const scale = getScale(), now = context.currentTime;
  if (!voices.has(voiceName)) voices.set(voiceName, { motif: [0, pick([-1, 1]), pick([0, 2]), pick([-1, 0, 1])], position: 0 });
  const voice = voices.get(voiceName), step = voice.motif[voice.position++ % voice.motif.length];
  const degree = ((performance.degree + step) % scale.length + scale.length) % scale.length;
  let target = 12 * (octave + 1 + sceneConfig().register) + scale[degree];
  if (phraseEvent) {
    const notes = MusicTheory.scaleNotes(scale, 36, 108);
    if (phraseEvent.phrase.anchor === undefined) {
      const anchor = voice.last ?? target;
      phraseEvent.phrase.anchor = notes.reduce((best, note, index) => Math.abs(note - anchor) < Math.abs(notes[best] - anchor) ? index : best, 0);
    }
    target = notes[MusicTheory.clamp(phraseEvent.phrase.anchor + phraseEvent.step, 0, notes.length - 1)];
  }
  soundingNotes = soundingNotes.filter(note => note.until > now);
  const ranges = { pluck: [55, 79], shimmer: [72, 96], epiano: [48, 76], flute: [60, 88], bowl: [51, 57], kalimba: [60, 76] };
  const [low, high] = ranges[voiceName] || [48, 88];
  const midi = MusicTheory.melody({ scale, chord: harmony, target, previous: voice.last, sounding: soundingNotes.map(note => note.midi), low, high, playable: note => !acousticBanks[voiceName] || acousticBanks[voiceName].some(sample => Math.abs(sample.midi - note) <= 3) });
  voice.last = midi; soundingNotes.push({ midi, until: now + duration + 3 });
  return midi;
}
function tone(type, midi, duration, volume, attack = .7, detune = 0, offset = 0, sustain = false) {
  if (phraseEvent) { volume *= phraseEvent.level; duration = Math.min(duration, 6); }
  const t = context.currentTime + offset, osc = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter();
  osc.type = type; osc.frequency.value = midiToHz(midi); osc.detune.value = detune; filter.type = 'lowpass'; filter.frequency.value = (type === 'sawtooth' ? 1050 : 3800) * sceneConfig().brightness;
  gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  if (sustain) gain.gain.linearRampToValueAtTime(volume * .85, t + duration - 8);
  gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
  osc.connect(filter).connect(gain).connect(master); osc.start(t); osc.stop(t + duration + .1); track(osc, gain, filter);
}
function piano() {
  if (!selected('piano')) return;
  const duration = rand(8, 12), midi = noteMidi(Math.random() < timeConfig().upper ? 4 : 3, 'piano', duration);
  sampledTone(acousticBanks.piano, midi, duration, .24);
  if (!phraseEvent && Math.random() < sceneConfig().chordChance) {
    const companion = noteMidi(4, 'piano', duration);
    sampledTone(acousticBanks.piano, companion, duration, .12, .008, rand(.04, .12));
  }
}

function strings() {
  if (!selected('strings')) return;
  harmony.slice(0, 2).forEach((note, index) => {
    const candidates = MusicTheory.scaleNotes(getScale(), 55, 84).filter(value => MusicTheory.pc(value) === MusicTheory.pc(note) && acousticBanks.strings.some(sample => Math.abs(sample.midi - value) <= 3));
    const midi = candidates.reduce((best, value) => Math.abs(value - note) < Math.abs(best - note) ? value : best, candidates[0]);
    if (midi === undefined) return;
    soundingNotes.push({ midi, until: context.currentTime + 15 });
    sampledTone(acousticBanks.strings, midi, rand(10, 14), .055 - index * .014, .12, index * .23);
  });
}

function drone() {
  if (!selected('drone')) return;
  const root = getScale()[0] + 36 + Math.min(0, sceneConfig().register) * 12, duration = 50;
  tone('sawtooth', root, duration, .026, 5, -3, 0, true);
  tone('sawtooth', root, duration, .024, 5, 3, 0, true);
  tone('sine', root + 7, duration, .035, 5, 0, 0, true);
}
function flute() {
  if (!selected('flute')) return;
  const duration = rand(5, 9), midi = noteMidi(Math.random() < timeConfig().upper ? 5 : 4, 'flute', duration);
  sampledTone(acousticBanks.flute, midi, duration, .12, .035);
}

function raindrop() { if (!isPlaying || !selected('rain')) return; const t=context.currentTime, source=context.createBufferSource(), g=context.createGain(), f=context.createBiquadFilter(); source.buffer=noiseBuffer(.08); f.type='bandpass';f.frequency.value=rand(1800,5200);f.Q.value=4;g.gain.setValueAtTime(rand(.006,.022),t);g.gain.exponentialRampToValueAtTime(.0001,t+.07);source.connect(f).connect(g).connect(master);source.start(t);source.stop(t+.1);track(source,g,f); }
function shimmer() {
  if (!selected('shimmer')) return;
  const midi = noteMidi(Math.random() < timeConfig().upper ? 6 : 5, 'shimmer', 11), duration = rand(5, 11), t = context.currentTime;
  [1, 2.76, 4.18].forEach((ratio, index) => { const osc=context.createOscillator(), gain=context.createGain(); osc.type='sine'; osc.frequency.value=midiToHz(midi) * ratio; gain.gain.setValueAtTime(.0001,t); gain.gain.linearRampToValueAtTime(.012/(index+1),t+.03); gain.gain.exponentialRampToValueAtTime(.0001,t+duration); osc.connect(gain).connect(master); osc.start(t); osc.stop(t+duration+.1); track(osc,gain); });
}
function bowl() {
  if (!selected('bowl')) return;
  const duration = rand(16, 23), midi = noteMidi(3, 'bowl', duration);
  sampledTone(acousticBanks.bowl, midi, duration, .09, .015);
}

function harp() {
  if (!selected('harp')) return;
  if (phraseEvent) { sampledTone(acousticBanks.harp, noteMidi(4, 'harp', 6), 6, .17); return; }
  const duration = rand(7, 11), first = noteMidi(4, 'harp', duration), second = noteMidi(5, 'harp', duration);
  sampledTone(acousticBanks.harp, first, duration, .17);
  sampledTone(acousticBanks.harp, second, duration, .1, .008, rand(.45, .95));
}

function haze() {
  if (!selected('haze')) return;
  const duration = 44;
  harmony.forEach((midi, index) => { soundingNotes.push({ midi, until: context.currentTime + duration + 3 }); tone(index === 1 ? 'triangle' : 'sine', midi, duration, .023 - index * .004, 6, rand(-4, 4), 0, true); });
}
function pluck() {
  if (!selected('pluck')) return;
  if (!performers.has('pluck')) performers.set('pluck', MusicTheory.performer());
  const gesture = performers.get('pluck')();
  const duration = rand(3.5, 5.5) * gesture.length;
  const midi = noteMidi(4, 'pluck', duration);
  tone('sine', midi, duration, .075 * gesture.level, .018 * gesture.attack, 0, gesture.delay);
  tone('sine', midi + 12, .65, .012 * gesture.level, .012, 0, gesture.delay);
}

function epiano() {
  if (!selected('epiano')) return;
  const duration = rand(7, 11), midi = noteMidi(4, 'epiano', duration);
  sampledTone(acousticBanks.epiano, midi, duration, .2);
}


function kalimba() {
  if (!selected('kalimba')) return;
  const duration = rand(4, 7), midi = noteMidi(5, 'kalimba', duration);
  sampledTone(acousticBanks.kalimba, midi, duration, .14, .004);
}

function evolveHarmony() {
  if (!selected('auto-random')) return;
  if (Math.random() < .38) { randomizeLandscape(); return; }
  harmony = MusicTheory.nextChord(getScale(), harmony); harmonyRevision++;
  updateVisual();
  // 同じ景色の和声変化では編成を維持し、曲の途中で楽器を抜き差ししない。
  if (isPlaying) updateNowPlaying();
}
function createAmbience() {
  ambience = {};
  [['rain', .075, 'lowpass', 6200], ['wind', .065, 'lowpass', 1200], ['ocean', .06, 'lowpass', 4000], ['stream', .05, 'lowpass', 3200], ['birds', .022, 'highpass', 1500], ['fireplace', .045, 'lowpass', 2200]].forEach(([name, level, type, frequency]) => {
    if (sampleBuffers[name]) ambience[name] = { ...ambienceLoop(name, selected(name) ? level : .0001, type, frequency), level };
  });
  const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter(); source.buffer = noiseBuffer(4); source.loop = true; filter.type = 'bandpass'; filter.frequency.value = 1900; filter.Q.value = .45; gain.gain.value = selected('tape') ? .012 : .0001; source.connect(filter).connect(gain).connect(master); source.start(); track(source, gain, filter); ambience.tape = { source, gain, level: .012 };
}
let arrangementVersion = 0;
function phrasePlayer(name, play, mean) {
  let current = null, position = 0, previous = null, started = 0;
  return () => {
    const now = context.currentTime;
    if (!selected(name)) {
      current = null;
      if (foreground?.name === name) foreground = null;
      return undefined;
    }
    if (foreground && foreground.name !== name && foreground.until > now) return rand(3.1, 6.7);
    if (!current) {
      const response = phraseMemory && phraseMemory.name !== name && now - phraseMemory.at < 45 && Math.random() < .55;
      current = Arrangement.phrase(response ? phraseMemory.phrase : previous, !!response);
      position = 0; started = now;
    }
    // 応答を強制せず、持続音の上で一つの断片にだけ前景を譲る。
    phraseEvent = { phrase: current, step: current.steps[position], level: current.levels[position] };
    try { play(); } finally { phraseEvent = null; }
    position++;
    if (position < current.steps.length) {
      const gap = current.gaps[position - 1] * MusicTheory.clamp(sceneConfig().speed, .85, 1.6);
      foreground = { name, until: now + gap + 1 };
      return gap;
    }
    previous = current; phraseMemory = { name, phrase: current, at: now };
    foreground = { name, until: now + rand(4, 8) };
    // フレーズ内の発音を増やした分だけ休み、平均密度を元の予算内に収める。
    const budget = mean();
    const rest = Math.max(12, current.steps.length * Math.max(budget, MusicTheory.eventDelay(budget)) - (now - started));
    current = null;
    return rest * rand(1, 1.3);
  };
}
function schedule(fn, range, immediate = true, stochastic = false) {
  const version = arrangementVersion;
  const queue = initialDelay => {
    const [low, high] = range();
    const delay = initialDelay ?? (stochastic ? MusicTheory.eventDelay((low + high) / 2) : rand(low, high));
    const id = setTimeout(() => { timers = timers.filter(timer => timer !== id); run(); }, delay * 1000);
    timers.push(id);
  };
  const run = () => { if (!isPlaying || version !== arrangementVersion) return; const delay = fn(); if (version === arrangementVersion) queue(typeof delay === 'number' ? delay : undefined); };
  if (typeof immediate === 'number') queue(immediate); else if (immediate) run(); else queue();
}
function startArrangement() {
  const interval = (low, high) => () => {
    const spacing = Math.max(1, melodicLayerIds.filter(selected).length / 3);
    const mean = MusicTheory.clamp((low + high) / 2 * sceneConfig().speed / Math.sqrt(+$('pace').value), 10, 60) * spacing;
    return [mean, mean];
  };
  createAmbience();
  schedule(drone, () => [40.1, 41.7]); schedule(strings, () => [12.1, 16.3], 1.1); schedule(haze, () => [33.3, 34.9], 2.3);
  const melodic = (name, play, low, high, initial) => {
    const range = interval(low, high);
    const perform = phrasePlayer(name, play, () => range()[0]);
    schedule(perform, range, initial, true);
  };
  melodic('piano', piano, 8, 16, .6); melodic('flute', flute, 15, 29, 2.1); melodic('harp', harp, 10, 20, 3.7); schedule(bowl, interval(24, 43), 5.2, true);
  schedule(shimmer, () => interval(...sceneConfig().shimmer)(), 6.9, true);
  melodic('pluck', pluck, 14, 26, 4.9);
  melodic('epiano', epiano, 12, 22, 1.7); melodic('kalimba', kalimba, 18, 30, 6.1);
  schedule(evolveHarmony, () => [50, 100], false); schedule(raindrop, () => [.24, .95]);
  schedule(refreshTime, () => [30, 30], false);
  schedule(varyPerformance, () => [180, 300], false);
}
function retireArrangement(closeContext = false, fadeSeconds = 2) {
  arrangementVersion++; timers.forEach(clearTimeout); timers = [];
  foreground = null; phraseMemory = null; phraseEvent = null;
  const oldMaster = master, oldNodes = nodes, oldContext = context;
  nodes = []; ambience = null; soundingNotes = []; voices.clear();
  const retiring = { master: oldMaster, nodes: oldNodes, context: oldContext };
  retiringArrangements.add(retiring);
  const fading = closeContext || fadeSeconds <= 2 ? [...retiringArrangements].filter(item => item.context === oldContext) : [retiring];
  fading.forEach(item => {
    clearTimeout(item.cleanup);
    const gain = item.master.gain, level = gain.value;
    gain.cancelScheduledValues(oldContext.currentTime); gain.setValueAtTime(level, oldContext.currentTime);
    gain.linearRampToValueAtTime(0, oldContext.currentTime + fadeSeconds);
    // 前の演奏だけを解放し、途中で停止したときは全フェードの期限も短縮する。
    item.cleanup = setTimeout(() => {
      item.nodes.forEach(node => { try { node.stop?.(); } catch {} node.disconnect(); });
      item.master.disconnect(); retiringArrangements.delete(item);
      if (closeContext && item === retiring) oldContext.close();
    }, (fadeSeconds + .1) * 1000);
  });
}
function restartArrangement(fadeSeconds = 2) {
  retireArrangement(false, fadeSeconds);
  master = context.createGain(); master.gain.value = 0; master.connect(output);
  master.gain.setValueAtTime(0, context.currentTime); master.gain.linearRampToValueAtTime(1, context.currentTime + fadeSeconds);
  updateSpace(fadeSeconds);
  startArrangement();
}
function updateAmbience() { if(!ambience || !context)return; Object.entries(ambience).forEach(([name, layer]) => layer.gain.gain.setTargetAtTime(selected(name) ? layer.level : .0001, context.currentTime, .5)); }
async function start() {
  if (isLoading) return; isLoading = true; $('play-label').textContent = '読み込み中'; $('play-button').disabled = true;
  varyPerformance(); resetHarmony(); refreshTime();
  if(!context)makeAudio(); await context.resume(); await loadSamples(); isPlaying=true; isLoading = false; $('play-button').disabled = false;
  master.gain.setValueAtTime(.0001, context.currentTime); master.gain.exponentialRampToValueAtTime(1, context.currentTime + 3);
  $('play-button').classList.add('playing');$('play-label').textContent='とめる';$('status-dot').parentElement.classList.add('playing');$('status-text').textContent='生成中';updateNowPlaying();startArrangement();
}
function stop() { isPlaying=false; retireArrangement(true); context=null; master=null; $('play-button').classList.remove('playing');$('play-label').textContent='はじめる';$('status-dot').parentElement.classList.remove('playing');$('status-text').textContent='待機中';$('now-playing').textContent='音が始まるのを待っています'; }
$('play-button').addEventListener('click',()=>isPlaying?stop():start());
const disableAutoRandom = () => { $('auto-random').checked = false; };
const updatePaceOutput = () => { $('pace-output').textContent = ['静寂','穏やか','漂流'][$('pace').value - 1]; };
const melodicLayerIds = ['piano','flute','harp','shimmer','bowl','epiano','kalimba','pluck'];
const layerIds = ['piano','strings','drone','flute','harp','rain','wind','ocean','stream','birds','fireplace','shimmer','bowl','haze','tape','epiano','kalimba','pluck'];
layerIds.forEach(id=>$(id).addEventListener('change', () => { disableAutoRandom(); updateAmbience(); updateVisual(); }));
$('pace').addEventListener('input',()=>{disableAutoRandom(); updatePaceOutput(); updateVisual();});
$('volume').addEventListener('input', e => { $('volume-output').textContent = `${e.target.value}%`; if (volumeGain && context) volumeGain.gain.setTargetAtTime(masterLevel(), context.currentTime, .18); });
$('scene-style').addEventListener('change', () => { disableAutoRandom(); applyScene(); });
$('time-style').addEventListener('change', refreshTime);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTime(); });
['root','mode'].forEach(id => $(id).addEventListener('change', () => { disableAutoRandom(); resetHarmony(); updateVisual(); if (isPlaying) { restartArrangement(); updateNowPlaying(); } }));
Object.entries(scenes).forEach(([id, config]) => { const option = document.createElement('option'); option.value = id; option.textContent = config.label; $('scene-style').append(option); });
applyScene();
refreshTime();
window.addEventListener('resize', updateVisual);
