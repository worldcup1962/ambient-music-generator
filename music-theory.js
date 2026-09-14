const MusicTheory = (() => {
  const pc = note => ((note % 12) + 12) % 12;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function weighted(items, weight, random = Math.random) {
    const weights = items.map(weight);
    let remaining = random() * weights.reduce((sum, value) => sum + value, 0);
    return items.find((_, index) => (remaining -= weights[index]) < 0) ?? items.at(-1);
  }
  function scaleNotes(scale, low, high) {
    return Array.from({ length: high - low + 1 }, (_, index) => low + index).filter(note => scale.some(value => pc(value) === pc(note)));
  }
  function tension(a, b) {
    const distance = Math.abs(a - b), interval = distance % 12;
    if (distance === 1) return .025;
    if (interval === 1 || interval === 11) return .18;
    if (interval === 6) return .12;
    if (distance < 12 && Math.min(a, b) < 48 && interval !== 0 && interval !== 7) return .25;
    return 1;
  }
  function nextChord(scale, previous = [], random = Math.random) {
    const root = 48 + pc(scale[0]);
    const templates = [[0, 4, 7], [0, 3, 7], [0, 2, 7], [0, 5, 7], [0, 4, 9], [0, 7, 9], [0, 3, 10], [0, 5, 9]];
    const chords = templates.filter(chord => chord.every(step => scale.some(note => pc(note) === pc(root + step))))
      .map(chord => [root, root + chord[1], root + chord[2] + 12]);
    const alternatives = chords.filter(chord => chord.some((note, index) => note !== previous[index]));
    // 共通音と小さな移動を優先し、特定の終止先は設けない。
    return weighted(alternatives.length ? alternatives : chords, chord => 1 / (1 + chord.reduce((sum, note, index) => sum + Math.abs(note - (previous[index] ?? note)), 0)), random);
  }
  function melody({ scale, chord, target, previous, sounding = [], low = 48, high = 96, playable = () => true }, random = Math.random) {
    const candidates = scaleNotes(scale, low, high).filter(playable);
    return weighted(candidates, note => {
      const movement = previous === undefined ? 1 : 1 / (1 + Math.abs(note - previous) ** 2 / 5);
      const harmony = chord.some(value => pc(value) === pc(note)) ? 2 : 1;
      const safety = Math.min(1, ...[36 + pc(scale[0]), ...chord, ...sounding].map(other => tension(note, other)));
      return movement * harmony * safety / (1 + Math.abs(note - target) ** 2 / 9);
    }, random);
  }
  function eventDelay(mean, random = Math.random) {
    // 最短間隔を設けた指数分布で、連打と長すぎる無音を防ぐ。
    return clamp(mean * .45 - Math.log(1 - Math.min(1 - 1e-9, random())) * mean * .55, 7.5, mean * 3);
  }
  function performer(random = Math.random) {
    let touch = 0, timing = 0;
    return () => {
      // 前のタッチを少し引き継ぎ、音ごとの独立抽選による落ち着かない強弱を避ける。
      touch = clamp(touch * .8 + (random() * 2 - 1) * .2, -1, 1);
      timing = clamp(timing * .75 + (random() * 2 - 1) * .25, -1, 1);
      return {
        delay: .025 + timing * .018 + random() * .012,
        level: 1 + touch * .12 + (random() * 2 - 1) * .025,
        length: 1 + timing * .035,
        attack: 1 - touch * .12,
        brightness: 1 + touch * .06
      };
    };
  }
  return { pc, clamp, weighted, scaleNotes, tension, nextChord, melody, eventDelay, performer };
})();
if (typeof module !== 'undefined') module.exports = MusicTheory;
