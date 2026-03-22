import { deriveTowerAssignment, deriveTowerAssignmentFromShownTower } from "./deriveAnswers.js";

function normalizeEntries(entries) {
  if (entries == null) {
    return [];
  }

  return (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
}

function withDivider(text) {
  return text ? `-----\n${text}` : null;
}

function getShapeLabel(mimicShape) {
  if (mimicShape === "cross") {
    return "十字";
  }

  if (mimicShape === "x") {
    return "X字";
  }

  return null;
}

function getReplicaMemo(replicaPattern) {
  if (replicaPattern === "ac_stack") {
    return "頭割り先";
  }

  if (replicaPattern === "ac_circle") {
    return "円範囲先";
  }

  return null;
}

function getTowerLabel(towerFaction) {
  const towerLabelMap = {
    earth: "土",
    wind: "風",
    dark: "闇",
    fire: "炎",
  };

  return towerLabelMap[towerFaction] ?? null;
}

function buildF01Memo(session) {
  return getShapeLabel(session.pattern.mimicShape);
}

function buildF04Memo(session) {
  return withDivider(`${session.pattern.fanSafe}安置`);
}

function buildF05Memo(session) {
  return withDivider(getReplicaMemo(session.pattern.replicaPattern));
}

function buildF09Memo(session) {
  return null;
}

function buildQ03MemoResult(session) {
  const position = session.pattern?.mimicCellPosition ?? null;
  const memoMap = {
    A: "[A] ●頭割り\n入替ペア -> [2]\n頭割りは[3]",
    "2": "[2] ★散開\n入替ペア -> [A]\n頭割りは[3]\n散開は[1回目/2]",
    B: "[1] へ移動\n[1] ★散開\n入替ペア -> [D]\n頭割りは[4]\n散開は[2回目/1]",
    "3": "[3] ★散開\n入替ペア -> [B]\n頭割りは[3]\n散開は[2回目/2]",
    C: "[4] へ移動\n[4] ★散開\n入替ペア -> [C]\n頭割りは[4]\n散開は[1回目/1]",
    "4": "[C] へ移動\n[C] ●頭割り\n入替ペア -> [4]\n頭割りは[4]",
    D: "[D] ●頭割り\n入替ペア -> [1]\n頭割りは[4]",
    "1": "[B] へ移動\n[B] ●頭割り\n入替ペア -> [3]\n頭割りは[3]",
  };

  return position ? withDivider(memoMap[position] ?? null) : null;
}

function buildTowerMemo(towerAssignment) {
  const memoMap = {
    "炎": "炎：動かない\n近接：南＋ニア誘導\n遠隔：北＋ファー誘導",
    "風": "風：対岸へ移動\nファー：南＋タゲサ上",
    "土": "土：タケノコ避ける\n近接：南＋ニア誘導\n遠隔：北＋ファー誘導",
    "闇": "闇：南側にビーム誘導\nニア：南＋数字マーカー角",
  };
  const action = memoMap[towerAssignment];

  return withDivider(action);
}

function buildQ10MemoResult(session) {
  const towerAssignment = session.pattern.shownTower
    ? deriveTowerAssignmentFromShownTower(session.pattern.shownTower, session.pattern.lightResistDown)
    : deriveTowerAssignment(
      session.role,
      session.pattern.towerFaction,
      session.pattern.lightResistDown,
    );

  return buildTowerMemo(towerAssignment);
}

const MEMO_RESOLVERS = {
  buildF01Memo,
  buildF04Memo,
  buildF05Memo,
  buildF09Memo,
  buildQ03MemoResult,
  buildQ10MemoResult,
};

export function resolveMemoEntries(resolverName, session) {
  const resolver = MEMO_RESOLVERS[resolverName];

  if (!resolver) {
    return [];
  }

  return normalizeEntries(resolver(session));
}
