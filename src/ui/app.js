import { TIMELINE_DEFINITION } from "../data/timeline.js";
import { TARGET_MARKER_ASSETS } from "../data/assets.js";
import { resolveCorrectAnswer } from "../logic/deriveAnswers.js";
import { buildGenericExplanation } from "../logic/explanations.js";
import { resolveMemoEntries } from "../logic/memos.js";
import { abandonSession, initializeStore, persistRole, resetHistory, startSession, updateHistory, updateSession } from "../state/sessionStore.js";
import { renderChoiceButtons, renderChoiceGrid, renderMemoList, renderProgressBar } from "./renderers.js";

const EXAM_ANSWER_INPUT_GUARD_MS = 300;

const CHOICE_ORDER_KEYS = {
  "q07-next-gimmick-fan": "q07_gimmick",
  "q08-fan-safe": "q08_safe",
  "q10-tower-assignment": "q10_tower",
  "q11-next-gimmick-stack-circle": "q11_gimmick",
  "q12-position-first": "q12_pos1",
  "q13-position-second": "q13_pos2",
  "q14-position-third": "q14_pos3",
  "q15-position-fourth": "q15_pos4",
  "q16-next-gimmick-tower": "q16_gimmick",
  "q17-tower-again": "q17_tower",
  "q18-near-far-position": "q18_near_far",
  "q20-next-gimmick-stack-circle": "q20_gimmick",
  "q21-stack-position-first": "q21_stack_pos",
  "q22-next-gimmick-fan": "q22_gimmick",
  "q23-fan-safe-numbered": "q23_safe",
  "q24-next-gimmick-stack-circle": "q24_gimmick",
  "q25-stack-position-second": "q25_stack_pos",
  "q26-next-gimmick-fan": "q26_gimmick",
  "q27-final-safe": "q27_safe",
};

const CATEGORY_LABELS = {
  near_far: "ニアファー",
  opening_position: "開幕位置",
  headmarker_position: "十字X字",
  replica: "頭割り/円範囲",
  safe_zone: "扇",
  sequence: "TL理解",
  swap: "線取り",
  tower: "塔",
  unknown: "その他",
};

const FIELD_VISUAL_QUESTION_IDS = new Set([
  "q03-final-position",
  "q06-line",
  "q08-fan-safe",
  "q12-position-first",
  "q13-position-second",
  "q14-position-third",
  "q15-position-fourth",
  "q21-stack-position-first",
  "q25-stack-position-second",
]);

function resolveAccuracyCategory(questionId, fallbackCategory) {
  if (questionId === "q03-final-position") {
    return "opening_position";
  }

  if (questionId === "q21-stack-position-first" || questionId === "q25-stack-position-second") {
    return "headmarker_position";
  }

  return fallbackCategory ?? "unknown";
}

function buildAccuracyCategoryOrderMap() {
  const orderMap = new Map();

  for (const event of TIMELINE_DEFINITION) {
    if (event.kind !== "question") {
      continue;
    }

    const accuracyCategory = resolveAccuracyCategory(event.id, event.category);

    if (!orderMap.has(accuracyCategory)) {
      orderMap.set(accuracyCategory, event.order);
    }
  }

  return orderMap;
}

const ACCURACY_CATEGORY_ORDER = buildAccuracyCategoryOrderMap();

function normalizeHistoryShape(history) {
  if (!history || typeof history !== "object") {
    return { sessions: [] };
  }

  return {
    ...history,
    sessions: Array.isArray(history.sessions) ? history.sessions : [],
  };
}

function getCurrentEvent(state) {
  const eventId = state.session?.progress.currentEventId;
  return TIMELINE_DEFINITION.find((item) => item.id === eventId) ?? TIMELINE_DEFINITION[0];
}

function getSessionMode(session) {
  return session?.mode === "exam" ? "exam" : "practice";
}

function isTimerToggleDisabled(state, event = getCurrentEvent(state)) {
  if (!state.session || !event) {
    return true;
  }

  const sessionMode = getSessionMode(state.session);
  return sessionMode === "exam" || (sessionMode === "practice" && event.kind === "answer");
}

function getEventIndex(eventId) {
  return TIMELINE_DEFINITION.findIndex((item) => item.id === eventId);
}

function getNextPlayableEvent(currentEventId) {
  const currentIndex = getEventIndex(currentEventId);

  if (currentIndex < 0) {
    return null;
  }

  for (let index = currentIndex + 1; index < TIMELINE_DEFINITION.length; index += 1) {
    const event = TIMELINE_DEFINITION[index];
    if (event.kind !== "role_select") {
      return event;
    }
  }

  return null;
}

function resolveRoleBasedChoices(event, state) {
  if (!event?.choices) {
    return [];
  }

  const role = state.session?.role ?? state.settings.role;
  const isLeftGroup = ["MT", "H1", "D1", "D3"].includes(role);
  const choiceOrderKey = CHOICE_ORDER_KEYS[event.id];
  const sessionChoices = choiceOrderKey ? state.session?.choiceOrders?.[choiceOrderKey] : null;
  const staticOptions = event.choices?.options ?? [];

  if (sessionChoices?.length) {
    const hasSameMembers =
      staticOptions.length > 0 &&
      sessionChoices.length === staticOptions.length &&
      sessionChoices.every((choice) => staticOptions.includes(choice));

    if (hasSameMembers || staticOptions.length === 0) {
      return sessionChoices;
    }
  }

  if (event.choices?.optionsResolver === "resolveQ21ChoicesByRole") {
    return isLeftGroup ? ["A", "1"] : ["D", "4"];
  }

  if (event.choices?.optionsResolver === "resolveQ25ChoicesByRole") {
    return isLeftGroup ? ["A", "1"] : ["D", "4"];
  }

  return event.choices?.options ?? [];
}

function getElapsedMs(state, event, now = Date.now()) {
  if (!state.session || !event?.durationMs) {
    return 0;
  }

  const progress = state.session.progress;
  const startedAt = progress.eventStartedAt ?? now;
  const baseElapsed = now - startedAt - (progress.eventTotalPausedMs ?? 0);

  if (progress.timerStopped && progress.eventPausedAt) {
    return progress.eventPausedAt - startedAt - (progress.eventTotalPausedMs ?? 0);
  }

  return Math.max(0, baseElapsed);
}

function getProgressPercent(state, event) {
  if (!event?.durationMs) {
    return 100;
  }

  const elapsedMs = getElapsedMs(state, event);
  const remainingRatio = 1 - elapsedMs / event.durationMs;
  return Math.max(0, Math.min(100, remainingRatio * 100));
}

function formatEventMeta(event) {
  if (!event || event.kind === "role_select") {
    return "";
  }

  return `${getDisplayOrder(event)}. ${event.kind}`;
}

function getDisplayOrder(event) {
  if (!event) {
    return "";
  }

  if (event.kind === "answer" && event.sourceQuestionId) {
    const sourceEvent = TIMELINE_DEFINITION.find((item) => item.id === event.sourceQuestionId);
    return getDisplayOrder(sourceEvent);
  }

  if (typeof event.displayOrder === "number" || typeof event.displayOrder === "string") {
    return String(event.displayOrder);
  }

  if (event.kind === "role_select") {
    return String(event.order);
  }

  const playableEvents = TIMELINE_DEFINITION.filter((item) => item.kind !== "role_select" && item.kind !== "answer");
  const displayIndex = playableEvents.findIndex((item) => item.id === event.id);

  if (displayIndex >= 0) {
    return String(displayIndex + 1);
  }

  return String(event.order);
}

function getDisplayTitle(event) {
  if (!event) {
    return "";
  }

  if (event.kind === "answer" && event.sourceQuestionId) {
    const sourceEvent = TIMELINE_DEFINITION.find((item) => item.id === event.sourceQuestionId);
    return sourceEvent?.prompt ?? "";
  }

  return event.prompt ?? "";
}

function resolveCurrentTargetMarkerSrc(state) {
  const rawMarkerKey = state.session?.pattern?.mimicCellPosition;
  const markerKey = rawMarkerKey == null ? null : String(rawMarkerKey).trim();

  if (!markerKey) {
    return null;
  }

  return TARGET_MARKER_ASSETS[markerKey] ?? null;
}

function resolveVisualPanelContent(event, state) {
  if (!event) {
    return `<div class="visual-placeholder">Visual Placeholder</div>`;
  }

  if (event.id === "f01-mimic-shape") {
    const mimicShape = state.session?.pattern?.mimicShape;

    if (mimicShape === "x") {
      return `<img class="visual-image" src="./src/img/forecast1_x.png" alt="X字予告画像" />`;
    }

    if (mimicShape === "cross") {
      return `<img class="visual-image" src="./src/img/forecast1_cross.png" alt="十字予告画像" />`;
    }
  }

  if (event.id === "f02-mimic-position") {
    const rawPosition = state.session?.pattern?.mimicCellPosition;
    const mimicCellPosition = rawPosition == null ? null : String(rawPosition).trim();

    if (mimicCellPosition) {
      return `<img class="visual-image" src="./src/img/forecast2_${mimicCellPosition.toLowerCase()}.png" alt="模倣細胞位置画像" />`;
    }
  }

  if (event.id === "a03-final-position") {
    const rawPosition = state.session?.pattern?.mimicCellPosition;
    const mimicCellPosition = rawPosition == null ? null : String(rawPosition).trim();
    const swappedImageMap = {
      "1": "forecast2_1b.png",
      B: "forecast2_b1.png",
      "4": "forecast2_4c.png",
      C: "forecast2_c4.png",
    };

    if (mimicCellPosition) {
      const imageName = swappedImageMap[mimicCellPosition] ?? `forecast2_${mimicCellPosition.toLowerCase()}.png`;
      return `<img class="visual-image" src="./src/img/${imageName}" alt="最終立ち位置画像" />`;
    }
  }

  if (event.id === "f04-fan" || event.id === "a08-fan-safe") {
    const fanSafe = state.session?.pattern?.fanSafe;

    if (fanSafe === "12") {
      return `<img class="visual-image" src="./src/img/forecast4_12.png" alt="12安置予告画像" />`;
    }

    if (fanSafe === "34") {
      return `<img class="visual-image" src="./src/img/forecast4_34.png" alt="34安置予告画像" />`;
    }
  }

  if (event.id === "f05-replica" || event.id === "q06-line") {
    const replicaPattern = state.session?.pattern?.replicaPattern;

    if (replicaPattern === "ac_stack") {
      return `<img class="visual-image" src="./src/img/forecast5_atama.png" alt="頭割り開始予告画像" />`;
    }

    if (replicaPattern === "ac_circle") {
      return `<img class="visual-image" src="./src/img/forecast5_en.png" alt="円範囲開始予告画像" />`;
    }
  }

  if (event.id === "a06-line") {
    const replicaPattern = state.session?.pattern?.replicaPattern;

    if (replicaPattern === "ac_stack") {
      return `<img class="visual-image" src="./src/img/forecast5_atama.png" alt="頭割り開始予告画像" />`;
    }

    if (replicaPattern === "ac_circle") {
      return `<img class="visual-image" src="./src/img/forecast5_atama_change.png" alt="円範囲開始解答画像" />`;
    }
  }

  if (event.id === "f09-tower" || event.id === "q10-tower-assignment" || event.id === "q17-tower-again") {
    const towerForecastBase = state.session?.pattern?.towerForecastBase ?? "1";
    const towerForecastLightPattern = state.session?.pattern?.towerForecastLightPattern ?? "1";
    return `<img class="visual-image" src="./src/img/forecast9_${towerForecastBase}_${towerForecastLightPattern}.png" alt="塔予告画像" />`;
  }

  if (event.id === "a10-tower-assignment" || event.id === "a17-tower-again") {
    const towerForecastBase = state.session?.pattern?.towerForecastBase ?? "1";
    const towerForecastLightPattern = state.session?.pattern?.towerForecastLightPattern ?? "1";
    return `<img class="visual-image" src="./src/img/forecast9_${towerForecastBase}_${towerForecastLightPattern}_answer.png" alt="塔解答画像" />`;
  }

  if (["a12-position-first", "a13-position-second", "a14-position-third", "a15-position-fourth"].includes(event.id)) {
    const replicaPosition = resolveCorrectAnswer(event.answerResolver, state.session?.pattern, state.session?.role);

    if (replicaPosition) {
      return `<img class="visual-image" src="./src/img/replica_${String(replicaPosition).toLowerCase()}.png" alt="レプリカ位置画像" />`;
    }
  }

  if (event.id === "q18-near-far-position") {
    return `<img class="visual-image" src="./src/img/forecast18.png" alt="ニアファー位置画像" />`;
  }

  if (event.id === "a18-near-far-position") {
    return `<img class="visual-image" src="./src/img/forecast18_answer.png" alt="ニアファー解答画像" />`;
  }

  if (event.id === "f19-fan-move") {
    const warpDirection = state.session?.pattern?.warpDirection;
    const islandSafe = state.session?.pattern?.islandSafe;

    if (warpDirection === "north" && islandSafe === "D") {
      return `<img class="visual-image" src="./src/img/forecast19_1.png" alt="北ワープD安置画像" />`;
    }

    if (warpDirection === "south" && islandSafe === "D") {
      return `<img class="visual-image" src="./src/img/forecast19_2.png" alt="南ワープD安置画像" />`;
    }

    if (warpDirection === "north" && islandSafe === "B") {
      return `<img class="visual-image" src="./src/img/forecast19_3.png" alt="北ワープB安置画像" />`;
    }

    if (warpDirection === "south" && islandSafe === "B") {
      return `<img class="visual-image" src="./src/img/forecast19_4.png" alt="南ワープB安置画像" />`;
    }
  }

  if (event.id === "a21-stack-position-first" || event.id === "a25-stack-position-second") {
    const positionAnswer = resolveCorrectAnswer(event.answerResolver, state.session?.pattern, state.session?.role);

    if (positionAnswer === "1" || positionAnswer === "4") {
      return `<img class="visual-image" src="./src/img/position_14.png" alt="1または4位置画像" />`;
    }

    if (positionAnswer === "A" || positionAnswer === "D") {
      return `<img class="visual-image" src="./src/img/position_ad.png" alt="AまたはD位置画像" />`;
    }
  }

  if (event.id === "q23-fan-safe-numbered") {
    return `<img class="visual-image" src="./src/img/question23.png" alt="23問目画像" />`;
  }

  if (event.id === "a23-fan-safe-numbered") {
    const answer = resolveCorrectAnswer(event.answerResolver, state.session?.pattern, state.session?.role);

    if (["1", "2", "3", "4"].includes(String(answer))) {
      return `<img class="visual-image" src="./src/img/question23_answer${String(answer)}.png" alt="23問目解答画像" />`;
    }
  }

  if (event.id === "q27-final-safe") {
    return `<img class="visual-image" src="./src/img/question27.png" alt="27問目画像" />`;
  }

  if (event.id === "a27-final-safe") {
    const answer = resolveCorrectAnswer(event.answerResolver, state.session?.pattern, state.session?.role);

    if (String(answer) === "1" || String(answer) === "2") {
      return `<img class="visual-image" src="./src/img/question27_answer${String(answer)}.png" alt="27問目解答画像" />`;
    }
  }

  if (event.kind === "question" && FIELD_VISUAL_QUESTION_IDS.has(event.id)) {
    return `<img class="visual-image" src="./src/img/field.png" alt="フィールド画像" />`;
  }

  if (event.kind === "answer") {
    return `<div class="visual-placeholder">Visual Placeholder</div>`;
  }

  return `<div class="visual-placeholder">Visual Placeholder</div>`;
}

function getAnswerSourceEvent(event) {
  if (!event?.sourceQuestionId) {
    return null;
  }

  return TIMELINE_DEFINITION.find((item) => item.id === event.sourceQuestionId) ?? null;
}

function buildQuestionResult(questionEvent, session) {
  if (!questionEvent || !session) {
    return null;
  }

  const selectedAnswer = session.answers?.[questionEvent.id] ?? null;
  const correctAnswer = resolveCorrectAnswer(questionEvent.answerResolver, session.pattern, session.role);
  const timedOut = selectedAnswer == null;

  return {
    questionId: questionEvent.id,
    selectedAnswer,
    correctAnswer,
    timedOut,
    isCorrect: selectedAnswer != null && correctAnswer != null && selectedAnswer === correctAnswer,
  };
}

function resolveAnswerExplanation(event, result, state) {
  if (!event || !result) {
    return "";
  }

  if ([
    "a07-next-gimmick-fan",
    "a11-next-gimmick-stack-circle",
    "a16-next-gimmick-tower",
    "a20-next-gimmick-stack-circle",
    "a22-next-gimmick-fan",
    "a24-next-gimmick-stack-circle",
    "a26-next-gimmick-fan",
  ].includes(event.id)) {
    return "";
  }

  if (event.id === "a03-final-position") {
    const rawPosition = state.session?.pattern?.mimicCellPosition;
    const mimicCellPosition = rawPosition == null ? null : String(rawPosition).trim();

    if (mimicCellPosition === "1" || mimicCellPosition === "B") {
      return "1⇔Bで入れ替えます。";
    }

    if (mimicCellPosition === "4" || mimicCellPosition === "C") {
      return "4⇔Cで入れ替えます。";
    }

    return "";
  }

  if (event.id === "a06-line") {
    return `【ACが頭割り】
そのまま
【ACが円範囲】
色の異なる隣のマーカーと入れ替え`;
  }

  if (event.id === "a08-fan-safe") {
    return `34安置の場合は中央の範囲にも注意。
島への移動は扇の後でも間に合います。`;
  }

  if (event.id === "a10-tower-assignment") {
    return `闇と風は光耐性デバフを持ったままでは踏めません。南北ペアで入れ替わりましょう。`;
  }

  if (event.id === "a17-tower-again") {
    return `この時点で闇にはニア、風にはファーのデバフが付きます。次の散開を意識しましょう。
土　　　：ニアファー散開時にタケノコ注意
ヒーラー：闇担当にエスナ`;
  }

  if (event.id === "a21-stack-position-first" || event.id === "a25-stack-position-second") {
    return `ドリーム開幕の分身の位置によって分岐します。
【十字】
1回目：A、D
2回目：1、4
【X字】
1回目：1、4
2回目：A、D`;
  }

  if (event.id === "a23-fan-safe-numbered" || event.id === "a27-final-safe") {
    return `吸い込まれたのが最初の安置と同じ方角かどうかを見ます。
【同じ方角】
・12安置で北が吸い込まれる
・または34安置で南が吸い込まれる
→その後の扇安置はタゲサ外
【違う方角】
・12安置で南が吸い込まれる
・34安置で北が吸い込まれる
→その後の扇安置はタゲサ内`;
  }

  if (["a12-position-first", "a13-position-second", "a14-position-third", "a15-position-fourth"].includes(event.id)) {
    const correctAnswer = result.correctAnswer == null ? "" : String(result.correctAnswer).trim();

    if (correctAnswer === "1" || correctAnswer === "2") {
      return `【円範囲1回目】
禁止①　　：1マーカー側
アタック①：2マーカー側
【円範囲2回目】
禁止②　　：1マーカー側
アタック②：2マーカー側`;
    }

    if (correctAnswer === "C") {
      return "";
    }

    if (correctAnswer === "3" || correctAnswer === "4") {
      return "範囲担当が頭割りに合流しやすいように指定マーカーよりやや北で集合してください。";
    }
  }

  if (event.id === "a18-near-far-position") {
    return `①闇はニア：南側＋数字マーカー角
②風はファー：南側＋タゲサ上
炎または風は無職：
③近接：ニアの南＋ニア誘導
④遠隔：フィールド北＋ファー誘導`;
  }

  return buildGenericExplanation({
    correctAnswer: result.correctAnswer,
    selectedAnswer: result.selectedAnswer,
    timedOut: result.timedOut,
  });
}

function buildHistorySessionSnapshot(session) {
  if (!session) {
    return null;
  }

  const resultEntries = Object.values(session.results ?? {})
    .filter(Boolean)
    .map((result) => {
      const event = TIMELINE_DEFINITION.find((item) => item.id === result.questionId);
      const accuracyCategory = resolveAccuracyCategory(result.questionId, event?.category);

      return {
        ...result,
        category: accuracyCategory,
      };
    });

  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    role: session.role,
    updatedAt: Date.now(),
    results: resultEntries,
  };
}

function upsertHistorySession(history, session) {
  const snapshot = buildHistorySessionSnapshot(session);

  if (!snapshot) {
    return normalizeHistoryShape(history);
  }

  const safeHistory = normalizeHistoryShape(history);
  const nextSessions = safeHistory.sessions.filter((item) => item.sessionId !== snapshot.sessionId);
  nextSessions.push(snapshot);

  return {
    ...safeHistory,
    sessions: nextSessions,
  };
}

function summarizeWeakCategories(history) {
  const categoryMap = new Map();
  const safeHistory = normalizeHistoryShape(history);

  for (const session of safeHistory.sessions) {
    const safeResults = Array.isArray(session?.results) ? session.results : [];

    for (const result of safeResults) {
      if (!result?.questionId) {
        continue;
      }

      const accuracyCategory = resolveAccuracyCategory(result.questionId, result.category);

      const current = categoryMap.get(accuracyCategory) ?? {
        category: accuracyCategory,
        label: CATEGORY_LABELS[accuracyCategory] ?? accuracyCategory,
        total: 0,
        correct: 0,
        timedOut: 0,
      };

      current.total += 1;
      if (result.isCorrect) {
        current.correct += 1;
      }
      if (result.timedOut) {
        current.timedOut += 1;
      }

      categoryMap.set(accuracyCategory, current);
    }
  }

  return [...categoryMap.values()]
    .filter((item) => item.total > 0)
    .map((item) => ({
      ...item,
      accuracy: Math.round((item.correct / item.total) * 100),
    }))
    .sort((left, right) => {
      if (left.category === "sequence" && right.category !== "sequence") {
        return 1;
      }
      if (left.category !== "sequence" && right.category === "sequence") {
        return -1;
      }

      const leftOrder = ACCURACY_CATEGORY_ORDER.get(left.category) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = ACCURACY_CATEGORY_ORDER.get(right.category) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.label.localeCompare(right.label, "ja");
    });
}

function summarizeSessionCategories(session) {
  if (!session) {
    return [];
  }

  const pseudoHistory = {
    sessions: [buildHistorySessionSnapshot(session)].filter(Boolean),
  };

  return summarizeWeakCategories(pseudoHistory);
}

function renderHomeScreen(state) {
  const role = state.settings.role ?? "未設定";
  const categoryStats = summarizeWeakCategories(state.history);
  const categoryStatsMarkup = categoryStats.length
    ? categoryStats
      .map(
        (item) => `
          <div class="accuracy-item">
            <div class="summary-row">
              <span>${item.label}</span>
              <strong>${item.accuracy}%</strong>
            </div>
            <div class="accuracy-bar" aria-label="${item.label} 正答率 ${item.accuracy}%">
              <div class="accuracy-bar-fill" style="width: ${item.accuracy}%;"></div>
            </div>
            <div class="accuracy-meta">
              <span>${item.correct}/${item.total}</span>
              ${item.timedOut ? `<span class="accuracy-timeout"><span aria-hidden="true">🕒</span>${item.timedOut}</span>` : ""}
            </div>
          </div>
        `,
      )
      .join("")
    : `<p class="accuracy-empty">まだ修正履歴がありません</p>`;

  return `
    <section class="screen-card">
      <header class="screen-header">
        <p class="eyebrow">Main</p>
        <h1 class="screen-title">ドリーム予習</h1>
        <p class="screen-subtitle">(:3[__] ＜ しんどい</p>
      </header>
      <div class="summary-box">
        <div class="summary-row">
          <span>現在のロール</span>
          <div class="inline-role-actions">
            <strong>${role}</strong>
            <button class="secondary-button summary-action-button" data-action="change-role" aria-label="ロールを変更">
              変更
            </button>
          </div>
        </div>
      </div>
      <div class="summary-box mode-box mode-box-exam">
        <p class="screen-subtitle mode-description">ミスしたら即終了の腕試し用です。</p>
        <button class="primary-button" data-action="start-exam-session">本番モードを開始</button>
      </div>
      <div class="summary-box mode-box mode-box-practice">
        <p class="screen-subtitle mode-description">まずはこちらから。正答率が集計されます。</p>
        <button class="primary-button" data-action="start-practice-session">練習モードを開始</button>
      </div>
      <div class="summary-box">
        <div class="summary-row">
          <span>練習モードの正答率一覧</span>
          <button class="secondary-button summary-action-button" data-action="reset-history">リセット</button>
        </div>
        <div class="accuracy-list">${categoryStatsMarkup}</div>
      </div>
    </section>
  `;
}

function renderAccuracyList(categoryStats) {
  return categoryStats.length
    ? categoryStats
      .map(
        (item) => `
          <div class="accuracy-item">
            <div class="summary-row">
              <span>${item.label}</span>
              <strong>${item.accuracy}%</strong>
            </div>
            <div class="accuracy-bar" aria-label="${item.label} 正答率 ${item.accuracy}%">
              <div class="accuracy-bar-fill" style="width: ${item.accuracy}%;"></div>
            </div>
            <div class="accuracy-meta">
              <span>${item.correct}/${item.total}</span>
              ${item.timedOut ? `<span class="accuracy-timeout"><span aria-hidden="true">🕒</span>${item.timedOut}</span>` : ""}
            </div>
          </div>
        `,
      )
      .join("")
    : `<p class="accuracy-empty">まだ修正履歴がありません</p>`;
}

function renderCompletionScreen(state) {
  const isExamMode = getSessionMode(state.session) === "exam";
  const categoryStatsMarkup = renderAccuracyList(summarizeSessionCategories(state.session));

  return `
    <section class="screen-card">
      <header class="screen-header">
        <p class="eyebrow">Clear</p>
        <h1 class="screen-title">${isExamMode ? "本番モードクリア" : "クリア"}</h1>
        <p class="screen-subtitle">${isExamMode ? "最後まで正解してクリアしました。" : "今回の結果です。"}</p>
      </header>
      ${isExamMode
        ? ""
        : `
      <div class="summary-box">
        <div class="summary-row"><span>正答率一覧</span></div>
        <div class="accuracy-list">${categoryStatsMarkup}</div>
      </div>
      `}
      <section class="panel controls-panel">
        <div class="button-row">
          <button class="primary-button full-width-button" data-action="complete-home">ホーム画面に戻る</button>
        </div>
      </section>
    </section>
  `;
}

function renderRoleSelectScreen(state) {
  const showKeepButton = state.roleSelectMode === "change";

  return `
    <section class="screen-card">
      <header class="screen-header">
        <p class="eyebrow">Role</p>
        <h1 class="screen-title">ロール選択</h1>
        <p class="screen-subtitle">自分のロールを選択してください</p>
      </header>
      <div class="choice-grid grid-8">
        ${renderChoiceButtons(["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"], state.settings.role)}
        ${showKeepButton ? '<button class="secondary-button role-keep-button" data-action="keep-role">変更しない</button>' : ""}
      </div>
    </section>
  `;
}

function renderTimelineScreen(state) {
  const event = getCurrentEvent(state);
  const sessionMode = getSessionMode(state.session);
  const isAnswerScreen = event.kind === "answer";
  const isExamFailureAnswer = sessionMode === "exam" && isAnswerScreen;
  const isExamAnswerInputLocked =
    sessionMode === "exam" &&
    event.kind === "question" &&
    Number.isFinite(state.ui?.examAnswerGuardUntil) &&
    Date.now() < state.ui.examAnswerGuardUntil;
  const isTimerButtonDisabled = isTimerToggleDisabled(state, event);
  const shouldHideVisualPanel = event.category === "sequence" || event.id === "a17-tower-again";
  const resolvedOptions = resolveRoleBasedChoices(event, state);
  const progressPercent = getProgressPercent(state, event);
  const markerSrc = resolveCurrentTargetMarkerSrc(state);
  const shouldShowMarkerImage = event.id !== "f01-mimic-shape" && Boolean(markerSrc);
  const visualPanelContent = resolveVisualPanelContent(event, state);
  const sourceQuestion = isAnswerScreen ? getAnswerSourceEvent(event) : null;
  const result = isAnswerScreen ? state.session?.results?.[sourceQuestion?.id] ?? buildQuestionResult(sourceQuestion, state.session) : null;
  const explanation = isAnswerScreen && result ? resolveAnswerExplanation(event, result, state) : "";
  const hasExplanation = Boolean(explanation?.trim());
  const answerSummary = isAnswerScreen && result
    ? `
      <section class="panel answer-panel">
        <div class="panel-title">正誤</div>
        <div class="answer-status ${result.isCorrect ? "is-correct" : "is-incorrect"}">
          ${result.isCorrect ? "正解" : "不正解"}
        </div>
        <div class="answer-meta">
          <div class="answer-col">
            <div class="answer-value-box"><span>回答</span><strong>${result.selectedAnswer ?? "未回答"}</strong></div>
          </div>
          <div class="answer-col">
            <div class="answer-value-box"><span>正解</span><strong>${result.correctAnswer ?? "未設定"}</strong></div>
          </div>
        </div>
      </section>
      ${hasExplanation
        ? `
      <section class="panel explanation-panel">
        <div class="panel-title">解説</div>
        <p class="explanation-text">${explanation}</p>
      </section>
      `
        : ""}
    `
    : "";
  const choices = event.choices
    ? `<div class="choice-grid ${event.choices.layout}">${renderChoiceGrid(event.choices.layout, resolvedOptions, null, isExamAnswerInputLocked)}</div>`
    : "";
  const controls = choices || event.allowSkip || isAnswerScreen
    ? `
      <section class="panel controls-panel">
        ${choices}
        <div class="button-row">
          ${event.allowSkip ? `<button class="primary-button full-width-button" data-action="next-event">次へ</button>` : ""}
          ${isAnswerScreen && !isExamFailureAnswer ? `<button class="primary-button full-width-button" data-action="next-event">次へ</button>` : ""}
          ${isExamFailureAnswer ? `<button class="primary-button full-width-button" data-action="exam-home">メニューに戻る</button>` : ""}
        </div>
      </section>
    `
    : "";

  return `
    <section class="app-shell">
      <main class="timeline-layout">
        <section class="panel question-panel">
          <p class="eyebrow">${formatEventMeta(event)}</p>
          <h1 class="screen-title">${getDisplayTitle(event)}</h1>
        </section>

        <header class="sticky-panel">
          <div class="sticky-row">
            <div class="sticky-marker" aria-label="ターゲットマーカー">
              <div class="marker-placeholder marker-placeholder-inline">
                ${shouldShowMarkerImage ? `<img class="marker-image" src="${markerSrc}" alt="ターゲットマーカー" />` : "Marker"}
              </div>
            </div>
            <div class="sticky-progress">
              ${renderProgressBar(progressPercent)}
            </div>
            <button
              class="ghost-icon-button"
              data-action="toggle-timer"
              aria-label="${state.session?.progress.timerStopped ? "タイマー再開" : "タイマーストップ"}"
              ${isTimerButtonDisabled ? 'disabled aria-disabled="true"' : ""}
            >
              ${state.session?.progress.timerStopped
                ? `
              <svg class="timer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 6.5v11l9-5.5z"></path>
              </svg>
              `
                : `
              <svg class="timer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="7" y="6" width="3.5" height="12" rx="1"></rect>
                <rect x="13.5" y="6" width="3.5" height="12" rx="1"></rect>
              </svg>
              `}
            </button>
          </div>
          ${controls}
        </header>

        ${shouldHideVisualPanel
          ? ""
          : `
        <section class="panel visual-panel">
          ${visualPanelContent}
        </section>
        `}

        ${answerSummary}

        <section class="panel memo-panel">
          <div class="memo-list">${renderMemoList(state.session?.memoLog ?? [])}</div>
        </section>

        <div class="button-row button-row-start">
          ${isExamFailureAnswer ? "" : `
          <button class="secondary-button" data-action="go-home">メイン画面に戻る</button>
          `}
        </div>
      </main>
    </section>
  `;
}

function render(state) {
  if (state.screen === "role-select") {
    return renderRoleSelectScreen(state);
  }

  if (state.screen === "completion") {
    return renderCompletionScreen(state);
  }

  if (state.screen === "timeline") {
    return renderTimelineScreen(state);
  }

  return renderHomeScreen(state);
}

export function createApp(root) {
  const state = initializeStore();
  state.history = normalizeHistoryShape(state.history);
  state.ui ??= {};
  let tickHandle = null;
  let transitionLock = false;
  let examAnswerGuardTimeoutId = null;

  function normalizeSessionShape() {
    if (!state.session) {
      return;
    }

    state.session.mode = getSessionMode(state.session);
    state.session.memoLog ??= [];
    state.session.appliedMemoEventIds ??= [];
    state.session.results ??= {};
  }

  function persistSessionIfNeeded() {
    if (state.session) {
      updateSession(state.session);
    }
  }

  function persistCompletedSessionHistory() {
    if (!state.session) {
      return;
    }

    if (getSessionMode(state.session) !== "practice") {
      return;
    }

    state.history = upsertHistorySession(state.history, state.session);
    updateHistory(state.history);
  }

  function resetEventTimer() {
    if (!state.session) {
      return;
    }

    normalizeSessionShape();
    state.session.progress.eventStartedAt = Date.now();
    state.session.progress.timerStopped = false;
    state.session.progress.eventPausedAt = null;
    state.session.progress.eventTotalPausedMs = 0;
  }

  function ensureTimerRunningWhenToggleDisabled() {
    if (!state.session || state.screen !== "timeline") {
      return;
    }

    const event = getCurrentEvent(state);
    if (!isTimerToggleDisabled(state, event) || !state.session.progress.timerStopped) {
      return;
    }

    const pausedAt = state.session.progress.eventPausedAt ?? Date.now();
    state.session.progress.eventTotalPausedMs += Date.now() - pausedAt;
    state.session.progress.eventPausedAt = null;
    state.session.progress.timerStopped = false;
    persistSessionIfNeeded();
  }

  function moveToNextEvent() {
    if (!state.session) {
      return;
    }

    normalizeSessionShape();
    const currentEvent = getCurrentEvent(state);
    const sessionMode = getSessionMode(state.session);
    let nextEvent = null;

    if (currentEvent.kind === "question") {
      const result = buildQuestionResult(currentEvent, state.session);
      state.session.results[currentEvent.id] = result;
      const answerEvent = getNextPlayableEvent(currentEvent.id);

      if (sessionMode === "exam") {
        if (!result?.isCorrect) {
          if (answerEvent) {
            state.session.progress.currentEventId = answerEvent.id;
            resetEventTimer();
            persistSessionIfNeeded();
            refresh();
            return;
          }
        } else {
          nextEvent = answerEvent ? getNextPlayableEvent(answerEvent.id) : null;
        }
      } else {
        nextEvent = answerEvent;
      }
    } else {
      nextEvent = getNextPlayableEvent(currentEvent.id);
    }

    if (!nextEvent) {
      state.ui.examAnswerGuardUntil = 0;
      clearExamAnswerGuardTimer();
      persistSessionIfNeeded();
      persistCompletedSessionHistory();
      state.screen = "completion";
      refresh();
      return;
    }

    state.session.progress.currentEventId = nextEvent.id;
    resetEventTimer();
    armExamAnswerGuardIfNeeded(nextEvent);
    persistSessionIfNeeded();
    refresh();
  }

  function appendCurrentEventMemoIfNeeded() {
    if (!state.session || state.screen !== "timeline") {
      return;
    }

    normalizeSessionShape();
    const event = getCurrentEvent(state);
    const memoAppend = event?.memoAppend;

    if (!memoAppend?.resolver) {
      return;
    }

    const appliedKey = `${event.id}:${memoAppend.when}`;
    if (state.session.appliedMemoEventIds.includes(appliedKey)) {
      return;
    }

    const nextEntries = resolveMemoEntries(memoAppend.resolver, state.session);
    state.session.appliedMemoEventIds.push(appliedKey);

    if (nextEntries.length > 0) {
      state.session.memoLog.push(...nextEntries);
    }

    persistSessionIfNeeded();
  }

  function advanceByTimer() {
    if (!state.session || state.screen !== "timeline") {
      return;
    }

    const event = getCurrentEvent(state);

    if (!event?.durationMs || state.session.progress.timerStopped) {
      return;
    }

    const elapsedMs = getElapsedMs(state, event);
    if (elapsedMs >= event.durationMs) {
      moveToNextEvent();
      return;
    }
    updateProgressBar();
  }

  function updateProgressBar() {
    if (!state.session || state.screen !== "timeline") {
      return;
    }

    const event = getCurrentEvent(state);
    const progressBar = root.querySelector("[data-progress-bar]");

    if (!event?.durationMs || !progressBar) {
      return;
    }

    progressBar.style.width = `${getProgressPercent(state, event)}%`;
  }

  function syncTimerLoop() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }

    if (state.screen !== "timeline" || !state.session) {
      return;
    }

    const event = getCurrentEvent(state);
    if (!event?.durationMs) {
      return;
    }

    tickHandle = window.setInterval(() => {
      advanceByTimer();
    }, 200);
  }

  function clearExamAnswerGuardTimer() {
    if (examAnswerGuardTimeoutId) {
      clearTimeout(examAnswerGuardTimeoutId);
      examAnswerGuardTimeoutId = null;
    }
  }

  function isExamAnswerInputLocked() {
    return Number.isFinite(state.ui?.examAnswerGuardUntil) && Date.now() < state.ui.examAnswerGuardUntil;
  }

  function scheduleExamAnswerGuardRefresh() {
    clearExamAnswerGuardTimer();

    if (!isExamAnswerInputLocked()) {
      state.ui.examAnswerGuardUntil = 0;
      return;
    }

    examAnswerGuardTimeoutId = window.setTimeout(() => {
      examAnswerGuardTimeoutId = null;
      state.ui.examAnswerGuardUntil = 0;

      if (state.screen === "timeline") {
        refresh();
      }
    }, Math.max(0, state.ui.examAnswerGuardUntil - Date.now()));
  }

  function armExamAnswerGuardIfNeeded(event) {
    if (!state.session || getSessionMode(state.session) !== "exam" || event?.kind !== "question") {
      state.ui.examAnswerGuardUntil = 0;
      clearExamAnswerGuardTimer();
      return;
    }

    state.ui.examAnswerGuardUntil = Date.now() + EXAM_ANSWER_INPUT_GUARD_MS;
    scheduleExamAnswerGuardRefresh();
  }

  function performTransition(action) {
    if (transitionLock) {
      return;
    }

    transitionLock = true;

    try {
      action();
    } finally {
      queueMicrotask(() => {
        transitionLock = false;
      });
    }
  }

  function refresh() {
    appendCurrentEventMemoIfNeeded();
    ensureTimerRunningWhenToggleDisabled();
    root.innerHTML = render(state);
    bindEvents();
    syncTimerLoop();
  }

  function bindEvents() {
    root.querySelectorAll('[data-action="choice"]').forEach((button) => {
      button.addEventListener("click", () => {
        performTransition(() => {
          const value = button.dataset.value;

          if (state.screen === "role-select") {
            state.settings = persistRole(value);
            state.roleSelectMode = "change";
            state.screen = "home";
            refresh();
            return;
          }

          if (state.screen === "timeline" && state.session) {
            const event = getCurrentEvent(state);

            if (event.kind !== "question" || isExamAnswerInputLocked()) {
              return;
            }

            state.session.answers[event.id] = value;
            persistSessionIfNeeded();
            moveToNextEvent();
          }
        });
      });
    });

    root.querySelector('[data-action="start-practice-session"]')?.addEventListener("click", () => {
      performTransition(() => {
        const role = state.settings.role;
        if (!role) {
          state.roleSelectMode = "initial";
          state.screen = "role-select";
          refresh();
          return;
        }

        state.session = startSession(role, "practice");
        state.screen = "timeline";
        refresh();
      });
    });

    root.querySelector('[data-action="start-exam-session"]')?.addEventListener("click", () => {
      performTransition(() => {
        const role = state.settings.role;
        if (!role) {
          state.roleSelectMode = "initial";
          state.screen = "role-select";
          refresh();
          return;
        }

        state.session = startSession(role, "exam");
        state.screen = "timeline";
        refresh();
      });
    });

    root.querySelector('[data-action="change-role"]')?.addEventListener("click", () => {
      performTransition(() => {
        state.roleSelectMode = "change";
        state.screen = "role-select";
        refresh();
      });
    });

    root.querySelector('[data-action="reset-history"]')?.addEventListener("click", () => {
      if (!window.confirm("練習モードの正答率一覧をリセットしますか？")) {
        return;
      }

      state.history = resetHistory();
      refresh();
    });

    root.querySelector('[data-action="keep-role"]')?.addEventListener("click", () => {
      performTransition(() => {
        state.screen = "home";
        refresh();
      });
    });

    root.querySelector('[data-action="go-home"]')?.addEventListener("click", () => {
      if (!window.confirm("メイン画面に戻ると現在の進捗は保存されません。\nそれでもメイン画面に戻りますか？")) {
        return;
      }

      performTransition(() => {
        abandonSession();
        state.session = null;
        state.screen = "home";
        refresh();
      });
    });

    root.querySelector('[data-action="complete-home"]')?.addEventListener("click", () => {
      performTransition(() => {
        abandonSession();
        state.session = null;
        state.screen = "home";
        refresh();
      });
    });

    root.querySelector('[data-action="exam-home"]')?.addEventListener("click", () => {
      performTransition(() => {
        abandonSession();
        state.session = null;
        state.screen = "home";
        refresh();
      });
    });

    root.querySelector('[data-action="toggle-timer"]')?.addEventListener("click", () => {
      performTransition(() => {
        if (!state.session) {
          return;
        }

        if (isTimerToggleDisabled(state)) {
          return;
        }

        if (state.session.progress.timerStopped) {
          const pausedAt = state.session.progress.eventPausedAt ?? Date.now();
          state.session.progress.eventTotalPausedMs += Date.now() - pausedAt;
          state.session.progress.eventPausedAt = null;
          state.session.progress.timerStopped = false;
        } else {
          state.session.progress.eventPausedAt = Date.now();
          state.session.progress.timerStopped = true;
        }

        persistSessionIfNeeded();
        refresh();
      });
    });

    root.querySelector('[data-action="next-event"]')?.addEventListener("click", () => {
      performTransition(() => {
        moveToNextEvent();
      });
    });
  }

  refresh();
}
