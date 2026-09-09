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
 *
 * **Lacuna declarada: o caminho é codificação com perda.** Juntar as chaves com
 * ponto apaga a fronteira entre aninhamento e ponto DENTRO do nome da chave:
 * `{ a: { b: { c: 1 } } }` e `{ a: { "b.c": 1 } }` produzem os dois o mesmo
 * `"a.b.c"`, e nada aqui para baixo consegue desfazer isso. Num corpo que tenha
 * as duas formas colidindo na mesma string, o destaque acende as duas linhas
 * quando só uma mudou.
 *
 * Fica registrada e não consertada de propósito: é o MESMO trato do parágrafo
 * acima — falso positivo em vez de falso negativo —, e é raro. Consertar de
 * verdade é o caminho deixar de ser string e virar lista de chaves
 * (`["a", "b.c"]`), o que mexe aqui, no `Inspector` e em todo mundo que produz
 * ou consome `changedPaths`. No dia em que um lab tiver a colisão de verdade na
 * tela, este comentário é o lugar de onde a conversa recomeça.
 *
 * Não confundir com o defeito que ESTE comentário nasceu junto de: o `Inspector`
 * redesenhava o rótulo cortando o caminho no último ponto, e por isso mostrava
 * `casa.numero` como `numero` — corpo que não era o corpo, em toda chave com
 * ponto. Aquilo era bug e foi consertado; isto aqui é limite, e é conhecido.
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
