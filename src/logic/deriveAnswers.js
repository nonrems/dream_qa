import {
  headmarkerFirstMap,
  headmarkerSecondMap,
  p2PositionMap,
  p24ReplicaSwapMap,
} from "./legacyMaps.js";

export function deriveFinalStandPosition(mimicCellPosition) {
  return p2PositionMap[mimicCellPosition] ?? null;
}

export function deriveQ03CorrectAnswer(pattern) {
  return deriveFinalStandPosition(pattern.mimicCellPosition);
}

export function deriveReplicaSwapPosition(mimicCellPosition, replicaPattern) {
  const explicitReplicaSwapMap = {
    ac_stack: {
      "1": "B",
      "2": "2",
      "3": "3",
      "4": "C",
      A: "A",
      B: "1",
      C: "4",
      D: "D",
    },
    ac_circle: {
      "1": "3",
      "2": "A",
      "3": "B",
      "4": "4",
      A: "2",
      B: "D",
      C: "C",
      D: "1",
    },
  };

  const key = mimicCellPosition == null ? null : String(mimicCellPosition).trim();
  const map = explicitReplicaSwapMap[replicaPattern] ?? p24ReplicaSwapMap[replicaPattern];
  return key ? (map?.[key] ?? null) : null;
}

export function deriveQ06CorrectAnswer(pattern) {
  return deriveReplicaSwapPosition(pattern.mimicCellPosition, pattern.replicaPattern);
}

export function deriveQ07CorrectAnswer() {
  return "扇";
}

export function deriveQ08CorrectAnswer(pattern) {
  return pattern.fanSafe;
}

export function deriveCircleSequence(mimicCellPosition) {
  if (mimicCellPosition === "C") {
    return ["1", "C"];
  }
  if (mimicCellPosition === "B") {
    return ["C", "1"];
  }
  if (mimicCellPosition === "2") {
    return ["2", "C"];
  }
  if (mimicCellPosition === "3") {
    return ["C", "2"];
  }
  return ["C", "C"];
}

export function deriveStackSequence(mimicCellPosition) {
  if (["A", "2", "1", "3"].includes(mimicCellPosition)) {
    return ["3", "3"];
  }
  if (["B", "C", "D", "4"].includes(mimicCellPosition)) {
    return ["4", "4"];
  }
  return [null, null];
}

export function deriveRepeatedPositionSequence(pattern) {
  const [circleFirst, circleSecond] = deriveCircleSequence(pattern.mimicCellPosition);
  const [stackFirst, stackSecond] = deriveStackSequence(pattern.mimicCellPosition);

  if (pattern.replicaPattern === "ac_stack") {
    return [stackFirst, circleFirst, stackSecond, circleSecond];
  }

  return [circleFirst, stackFirst, circleSecond, stackSecond];
}

export function deriveQ12CorrectAnswer(pattern) {
  return deriveRepeatedPositionSequence(pattern)[0] ?? null;
}

export function deriveQ13CorrectAnswer(pattern) {
  return deriveRepeatedPositionSequence(pattern)[1] ?? null;
}

export function deriveQ14CorrectAnswer(pattern) {
  return deriveRepeatedPositionSequence(pattern)[2] ?? null;
}

export function deriveQ15CorrectAnswer(pattern) {
  return deriveRepeatedPositionSequence(pattern)[3] ?? null;
}

export function deriveTagasaPosition(fanSafe, warpDirection) {
  if (fanSafe === "12") {
    return warpDirection === "north" ? "outer" : "inner";
  }
  if (fanSafe === "34") {
    return warpDirection === "north" ? "inner" : "outer";
  }
  return null;
}

export function deriveFanMoveSafeSlot(fanSafe, warpDirection, islandSafe) {
  const tagasaPosition = deriveTagasaPosition(fanSafe, warpDirection);

  if (tagasaPosition === "outer" && islandSafe === "B") {
    return "1";
  }
  if (tagasaPosition === "outer" && islandSafe === "D") {
    return "2";
  }
  if (tagasaPosition === "inner" && islandSafe === "B") {
    return "3";
  }
  if (tagasaPosition === "inner" && islandSafe === "D") {
    return "4";
  }

  return null;
}

export function deriveFinalSafeSlot(fanSafe, warpDirection) {
  const tagasaPosition = deriveTagasaPosition(fanSafe, warpDirection);

  if (tagasaPosition === "outer") {
    return "1";
  }

  if (tagasaPosition === "inner") {
    return "2";
  }

  return null;
}

export function deriveTowerAssignment(role, towerFaction, lightResistDown) {
  const groupA = ["MT", "H1", "D2", "D4"];
  const isGroupA = groupA.includes(role);

  if (isGroupA && towerFaction === "earth" && lightResistDown) {
    return "土";
  }
  if (isGroupA && towerFaction === "earth" && !lightResistDown) {
    return "闇";
  }
  if (isGroupA && towerFaction === "wind" && lightResistDown) {
    return "炎";
  }
  if (isGroupA && towerFaction === "wind" && !lightResistDown) {
    return "風";
  }
  if (!isGroupA && towerFaction === "dark" && lightResistDown) {
    return "土";
  }
  if (!isGroupA && towerFaction === "dark" && !lightResistDown) {
    return "闇";
  }
  if (!isGroupA && towerFaction === "fire" && lightResistDown) {
    return "炎";
  }
  if (!isGroupA && towerFaction === "fire" && !lightResistDown) {
    return "風";
  }

  return null;
}

export function deriveTowerAssignmentFromShownTower(shownTower, lightResistDown) {
  const pairMap = {
    "風": "土",
    "土": "風",
    "闇": "炎",
    "炎": "闇",
  };

  if (!shownTower) {
    return null;
  }

  const shouldSwap =
    (["風", "闇"].includes(shownTower) && lightResistDown) ||
    (["土", "炎"].includes(shownTower) && !lightResistDown);

  return shouldSwap ? (pairMap[shownTower] ?? null) : shownTower;
}

export function deriveQ10CorrectAnswer(pattern, role) {
  if (pattern?.shownTower) {
    return deriveTowerAssignmentFromShownTower(pattern.shownTower, pattern.lightResistDown);
  }

  return deriveTowerAssignment(role, pattern.towerFaction, pattern.lightResistDown);
}

export function deriveQ11CorrectAnswer() {
  return "頭割り円範囲";
}

export function deriveQ16CorrectAnswer() {
  return "塔踏み";
}

export function deriveQ17CorrectAnswer(pattern, role) {
  const towerAssignment = pattern?.shownTower
    ? deriveTowerAssignmentFromShownTower(pattern.shownTower, pattern.lightResistDown)
    : deriveTowerAssignment(role, pattern.towerFaction, pattern.lightResistDown);

  const actionMap = {
    "闇": "南にビーム誘導",
    "風": "対岸に飛ぶ",
    "炎": "動かない",
    "土": "タケノコ避け",
  };

  return towerAssignment ? (actionMap[towerAssignment] ?? null) : null;
}

export function deriveNearFarPosition(role, towerAssignment) {
  if (towerAssignment === "闇") {
    return "1";
  }
  if (towerAssignment === "風") {
    return "2";
  }
  if (["炎", "土"].includes(towerAssignment) && ["MT", "ST", "D1", "D2"].includes(role)) {
    return "3";
  }
  if (["炎", "土"].includes(towerAssignment) && ["H1", "H2", "D3", "D4"].includes(role)) {
    return "4";
  }
  return null;
}

export function deriveQ18CorrectAnswer(pattern, role) {
  const towerAssignment = pattern?.shownTower
    ? deriveTowerAssignmentFromShownTower(pattern.shownTower, pattern.lightResistDown)
    : deriveTowerAssignment(role, pattern.towerFaction, pattern.lightResistDown);
  return towerAssignment ? deriveNearFarPosition(role, towerAssignment) : null;
}

export function deriveFirstHeadmarkerPosition(mimicShape) {
  return headmarkerFirstMap[mimicShape] ?? null;
}

export function deriveSecondHeadmarkerPosition(mimicShape) {
  return headmarkerSecondMap[mimicShape] ?? null;
}

function resolveStackChoiceGroupByRole(role) {
  return ["MT", "H1", "D1", "D3"].includes(role) ? ["A", "1"] : ["D", "4"];
}

export function deriveQ20CorrectAnswer() {
  return "頭割り円範囲";
}

export function deriveQ21CorrectAnswer(pattern, role) {
  const [primary, secondary] = resolveStackChoiceGroupByRole(role);
  return deriveFirstHeadmarkerPosition(pattern.mimicShape) === "A-D" ? primary : secondary;
}

export function deriveQ22CorrectAnswer() {
  return "扇";
}

export function deriveQ23CorrectAnswer(pattern) {
  return deriveFanMoveSafeSlot(pattern.fanSafe, pattern.warpDirection, pattern.islandSafe);
}

export function deriveQ24CorrectAnswer() {
  return "頭割り円範囲";
}

export function deriveQ25CorrectAnswer(pattern, role) {
  const [primary, secondary] = resolveStackChoiceGroupByRole(role);
  return deriveSecondHeadmarkerPosition(pattern.mimicShape) === "A-D" ? primary : secondary;
}

export function deriveQ26CorrectAnswer() {
  return "扇";
}

export function deriveQ27CorrectAnswer(pattern) {
  return deriveFinalSafeSlot(pattern.fanSafe, pattern.warpDirection);
}

const ANSWER_RESOLVERS = {
  deriveQ03CorrectAnswer: (pattern) => deriveQ03CorrectAnswer(pattern),
  deriveQ06CorrectAnswer: (pattern) => deriveQ06CorrectAnswer(pattern),
  deriveQ07CorrectAnswer: () => deriveQ07CorrectAnswer(),
  deriveQ08CorrectAnswer: (pattern) => deriveQ08CorrectAnswer(pattern),
  deriveQ10CorrectAnswer: (pattern, role) => deriveQ10CorrectAnswer(pattern, role),
  deriveQ11CorrectAnswer: () => deriveQ11CorrectAnswer(),
  deriveQ12CorrectAnswer: (pattern) => deriveQ12CorrectAnswer(pattern),
  deriveQ13CorrectAnswer: (pattern) => deriveQ13CorrectAnswer(pattern),
  deriveQ14CorrectAnswer: (pattern) => deriveQ14CorrectAnswer(pattern),
  deriveQ15CorrectAnswer: (pattern) => deriveQ15CorrectAnswer(pattern),
  deriveQ16CorrectAnswer: () => deriveQ16CorrectAnswer(),
  deriveQ17CorrectAnswer: (pattern, role) => deriveQ17CorrectAnswer(pattern, role),
  deriveQ18CorrectAnswer: (pattern, role) => deriveQ18CorrectAnswer(pattern, role),
  deriveQ20CorrectAnswer: () => deriveQ20CorrectAnswer(),
  deriveQ21CorrectAnswer: (pattern, role) => deriveQ21CorrectAnswer(pattern, role),
  deriveQ22CorrectAnswer: () => deriveQ22CorrectAnswer(),
  deriveQ23CorrectAnswer: (pattern) => deriveQ23CorrectAnswer(pattern),
  deriveQ24CorrectAnswer: () => deriveQ24CorrectAnswer(),
  deriveQ25CorrectAnswer: (pattern, role) => deriveQ25CorrectAnswer(pattern, role),
  deriveQ26CorrectAnswer: () => deriveQ26CorrectAnswer(),
  deriveQ27CorrectAnswer: (pattern) => deriveQ27CorrectAnswer(pattern),
};

export function resolveCorrectAnswer(resolverName, pattern, role) {
  const resolver = ANSWER_RESOLVERS[resolverName];
  return resolver ? resolver(pattern, role) : null;
}
