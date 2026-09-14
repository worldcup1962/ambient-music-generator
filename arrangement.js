const Arrangement = (() => {
  // 組み合わせ全体を選び、同じ役割の楽器が無制限に積み上がるのを防ぐ。
  const recipes = {
    still: [['piano', 'flute', 'haze'], ['harp', 'strings', 'bowl'], ['piano', 'bowl', 'strings']],
    forest: [['flute', 'kalimba', 'strings'], ['harp', 'strings', 'flute'], ['kalimba', 'flute', 'haze']],
    tide: [['strings', 'harp', 'bowl'], ['harp', 'flute', 'haze'], ['piano', 'strings', 'bowl']],
    ember: [['epiano', 'bowl', 'strings'], ['piano', 'bowl'], ['epiano', 'strings']],
    snow: [['bowl', 'piano', 'haze'], ['piano', 'strings'], ['kalimba', 'bowl', 'haze']],
    city: [['pluck', 'strings', 'haze'], ['epiano', 'strings'], ['piano', 'bowl'], ['epiano', 'bowl', 'strings']],
    desert: [['flute', 'harp', 'drone'], ['harp', 'bowl', 'flute'], ['bowl', 'flute', 'haze']],
    stars: [['pluck', 'strings', 'haze'], ['kalimba', 'flute', 'haze'], ['harp', 'strings', 'shimmer'], ['piano', 'bowl', 'haze']],
    bamboo: [['kalimba', 'flute', 'strings'], ['harp', 'flute'], ['kalimba', 'bowl', 'flute']],
    deep: [['strings', 'bowl', 'drone'], ['bowl', 'epiano', 'haze'], ['epiano', 'strings', 'haze']]
  };
  const environments = {
    still: ['stream'], forest: ['stream', 'birds'], tide: ['ocean'],
    ember: ['fireplace'], snow: ['wind'], city: ['rain'], desert: ['wind'], stars: [], bamboo: ['wind', 'birds'], deep: ['ocean']
  };
  function choose(scene, previous = [], random = Math.random) {
    const options = recipes[scene];
    const weighted = options.flatMap(recipe => Array(1 + recipe.filter(id => previous.includes(id)).length).fill(recipe));
    const chosen = [...weighted[Math.floor(random() * weighted.length)]];
    const environment = environments[scene];
    if (environment.length && random() < .55) chosen.push(environment[Math.floor(random() * environment.length)]);
    if (['ember', 'city'].includes(scene) && random() < .15) chosen.push('tape');
    return chosen;
  }
  return { choose, recipes, environments };
})();
if (typeof module !== 'undefined') module.exports = Arrangement;
