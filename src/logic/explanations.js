export function buildGenericExplanation({ correctAnswer, selectedAnswer, timedOut }) {
  if (timedOut) {
    return `時間切れです。正解は「${correctAnswer ?? "未設定"}」です。`;
  }

  if (selectedAnswer == null) {
    return `正解は「${correctAnswer ?? "未設定"}」です。`;
  }

  return `あなたの回答は「${selectedAnswer}」、正解は「${correctAnswer ?? "未設定"}」です。`;
}
