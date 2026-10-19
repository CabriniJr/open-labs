import { useMemo, useState } from "react";
import {
  ATRIBUTOS_DA_CARDINALIDADE,
  calcular,
  fatorDeEntrada,
  type Atributo,
  type TipoDeMetrica,
} from "@ovh/otel-domain";

/**
 * Cardinalidade e a conta — e este componente **não importa o motor**.
 *
 * É a §9 do `DECISIONS.md` aplicada: o assunto não é fluxo, então não há palco,
 * não há árvore de composição e não há `kinds`. O que há é manipulação direta e
 * resposta imediata, que é o que um lab do PhET faz.
 *
 * A decisão de desenho que carrega o lab: **o produto aparece como produto.**
 * `12 × 6 × 4 × 8 000 = 2 304 000` numa linha é o argumento inteiro — quem lê
 * isso vê a multiplicação acontecendo, e nenhuma frase precisa dizer que
 * atributo não é coluna. Mostrar só o total esconderia justamente o mecanismo.
 *
 * E o preço: o campo é do leitor. O lab calcula volume, que é mecânico, e
 * multiplica pelo número que a pessoa tira da fatura dela. Afirmar um preço de
 * fornecedor aqui seria o defeito que a ADR chama de mais caro do projeto.
 */

const TIPOS: readonly { readonly id: TipoDeMetrica; readonly nome: string }[] = [
  { id: "counter", nome: "Counter" },
  { id: "gauge", nome: "Gauge" },
  { id: "histogram", nome: "Histogram" },
];

/** Os baldes padrão do SDK para duração de requisição. */
const BALDES_PADRAO = 11;

/** O limite padrão do SDK por stream de métrica. */
const LIMITE_PADRAO = 2000;

const numero = (n: number): string => n.toLocaleString("en-US");

const compacto = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`
    : n >= 1000
      ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
      : numero(n);

export function CardinalidadeLab() {
  /** Começa com os três da convenção semântica: é a métrica honesta mínima. */
  const [ligados, setLigados] = useState<readonly string[]>(
    ATRIBUTOS_DA_CARDINALIDADE.filter((a) => a.daConvencao === true).map((a) => a.id),
  );
  const [valores, setValores] = useState<Readonly<Record<string, number>>>(
    Object.fromEntries(ATRIBUTOS_DA_CARDINALIDADE.map((a) => [a.id, a.valores])),
  );
  const [tipo, setTipo] = useState<TipoDeMetrica>("histogram");
  const [baldes, setBaldes] = useState(BALDES_PADRAO);
  const [exportacoes, setExportacoes] = useState(4);
  const [limite, setLimite] = useState(LIMITE_PADRAO);
  const [comLimite, setComLimite] = useState(false);
  /** Vazio é o estado honesto: o lab não sabe o preço de ninguém. */
  const [precoPorMilhao, setPrecoPorMilhao] = useState("");

  /** Os atributos com a contagem que o leitor editou. */
  const atributos: readonly Atributo[] = useMemo(
    () =>
      ATRIBUTOS_DA_CARDINALIDADE.map((a) => ({
        ...a,
        valores: valores[a.id] ?? a.valores,
      })),
    [valores],
  );

  const escolhidos = atributos.filter((a) => ligados.includes(a.id));
  const conta = calcular(
    escolhidos,
    tipo,
    baldes,
    exportacoes,
    comLimite ? limite : Number.MAX_SAFE_INTEGER,
  );

  const alternar = (id: string): void => {
    setLigados((atuais) =>
      atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
    );
  };

  const mudarValores = (id: string, valor: number): void => {
    setValores((v) => ({ ...v, [id]: Math.max(1, Math.trunc(valor)) }));
  };

  const preco = Number.parseFloat(precoPorMilhao.replace(",", "."));
  const temPreco = Number.isFinite(preco) && preco > 0;
  const porMes = conta.pontosPorMinuto * 60 * 24 * 30;

  return (
    <div className="cardinalidade">
      <div className="cardinalidade__conta">
        <p className="cardinalidade__pergunta">
          I want latency broken down by customer. <b>What does that cost?</b>
        </p>

        {/*
          O produto como produto. É a peça central da tela: a multiplicação
          escrita por extenso é o argumento, e o total sozinho seria só um
          número grande sem mecanismo.
        */}
        <p className="cardinalidade__produto mono" data-vazio={escolhidos.length === 0}>
          {escolhidos.length === 0 ? (
            <span className="cardinalidade__fator">1 series — a metric with no attributes</span>
          ) : (
            <>
              {escolhidos.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && <span className="cardinalidade__vezes"> × </span>}
                  <span
                    className="cardinalidade__fator"
                    data-grande={fatorDeEntrada(a) >= 100 ? "true" : undefined}
                    title={a.nome}
                  >
                    {numero(fatorDeEntrada(a))}
                  </span>
                </span>
              ))}
              <span className="cardinalidade__igual"> = </span>
              <b>{numero(conta.series)}</b>
              <span className="cardinalidade__unidade"> series</span>
            </>
          )}
        </p>

        <dl className="cardinalidade__numeros">
          <div>
            <dt>streams that exist</dt>
            <dd className="mono">
              {numero(conta.seriesEfetivas)}
              {conta.estourouOLimite && <span className="cardinalidade__tampado"> capped</span>}
            </dd>
          </div>
          <div>
            <dt>points per stream</dt>
            <dd className="mono">{numero(conta.pontosPorSerie)}</dd>
          </div>
          <div>
            <dt>data points / minute</dt>
            <dd className="mono">{compacto(conta.pontosPorMinuto)}</dd>
          </div>
          <div>
            <dt>data points / month</dt>
            <dd className="mono">{compacto(porMes)}</dd>
          </div>
        </dl>

        {conta.estourouOLimite && (
          <p className="cardinalidade__aviso">
            The limit is holding your bill at {numero(conta.seriesEfetivas)} streams — and{" "}
            <b>{numero(conta.semQuebra)}</b> attribute sets no longer have one. They fold into a
            single <code>otel.metric.overflow</code> stream: nothing is lost, nothing is
            double-counted, and <b>the breakdown you added the attribute for is gone</b>. You are
            paying to instrument a question you can no longer ask.
          </p>
        )}

        <label className="cardinalidade__preco">
          <span>
            Your price per million data points — from <b>your</b> invoice, because this lab does
            not know it
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 0.50"
            value={precoPorMilhao}
            onChange={(ev) => setPrecoPorMilhao(ev.target.value)}
            aria-label="price per million data points"
          />
          <output className="mono">
            {temPreco
              ? `${((porMes / 1_000_000) * preco).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })} / month`
              : "— fill it in and the volume above becomes a number you can take to a meeting"}
          </output>
        </label>
      </div>

      <div className="cardinalidade__controles">
        <fieldset className="cardinalidade__atributos">
          <legend>Attributes on the measurement</legend>
          {atributos.map((a) => {
            const ligado = ligados.includes(a.id);
            return (
              <div className="cardinalidade__atributo" key={a.id} data-ligado={ligado}>
                <label className="cardinalidade__nome">
                  <input type="checkbox" checked={ligado} onChange={() => alternar(a.id)} />
                  <code>{a.nome}</code>
                  {a.daConvencao === true && (
                    <span className="cardinalidade__selo" title="part of the semantic convention">
                      semconv
                    </span>
                  )}
                </label>
                <label className="cardinalidade__valores">
                  <span>distinct values in production</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={valores[a.id] ?? a.valores}
                    onChange={(ev) => mudarValores(a.id, Number(ev.target.value))}
                    aria-label={`distinct values of ${a.nome}`}
                  />
                </label>
                <p className="cardinalidade__porque">
                  {a.porque}{" "}
                  <a href={a.fonte} rel="noreferrer noopener" target="_blank">
                    spec
                  </a>
                </p>
              </div>
            );
          })}
        </fieldset>

        <fieldset className="cardinalidade__instrumento">
          <legend>The instrument</legend>
          <label className="cardinalidade__campo">
            <span>kind</span>
            <select value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoDeMetrica)}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>

          {tipo === "histogram" && (
            <label className="cardinalidade__campo">
              <span>
                explicit buckets <b className="mono">{baldes}</b>
              </span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={baldes}
                onChange={(ev) => setBaldes(Number(ev.target.value))}
              />
            </label>
          )}

          <label className="cardinalidade__campo">
            <span>
              exports per minute <b className="mono">{exportacoes}</b>
            </span>
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={exportacoes}
              onChange={(ev) => setExportacoes(Number(ev.target.value))}
            />
          </label>

          <label className="cardinalidade__switch">
            <input
              type="checkbox"
              checked={comLimite}
              onChange={(ev) => setComLimite(ev.target.checked)}
            />
            apply <code>cardinality_limit</code>
          </label>

          {comLimite && (
            <label className="cardinalidade__campo">
              <span>
                limit <b className="mono">{numero(limite)}</b>
              </span>
              <input
                type="range"
                min={1}
                max={10_000}
                step={1}
                value={limite}
                onChange={(ev) => setLimite(Number(ev.target.value))}
              />
            </label>
          )}
        </fieldset>
      </div>
    </div>
  );
}
