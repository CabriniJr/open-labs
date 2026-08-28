function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Caminhos (em notação de ponto) que diferem entre dois estados.
 * Alimenta o destaque de mutação: o leitor aprende no delta, não no estado final.
 */
export function diffStates(before: unknown, after: unknown, path = ""): string[] {
  if (Object.is(before, after)) return [];

  const bothArrays = Array.isArray(before) && Array.isArray(after);
  const bothRecords = isRecord(before) && isRecord(after);

  if (bothArrays) {
    const paths: string[] = [];
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
      paths.push(...diffStates(before[i], after[i], path ? `${path}.${i}` : String(i)));
    }
    return paths;
  }

  if (bothRecords) {
    const paths: string[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      paths.push(...diffStates(before[key], after[key], path ? `${path}.${key}` : key));
    }
    return paths;
  }

  return [path];
}
