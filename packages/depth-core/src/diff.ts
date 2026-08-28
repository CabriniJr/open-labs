function isRecord(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Caminhos (em notação de ponto) que diferem entre dois estados.
 * Alimenta o destaque de mutação: o leitor aprende no delta, não no estado final.
 *
 * Contrato: estados devem ser dados simples (objetos simples, arrays, primitivos).
 * `isRecord` só desce em objetos simples — qualquer outro tipo de objeto (`Date`,
 * `Map`, `Set`, instâncias de classe...) já falhou o `Object.is` inicial e cai
 * direto no ramo escalar, sendo reportado como alterado. Isso troca um possível
 * falso positivo (duas `Date` iguais reportadas como diferentes) por nunca ter
 * um falso negativo silencioso — para um destaque visual, piscar de leve a mais
 * é infinitamente melhor que não piscar.
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
