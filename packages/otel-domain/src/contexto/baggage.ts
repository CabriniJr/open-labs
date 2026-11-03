/**
 * O header `baggage` do W3C: pares `chave=valor` separados por vírgula, com o
 * valor codificado como em URL. Propriedades (`;prop`) são lidas e descartadas —
 * o lab não precisa delas, e fingir suporte seria pior do que dizer que não há.
 * Spec: https://www.w3.org/TR/baggage/#header-content
 */
export type Baggage = Readonly<Record<string, string>>;

export function formatBaggage(baggage: Baggage): string {
  return Object.entries(baggage)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join(",");
}

export function parseBaggage(header: string | undefined): Baggage {
  if (header === undefined || header.trim() === "") return {};
  const out: Record<string, string> = {};
  for (const member of header.split(",")) {
    const [pair] = member.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (pair === undefined || eq <= 0) continue;
    const key = pair.slice(0, eq).trim();
    if (key === "") continue;
    try {
      out[key] = decodeURIComponent(pair.slice(eq + 1).trim());
    } catch {
      // Valor mal codificado: o membro é ignorado, como manda a spec.
    }
  }
  return out;
}
