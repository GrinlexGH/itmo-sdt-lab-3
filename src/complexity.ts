export function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') {
        j++;
      }
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }
    // raw string literal: R"delim( ... )delim"
    if (c === 'R' && next === '"' && !/[A-Za-z0-9_]/.test(src[i - 1] ?? '')) {
      const open = src.indexOf('(', i + 2);
      if (open !== -1) {
        const delim = src.slice(i + 2, open);
        const close = src.indexOf(')' + delim + '"', open);
        const j = close === -1 ? n : close + delim.length + 2;
        out += blank(src.slice(i, j));
        i = j;
        continue;
      }
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          j++;
        }
        j++;
      }
      j = Math.min(j + 1, n);
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const DECISION = /\b(?:if|for|while|case|catch)\b|&&|\|\||\?/g;

export function cyclomaticComplexity(code: string): number {
  const clean = stripCommentsAndStrings(code);
  return 1 + (clean.match(DECISION)?.length ?? 0);
}

export function hasBody(code: string): boolean {
  return stripCommentsAndStrings(code).includes('{');
}
