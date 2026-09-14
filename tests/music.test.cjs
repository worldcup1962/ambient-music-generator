const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const theory = require('../music-theory.js');
const arrangement = require('../arrangement.js');
const root = path.resolve(__dirname, '..');
test('human gestures stay subtle and bounded through prolonged playing', () => {
  const gesture = theory.performer(random());
  let previous = 1;
  const levels = new Set();
  for (let i = 0; i < 10000; i++) {
    const value = gesture();
    assert(value.delay >= .007 && value.delay <= .055);
    assert(value.level >= .855 && value.level <= 1.145);
    assert(Math.abs(value.level - previous) < .1);
    assert(value.length >= .965 && value.length <= 1.035);
    assert(value.attack >= .88 && value.attack <= 1.12);
    levels.add(value.level); previous = value.level;
  }
  assert(levels.size > 1000);
});
function random(seed = 19) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function harness() {
  const elements = new Map(), handlers = new Map(), tasks = new Map();
  let now = 0, serial = 0;
  const setTimeout = (fn, ms) => { tasks.set(++serial, { fn, at: now + ms / 1000 }); return serial; };
  const drawing = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: id === 'time-style' ? 'off' : id === 'volume' ? '100' : id === 'scene-style' ? '' : '1',
      checked: false, options: [], style: { setProperty() {} }, classList: { add() {}, remove() {} }, parentElement: { classList: { add() {}, remove() {} } },
      addEventListener(event, fn) { handlers.set(`${id}:${event}`, fn); },
      append(option) { this.options.push(option); if (!this.value) this.value = option.value; },
      get selectedOptions() { return this.options.filter(option => option.value === this.value); },
      getBoundingClientRect() { return { width: 800, height: 260 }; }, getContext() { return drawing; }
    });
    return elements.get(id);
  }
  const param = () => ({ value: 0, events: [], setValueAtTime(value, at) { assert(Number.isFinite(value)); this.events.push({ type: 'set', value, at }); }, linearRampToValueAtTime(value, at) { assert(Number.isFinite(value)); this.events.push({ type: 'linear', value, at }); }, exponentialRampToValueAtTime(value) { assert(value > 0 && Number.isFinite(value)); }, setTargetAtTime(value) { assert(Number.isFinite(value)); this.events.push({ type: 'target', value }); }, cancelScheduledValues() {} });
  class AudioContext {
    constructor() { this.origin = now; this.sampleRate = 10; this.destination = this.node(); }
    get currentTime() { return now - this.origin; }
    node(source = false) {
      const result = { gain: param(), frequency: param(), Q: param(), detune: param(), playbackRate: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), delayTime: param(), connect(target) { return target; }, disconnect() {} };
      if (source) {
        let endTask, ended;
        result.start = () => {};
        result.addEventListener = (name, fn) => { if (name === 'ended') ended = fn; };
        result.stop = (at = this.currentTime) => { tasks.delete(endTask); endTask = setTimeout(() => ended?.(), Math.max(0, at - this.currentTime) * 1000); };
      }
      return result;
    }
    createGain() { return this.node(); } createConvolver() { return this.node(); } createDynamicsCompressor() { return this.node(); }
    createDelay() { return this.node(); } createBiquadFilter() { return this.node(); }
    createOscillator() { const node = this.node(true); node.instrumentKind = 'oscillator'; return node; } createBufferSource() { const node = this.node(true); node.instrumentKind = 'recording'; return node; }
    createBuffer(channels, length) { return { getChannelData() { return new Float32Array(length); } }; }
    resume() {} close() { this.closed = true; } async decodeAudioData() { return { duration: 30 }; }
  }
  const math = Object.create(Math); math.random = random();
  const sandbox = { console, Math: math, window: { AudioContext, devicePixelRatio: 1, addEventListener() {} }, document: { getElementById: element, querySelector: () => element('scene'), createElement: tag => tag === 'canvas' ? { getContext: () => drawing } : ({}), addEventListener() {} }, setTimeout, clearTimeout: id => tasks.delete(id), fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) };
  vm.createContext(sandbox);
  const run = source => vm.runInContext(source, sandbox);
  for (const file of ['acoustic-bank.js', 'arrangement.js', 'music-theory.js']) run(fs.readFileSync(path.join(root, file), 'utf8'));
  run(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  function advance(seconds) {
    const end = now + seconds;
    for (;;) {
      const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; tasks.delete(next[0]); next[1].fn();
    }
    now = end;
  }
  return { run, element, handlers, advance };
}

test('all supported scales keep chord changes and melodies in key', () => {
  const h = harness(), rng = random();
  const modes = h.run('Object.values(modes)');
  for (let root = 0; root < 12; root++) for (const mode of modes) {
    const scale = mode.map(note => root + note); let chord = [], previous;
    for (let i = 0; i < 100; i++) {
      const next = theory.nextChord(scale, chord, rng);
      assert.notDeepEqual(next, chord);
      assert(next.every(note => scale.some(value => theory.pc(value) === theory.pc(note))));
      assert(next.every((note, index) => !index || note > next[index - 1]));
      chord = next;
      previous = theory.melody({ scale, chord, target: 72, previous }, rng);
      assert(previous >= 48 && previous <= 96);
      assert(scale.some(note => theory.pc(note) === theory.pc(previous)));
    }
  }
});
test('melody favors connected movement and reduces exposed dissonance', () => {
  const rng = random(), scale = [0, 2, 4, 6, 7, 9, 11], chord = [48, 55, 64];
  let largeLeaps = 0, tritones = 0;
  for (let i = 0; i < 10000; i++) {
    const note = theory.melody({ scale, chord, target: 66, previous: 64, sounding: [60] }, rng);
    if (Math.abs(note - 64) > 7) largeLeaps++;
    if (theory.pc(note) === 6) tritones++;
  }
  assert(largeLeaps < 500); assert(tritones < 700);
  assert(theory.tension(60, 61) < theory.tension(60, 73));
});
test('event intervals prevent bursts even at maximum scene density', () => {
  const rng = random();
  for (const mean of [10, 30, 60]) {
    const delays = Array.from({ length: 10000 }, () => theory.eventDelay(mean, rng));
    assert(delays.every(delay => Number.isFinite(delay) && delay >= 7.5 && delay <= mean * 3));
    assert(new Set(delays).size > 1000);
  }
});
test('ten scenes, key changes, and rapid restart keep one scheduler', async () => {
  const h = harness(); await h.run('start()');
  for (const id of h.run('Object.keys(scenes)')) {
    h.element('scene-style').value = id; h.handlers.get('scene-style:change')(); h.advance(10);
    assert.equal(h.run('timers.length'), 15);
    assert(h.run('harmony.every(note => getScale().some(value => MusicTheory.pc(value) === MusicTheory.pc(note)))'));
  }
  h.element('root').value = 'D'; h.element('mode').value = 'phrygian'; h.handlers.get('mode:change')();
  assert(h.run('harmony.every(note => MusicTheory.pc(note) !== 4)'));
  h.element('auto-random').checked = true;
  h.run('Math.random = () => .5; evolveHarmony()'); assert.equal(h.element('root').value, 'D');
  h.run('Math.random = () => .1; evolveHarmony()'); assert.equal(h.run('timers.length'), 15);
  const old = h.run('context'); h.run('stop()'); await h.run('start()'); const fresh = h.run('context');
  h.advance(6); assert(old.closed); assert(!fresh.closed); assert.equal(h.run('timers.length'), 15);
  h.run('stop()'); h.advance(6); assert.equal(h.run('nodes.length'), 0); assert.equal(h.run('timers.length'), 0);
});
test('sustained-only playback releases ended nodes and stale note history', async () => {
  const h = harness(); h.element('scene-style').value = 'tide'; h.handlers.get('scene-style:change')(); await h.run('start()');
  h.advance(3600);
  assert(h.run('nodes.length') < 150); assert(h.run('soundingNotes.length') < 30); assert.equal(h.run('timers.length'), 15);
  h.run('stop()'); h.advance(6); assert.equal(h.run('nodes.length'), 0);
});

test('automatic transitions preserve phrases and crossfade for fourteen seconds', async () => {
  const h = harness(); await h.run('start()'); h.advance(10);
  const oldMaster = h.run('master'), oldAmbience = h.run('ambience.stream.gain.gain');
  const oldEvents = oldAmbience.events.length;
  const phrase = h.run('voices.get("piano")');
  h.element('auto-random').checked = true; h.run('randomizeLandscape()');
  assert.equal(h.run('voices.get("piano")'), phrase);
  assert.equal(oldAmbience.events.length, oldEvents);
  assert.deepEqual(oldMaster.gain.events.at(-1), { type: 'linear', value: 0, at: 24 });
  const incoming = h.run('master');
  assert.deepEqual(incoming.gain.events.at(-1), { type: 'linear', value: 1, at: 24 });
  assert.equal(h.run('timers.length'), 15);
  h.element('volume').value = '0'; h.handlers.get('volume:input')({ target: h.element('volume') });
  assert.equal(h.run('volumeGain.gain.events.at(-1).value'), 0);
  assert.equal(incoming.gain.events.at(-1).type, 'linear');
  h.advance(10); assert.equal(h.run('retiringArrangements.size'), 1);
  h.advance(5); assert.equal(h.run('retiringArrangements.size'), 0);
  h.run('stop()'); h.advance(3);
});

test('stopping or manually changing a scene cancels an unfinished long fade', async () => {
  const h = harness(); await h.run('start()'); h.advance(10); h.run('randomizeLandscape()');
  h.element('scene-style').value = 'ember'; h.handlers.get('scene-style:change')();
  h.advance(3); assert.equal(h.run('retiringArrangements.size'), 0);
  h.run('randomizeLandscape()'); const old = h.run('context');
  h.run('stop()'); await h.run('start()'); const fresh = h.run('context');
  h.advance(3); assert(old.closed); assert(!fresh.closed);
  assert.equal(h.run('retiringArrangements.size'), 0); assert.equal(h.run('timers.length'), 15);
  h.run('stop()'); h.advance(3);
});

test('new instruments respect selection, their register, and the current scale', async () => {
  const h = harness(); await h.run('start()');
  h.run('layerIds.forEach(id => $(id).checked = false)');
  for (const [id, low, high] of [['pluck', 55, 79], ['epiano', 48, 76], ['kalimba', 60, 76]]) {
    const count = h.run('nodes.length'); h.run(`${id}()`); assert.equal(h.run('nodes.length'), count);
    h.element(id).checked = true;
    for (let i = 0; i < 20; i++) {
      h.run(`${id}()`);
      const note = h.run(`voices.get('${id}').last`);
      assert(note >= low && note <= high);
      assert(h.run(`getScale().some(value => MusicTheory.pc(value) === MusicTheory.pc(${note}))`));
    }
    assert(h.run('nodes.length') > count); h.element(id).checked = false; h.advance(10);
  }
  h.run('stop()'); h.advance(3); assert.equal(h.run('nodes.length'), 0);
});

test('selecting more instruments widens event spacing and keeps playback bounded', async () => {
  async function runMix(all) {
    const h = harness();
    h.run(`layerIds.forEach(id => $(id).checked = ${all}); $('piano').checked = true;
      const observedMeans = [], originalPlayer = phrasePlayer;
      phrasePlayer = (name, play, mean) => { observedMeans.push(mean()); return originalPlayer(name, play, mean); };`);
    await h.run('start()'); h.advance(7);
    const means = h.run('observedMeans.slice()');
    if (all) { h.advance(3600); assert(h.run('nodes.length') < 500); assert(h.run('soundingNotes.length') < 60); }
    h.run('stop()'); h.advance(3); assert.equal(h.run('nodes.length'), 0);
    return means;
  }
  const sparse = await runMix(false), full = await runMix(true);
  assert.equal(sparse.length, 6); assert.equal(full.length, 6);
  assert(Math.min(...full) > Math.min(...sparse) * 2);
});

test('automatic recipes leave space, keep environments optional, and omit marimba', () => {
  const rng = random();
  for (const scene of Object.keys(arrangement.recipes)) {
    let dry = 0, previous = [];
    for (let i = 0; i < 1000; i++) {
      const layers = arrangement.choose(scene, previous, rng); previous = layers;
      assert(layers.length <= 5); assert.equal(new Set(layers).size, layers.length);
      assert(!layers.includes('marimba'));
      assert(!(layers.includes('piano') && layers.includes('epiano')));
      assert(layers.filter(id => ['drone', 'haze'].includes(id)).length <= 1);
      const environmental = layers.filter(id => Object.values(arrangement.environments).flat().includes(id));
      assert(environmental.length <= 1); if (!environmental.length) dry++;
      const instruments = layers.filter(id => ['piano', 'strings', 'flute', 'harp', 'bowl', 'kalimba', 'epiano', 'pluck', 'shimmer'].includes(id));
      assert(instruments.length >= 2 && instruments.length <= 3);
    }
    assert(dry > 250);
  }
});

test('recorded instruments cover every mode without synthetic fallback or extreme transposition', async () => {
  const h = harness(); await h.run('start()');
  h.run('layerIds.forEach(id => $(id).checked = false)');
  for (const id of h.run('Object.keys(acousticBanks)')) {
    h.element(id).checked = true;
    for (const root of h.run('Object.keys(roots)')) for (const mode of h.run('Object.keys(modes)')) {
      h.element('root').value = root; h.element('mode').value = mode;
      h.run('resetHarmony()');
      const before = h.run('nodes.length'); h.run(`${id}()`);
      const added = h.run(`nodes.slice(${before})`);
      assert(added.some(node => node.instrumentKind === 'recording'), `${id} ${root} ${mode}`);
      assert(!added.some(node => node.instrumentKind === 'oscillator'));
      for (const node of added.filter(node => node.instrumentKind === 'recording')) {
        assert(Math.abs(12 * Math.log2(node.playbackRate.value)) <= 3.5);
      }
      h.advance(30);
    }
    h.element(id).checked = false;
  }
  const before = h.run('nodes.length');
  assert.equal(h.run('sampledTone([{name:"missing", midi:60}],60,5,.1)'), false);
  assert.equal(h.run('nodes.length'), before);
  h.run('stop()'); h.advance(3);
});

test('within-scene harmony changes preserve the current orchestration', async () => {
  const h = harness(); await h.run('start()');
  h.element('auto-random').checked = true;
  const before = h.run('layerIds.filter(selected).join()');
  h.run('Math.random = () => .9; evolveHarmony()');
  assert.equal(h.run('layerIds.filter(selected).join()'), before);
  h.run('stop()'); h.advance(3);
});

test('fragments vary in contour and timing while responses retain the source shape', () => {
  const rng = random(), shapes = new Set(), rhythms = new Set();
  let previous;
  for (let i = 0; i < 1000; i++) {
    const phrase = arrangement.phrase(previous, false, rng);
    assert(phrase.steps.length >= 2 && phrase.steps.length <= 4);
    assert.equal(phrase.steps[0], 0);
    assert(phrase.steps.every(step => Math.abs(step) <= 3));
    assert(phrase.gaps.every(gap => gap >= 3.2 && gap <= 6));
    assert(phrase.levels.every(level => level > .6 && level <= .88));
    shapes.add(phrase.steps.join()); rhythms.add(phrase.gaps.join()); previous = phrase;
  }
  assert(shapes.size > 20); assert(rhythms.size > 900);
  const source = { steps: [0, 1, 2] };
  const answer = arrangement.phrase(source, true, () => .1);
  assert.deepEqual(answer.steps, [0, -1, -2]);
  assert(answer.levels[0] < .88);
  assert.deepEqual(source.steps, [0, 1, 2]);
});

test('foreground phrases yield to a quieter response and release deselected voices', async () => {
  const h = harness(); await h.run('start()');
  h.run(`timers.forEach(clearTimeout); timers = [];
    $('piano').checked = true; $('flute').checked = true; Math.random = () => .1;
    const calls = [];
    const lead = phrasePlayer('piano', () => calls.push({ name: 'piano', step: phraseEvent.step, level: phraseEvent.level }), () => 15);
    const answer = phrasePlayer('flute', () => calls.push({ name: 'flute', step: phraseEvent.step, level: phraseEvent.level }), () => 15);`);
  const gap = h.run('lead()');
  h.run('answer()'); assert.equal(h.run('calls.length'), 1);
  h.advance(gap); const rest = h.run('lead()');
  assert(rest >= 30 - gap);
  h.advance(9); h.run('answer()');
  assert.equal(h.run('calls.at(-1).name'), 'flute');
  assert(h.run('calls.at(-1).level < calls[0].level'));
  h.run("$('flute').checked = false; answer()");
  assert.equal(h.run('foreground'), null);
  assert.equal(h.run('phraseEvent'), null);
  h.run('stop()'); h.advance(3);
});

test('hour-long foreground generation stays sparse, in key, and stops mid-fragment', async () => {
  const h = harness();
  h.run(`layerIds.forEach(id => $(id).checked = true); $('auto-random').checked = false;
    const events = [], originalNote = noteMidi;
    noteMidi = (...args) => {
      const midi = originalNote(...args);
      if (phraseEvent) events.push({ at: context.currentTime, voice: args[1], midi,
        inKey: getScale().some(value => MusicTheory.pc(value) === MusicTheory.pc(midi)) });
      return midi;
    };`);
  await h.run('start()'); h.advance(3600);
  const events = h.run('events');
  assert(events.length > 100);
  assert(events.every(event => event.inKey));
  assert(new Set(events.map(event => event.voice)).size >= 4);
  for (const voice of new Set(events.map(event => event.voice))) {
    const notes = events.filter(event => event.voice === voice);
    for (const note of notes) assert(notes.filter(other => other.at >= note.at && other.at < note.at + 60).length <= 8);
  }
  const count = events.length; h.run('stop()'); h.advance(120);
  assert.equal(h.run('events.length'), count);
  assert.equal(h.run('timers.length'), 0); assert.equal(h.run('nodes.length'), 0);
});
