export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNum: { old?: number; new?: number };
}

export function diffLines(fromLines: string[], toLines: string[]): DiffLine[] {
  const m = fromLines.length;
  const n = toLines.length;
  const maxLen = Math.max(m, n);

  if (maxLen > 5000) {
    const lines: DiffLine[] = [];
    const max = Math.max(m, n);
    for (let i = 0; i < max; i++) {
      if (i < m && i < n && fromLines[i] === toLines[i]) {
        lines.push({ type: 'unchanged', content: fromLines[i], lineNum: { old: i + 1, new: i + 1 } });
      } else {
        if (i < m) lines.push({ type: 'removed', content: fromLines[i], lineNum: { old: i + 1 } });
        if (i < n) lines.push({ type: 'added', content: toLines[i], lineNum: { new: i + 1 } });
      }
    }
    return lines;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (fromLines[i - 1] === toLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && fromLines[i - 1] === toLines[j - 1]) {
      result.push({ type: 'unchanged', content: fromLines[i - 1], lineNum: { old: i, new: j } });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', content: toLines[j - 1], lineNum: { new: j } });
      j--;
    } else {
      result.push({ type: 'removed', content: fromLines[i - 1], lineNum: { old: i } });
      i--;
    }
  }
  result.reverse();
  return result;
}
