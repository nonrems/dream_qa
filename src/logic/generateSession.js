import { GIMMICK_OPTIONS, TOWER_OPTIONS } from "./constants.js";

function pickRandom(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

function shuffle(list, rng = Math.random) {
  const copy = [...list];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function resolveTowerForecastState(role, towerForecastBase, towerForecastLightPattern) {
  const forecastMap = {
    "1_1": {
      MT: { shownTower: "炎", lightResistDown: true },
      D1: { shownTower: "闇", lightResistDown: false },
      H1: { shownTower: "風", lightResistDown: true },
      D3: { shownTower: "土", lightResistDown: false },
      D4: { shownTower: "炎", lightResistDown: false },
      H2: { shownTower: "闇", lightResistDown: true },
      D2: { shownTower: "風", lightResistDown: false },
      ST: { shownTower: "土", lightResistDown: true },
    },
    "1_2": {
      MT: { shownTower: "炎", lightResistDown: false },
      D1: { shownTower: "闇", lightResistDown: true },
      H1: { shownTower: "風", lightResistDown: false },
      D3: { shownTower: "土", lightResistDown: true },
      D4: { shownTower: "炎", lightResistDown: true },
      H2: { shownTower: "闇", lightResistDown: false },
      D2: { shownTower: "風", lightResistDown: true },
      ST: { shownTower: "土", lightResistDown: false },
    },
    "2_1": {
      MT: { shownTower: "風", lightResistDown: true },
      D1: { shownTower: "土", lightResistDown: false },
      H1: { shownTower: "炎", lightResistDown: true },
      D3: { shownTower: "闇", lightResistDown: false },
      D4: { shownTower: "風", lightResistDown: false },
      H2: { shownTower: "土", lightResistDown: true },
      D2: { shownTower: "炎", lightResistDown: false },
      ST: { shownTower: "闇", lightResistDown: true },
    },
    "2_2": {
      MT: { shownTower: "風", lightResistDown: false },
      D1: { shownTower: "土", lightResistDown: true },
      H1: { shownTower: "炎", lightResistDown: false },
      D3: { shownTower: "闇", lightResistDown: true },
      D4: { shownTower: "風", lightResistDown: true },
      H2: { shownTower: "土", lightResistDown: false },
      D2: { shownTower: "炎", lightResistDown: true },
      ST: { shownTower: "闇", lightResistDown: false },
    },
  };

  const key = `${towerForecastBase}_${towerForecastLightPattern}`;
  return forecastMap[key]?.[role] ?? { shownTower: null, lightResistDown: false };
}

export function generateSessionPattern(role, rng = Math.random) {
  const towerPool =
    ["MT", "H1", "D2", "D4"].includes(role) ? ["earth", "wind"] : ["dark", "fire"];
  const towerForecastBase = pickRandom(["1", "2"], rng);
  const towerForecastLightPattern = pickRandom(["1", "2"], rng);
  const towerForecastState = resolveTowerForecastState(role, towerForecastBase, towerForecastLightPattern);

  return {
    role,
    mimicShape: pickRandom(["cross", "x"], rng),
    mimicCellPosition: pickRandom(["A", "2", "B", "3", "C", "4", "D", "1"], rng),
    fanSafe: pickRandom(["12", "34"], rng),
    replicaPattern: pickRandom(["ac_stack", "ac_circle"], rng),
    towerForecastBase,
    towerForecastLightPattern,
    shownTower: towerForecastState.shownTower,
    towerFaction: pickRandom(towerPool, rng),
    lightResistDown: towerForecastState.lightResistDown,
    warpDirection: pickRandom(["north", "south"], rng),
    islandSafe: pickRandom(["B", "D"], rng),
  };
}

export function generateChoiceOrders(role, rng = Math.random) {
  const stackChoices = ["MT", "H1", "D1", "D3"].includes(role) ? ["A", "1"] : ["D", "4"];
  const towerActionOptions = ["南にビーム誘導", "対岸に飛ぶ", "動かない", "タケノコ避け"];

  return {
    q07_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q08_safe: shuffle(["12", "34"], rng),
    q10_tower: shuffle(TOWER_OPTIONS, rng),
    q11_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q12_pos1: shuffle(["1", "2", "3", "4", "C"], rng),
    q13_pos2: shuffle(["1", "2", "3", "4", "C"], rng),
    q14_pos3: shuffle(["1", "2", "3", "4", "C"], rng),
    q15_pos4: shuffle(["1", "2", "3", "4", "C"], rng),
    q16_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q17_tower: shuffle(towerActionOptions, rng),
    q18_near_far: shuffle(["1", "2", "3", "4"], rng),
    q20_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q21_stack_pos: shuffle(stackChoices, rng),
    q22_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q23_safe: shuffle(["1", "2", "3", "4"], rng),
    q24_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q25_stack_pos: shuffle(stackChoices, rng),
    q26_gimmick: shuffle(GIMMICK_OPTIONS, rng),
    q27_safe: shuffle(["1", "2"], rng),
  };
}
