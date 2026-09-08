/**
 * O placar: quem acertou **de primeira**.
 *
 * A métrica é escolhida. Contar acertos totais recompensaria a segunda tentativa,
 * que é o hábito que este handbook não quer ensinar — é a mesma razão pela qual a
 * peça de predição não deixa trocar a resposta.
 *
 * Chave própria: `ovh:progress:v1` guarda quais labs foram lidos, e mexer nela
 * apagaria o progresso de quem já leu.
 */
export const CHAVE_DO_PLACAR = "ovh:placar:v1";

export type Resultado = "primeira" | "depois";
export type Placar = Readonly<Record<string, Resultado>>;

export function lerPlacar(): Placar {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DO_PLACAR);
    if (bruto === null) return {};
    const lido: unknown = JSON.parse(bruto);
    if (typeof lido !== "object" || lido === null) return {};
    const saida: Record<string, Resultado> = {};
    for (const [chave, valor] of Object.entries(lido as Record<string, unknown>)) {
      if (valor === "primeira" || valor === "depois") saida[chave] = valor;
    }
    return saida;
  } catch {
    return {};
  }
}

export function registrar(exercicio: string, acertou: boolean): void {
  const atual = lerPlacar();
  // A primeira resposta é a que vale, e ela não se refaz. Uma segunda chamada
  // para o mesmo exercício não muda nada.
  if (atual[exercicio] !== undefined) return;
  try {
    window.localStorage.setItem(
      CHAVE_DO_PLACAR,
      JSON.stringify({ ...atual, [exercicio]: acertou ? "primeira" : "depois" }),
    );
  } catch {
    // Modo privado ou storage cheio: o exercício segue funcionando sem memória.
  }
}
