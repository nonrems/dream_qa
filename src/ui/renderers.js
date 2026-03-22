function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMemoText(item) {
  const text = String(item ?? "");

  if (["炎", "風", "土", "闇", "光耐性低下あり", "光耐性低下なし"].includes(text)) {
    return "";
  }

  if (text === "十字" || text === "X字" || text.startsWith("-----")) {
    return text;
  }

  return `-----\n${text}`;
}

function renderChoiceLabel(option) {
  const value = String(option ?? "");

  if (value === "12") {
    return `<span class="choice-inline-pair"><span class="choice-token token-1">1</span><span class="choice-token token-2">2</span></span>`;
  }

  if (value === "34") {
    return `<span class="choice-inline-pair"><span class="choice-token token-3">3</span><span class="choice-token token-4">4</span></span>`;
  }

  return escapeHtml(value);
}

function renderChoiceButton(option, selectedValue = null, disabled = false) {
  const selectedClass = selectedValue === option ? " is-selected" : "";
  const disabledAttrs = disabled ? ' disabled aria-disabled="true"' : "";

  return `
    <button class="choice-button${selectedClass}" data-action="choice" data-value="${escapeHtml(option)}"${disabledAttrs}>
      ${renderChoiceLabel(option)}
    </button>
  `;
}

export function renderChoiceButtons(options, selectedValue = null, disabled = false) {
  return options
    .map((option) => renderChoiceButton(option, selectedValue, disabled))
    .join("");
}

export function renderChoiceGrid(layout, options, selectedValue = null, disabled = false) {
  if (layout === "grid-position-8") {
    const arranged = ["1", "A", "2", "D", null, "B", "4", "C", "3"];

    return arranged
      .map((option) => {
        if (option == null) {
          return `<div class="choice-grid-gap" aria-hidden="true"></div>`;
        }

        return renderChoiceButton(option, selectedValue, disabled);
      })
      .join("");
  }

  return renderChoiceButtons(options, selectedValue, disabled);
}

export function renderMemoList(memoLog) {
  if (!memoLog.length) {
    return `<div class="memo-empty">まだメモはありません</div>`;
  }

  return memoLog
    .map((item) => formatMemoText(item))
    .filter(Boolean)
    .map((item) => `<div class="memo-item">${escapeHtml(item)}</div>`)
    .join("");
}

export function renderProgressBar(progressPercent) {
  const width = Math.max(0, Math.min(100, progressPercent));
  return `
    <div class="time-progress" aria-label="制限時間">
      <div class="time-progress-bar" data-progress-bar style="width: ${width}%;"></div>
    </div>
  `;
}
