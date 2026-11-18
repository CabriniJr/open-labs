import {
  analisar,
  carregarBase,
  ErroDoModelo,
  filmeDoRetorno,
  metricasDeClassificacao,
  retornoPorCaminhada,
  VARIAVEIS_DA_LOGISTICA,
  type Analise,
  type Base,
  type DetalheDoRetorno,
  type Divisao,
  type Variavel,
} from "@ovh/ds-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useEffect, useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

const ROTULO: Record<Variavel, string> = {
  idade: "age",
  minutos_caminhada: "minutes walking",
  labs_concluidos_antes: "labs done before",
  ritmo: "pace (time ÷ expected)",
  minutos_estimados: "lab length",
  nota: "grade (logistic only)",
  internet_em_casa: "internet at home",
  usou_showcase: "watched the showcase",
  periodo: "time of day",
  handbook: "handbook",
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function useBase(): Base | null {
  const [base, setBase] = useState<Base | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarBase().then((b) => vivo && setBase(b));
    return () => {
      vivo = false;
    };
  }, []);
  return base;
}

function Vitrine() {
  const base = useBase();
  const filme = useMemo(() => (base === null ? null : filmeDoRetorno(base)), [base]);
  if (filme === null) return <p className="algo-nota">Loading 1,247 sessions…</p>;
  return (
    <div className="cpuvit algo" data-testid="return-showcase">
      <MotionPlayer
        film={filme}
        label="Study sessions at the telecentre: minutes walking against grade. A split by person, a linear regression for the grade, a logistic regression for coming back, and the confusion matrix."
        renderDetail={(frame) => {
          const d: DetalheDoRetorno | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="algo-h">
                {d.sessoes} sessions · {d.pessoas} people
              </p>
              {d.treino !== null && d.teste !== null ? (
                <p className="algo-nota mono">
                  train {d.treino.sessoes} ({d.treino.pessoas} people) · test {d.teste.sessoes} ({d.teste.pessoas} people)
                </p>
              ) : null}
              {d.regressao !== null ? (
                <dl className="algo-linhas">
                  <div>
                    <dt>MAE</dt>
                    <dd className="mono">{d.regressao.MAE.toFixed(2)} points</dd>
                  </div>
                  <div>
                    <dt>RMSE</dt>
                    <dd className="mono">{d.regressao.RMSE.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>R²</dt>
                    <dd className="mono">
                      {d.regressao.R2.toFixed(3)} (average: {d.regressao.R2DaMedia.toFixed(3)})
                    </dd>
                  </div>
                </dl>
              ) : null}
              {d.curva !== null ? (
                <p className="algo-nota mono">
                  walk 0 min → {pct(d.curva[0]!.retorno)} · 20 min → {pct(d.curva[10]!.retorno)} · 40 min → {pct(d.curva[20]!.retorno)}
                </p>
              ) : null}
              {d.classificacao !== null ? (
                <dl className="algo-linhas">
                  <div>
                    <dt>precision</dt>
                    <dd className="mono">{d.classificacao.precisao.toFixed(3)}</dd>
                  </div>
                  <div>
                    <dt>recall</dt>
                    <dd className="mono">{d.classificacao.recall.toFixed(3)}</dd>
                  </div>
                  <div>
                    <dt>F1</dt>
                    <dd className="mono">{d.classificacao.F1.toFixed(3)}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}

function Dispersao({ a }: { a: Analise }) {
  const W = 320;
  const H = 320;
  const pad = 30;
  const x = (v: number) => pad + (v / 10) * (W - 2 * pad);
  const y = (v: number) => H - pad - (Math.min(Math.max(v, 0), 10) / 10) * (H - 2 * pad);
  return (
    <svg className="algo-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Real grade against predicted grade for ${a.partes.teste.length} test sessions`} style={{ maxWidth: "22rem" }}>
      <line x1={x(0)} y1={y(0)} x2={x(10)} y2={y(10)} stroke="var(--ink-faint)" strokeDasharray="4 4" />
      {a.partes.teste.map((s, i) => (
        <circle key={i} cx={x(s.nota)} cy={y(a.notaPrevista[i]!)} r={2.6} fill="var(--dui-especie-2)" fillOpacity={0.55} />
      ))}
      <text x={W / 2} y={H - 6} className="algo-rotulo algo-fraco">
        real grade
      </text>
      <text x={12} y={H / 2} className="algo-rotulo algo-fraco" transform={`rotate(-90 12 ${H / 2})`}>
        predicted
      </text>
    </svg>
  );
}

function Simulacao() {
  const base = useBase();
  const [divisao, setDivisao] = useState<Divisao>("pessoa");
  const [fora, setFora] = useState<ReadonlySet<Variavel>>(new Set());
  const [corte, setCorte] = useState(0.5);
  const r = useMemo(() => {
    if (base === null) return null;
    const usar = (lista: readonly Variavel[]) => lista.filter((v) => !fora.has(v));
    try {
      const a = analisar(base, { divisao, linear: usar(VARIAVEIS_DA_LOGISTICA.filter((v) => v !== "nota")), logistica: usar(VARIAVEIS_DA_LOGISTICA) });
      return { a, curva: retornoPorCaminhada(a, [0, 10, 20, 30, 40]) };
    } catch (e) {
      return { erro: e instanceof ErroDoModelo ? e.message : String(e) };
    }
  }, [base, divisao, fora]);

  if (r === null) return <p className="algo-nota">Loading 1,247 sessions…</p>;
  const controles = (
    <div className="algo-controles">
      <div className="algo-seg" role="group" aria-label="Train/test split">
        <button type="button" aria-pressed={divisao === "pessoa"} onClick={() => setDivisao("pessoa")}>
          Split by person
        </button>
        <button type="button" aria-pressed={divisao === "linha"} onClick={() => setDivisao("linha")}>
          Split by row (leaks)
        </button>
      </div>
      <fieldset>
        <legend>Input variables</legend>
        {VARIAVEIS_DA_LOGISTICA.map((v) => (
          <label key={v}>
            <input
              type="checkbox"
              checked={!fora.has(v)}
              onChange={(e) => {
                const s = new Set(fora);
                if (e.target.checked) s.delete(v);
                else s.add(v);
                setFora(s);
              }}
            />
            {ROTULO[v]}
          </label>
        ))}
      </fieldset>
    </div>
  );
  if ("erro" in r) {
    return (
      <div className="algo" data-testid="return-sim">
        {controles}
        <p className="algo-erro" role="alert">
          {r.erro}
        </p>
      </div>
    );
  }
  const { a, curva } = r;
  const y = a.partes.teste.map((s) => s.voltou_em_7_dias);
  const m = metricasDeClassificacao(y, a.probabilidade, corte);
  // A classe da ação: quem NÃO vai voltar recebe o lembrete.
  const avisados = m.vn + m.fn;
  const precisaoAviso = avisados === 0 ? 0 : m.vn / avisados;
  const recallAviso = m.vn + m.fp === 0 ? 0 : m.vn / (m.vn + m.fp);
  const coef = a.linear.nomes.map((n, k) => ({ n, w: a.linear.pesos[k]! })).sort((p, q) => Math.abs(q.w) - Math.abs(p.w));
  const coefLog = a.logistica.nomes.map((n, k) => ({ n, w: a.logistica.pesos[k]! })).sort((p, q) => Math.abs(q.w) - Math.abs(p.w));

  return (
    <div className="algo" data-testid="return-sim">
      {controles}
      <p className="algo-veredito" data-ok={a.partes.pessoasNosDois === 0 ? "" : undefined} aria-live="polite">
        {a.partes.pessoasNosDois === 0
          ? `No one is in both sets: ${a.partes.treino.length} training sessions, ${a.partes.teste.length} test sessions of people the model never saw.`
          : `${a.partes.pessoasNosDois} people have sessions in both sets. The test no longer measures how the model does on someone new, whatever the scores below say.`}
      </p>

      <div className="algo-dois">
        <section className="algo-cartao" aria-label="Linear regression">
          <h3>Linear regression — the grade</h3>
          <dl className="algo-linhas" data-testid="return-linear">
            <div>
              <dt>MAE</dt>
              <dd className="mono">
                {a.regressao.MAE.toFixed(3)} (average: {a.linhaDeBase.MAE.toFixed(3)})
              </dd>
            </div>
            <div>
              <dt>RMSE</dt>
              <dd className="mono">
                {a.regressao.RMSE.toFixed(3)} (average: {a.linhaDeBase.RMSE.toFixed(3)})
              </dd>
            </div>
            <div>
              <dt>R²</dt>
              <dd className="mono">{a.regressao.R2.toFixed(3)}</dd>
            </div>
          </dl>
          <Dispersao a={a} />
          <div className="algo-tabela">
            <table>
              <caption>Coefficients, biggest first (numeric inputs: per standard deviation)</caption>
              <tbody>
                {coef.map((c) => (
                  <tr key={c.n}>
                    <td>{c.n}</td>
                    <td className="num mono">{c.w >= 0 ? "+" : ""}{c.w.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="algo-cartao" aria-label="Logistic regression">
          <h3>Logistic regression — coming back in 7 days</h3>
          <div className="algo-controles">
            <label>
              Cut-off: {corte.toFixed(2)}
              <input type="range" min={0.05} max={0.95} step={0.05} value={corte} onChange={(e) => setCorte(Number(e.target.value))} aria-label="Cut-off probability" />
            </label>
          </div>
          <div className="algo-tabela">
            <table data-testid="return-matrix">
              <caption>Confusion matrix · {a.partes.teste.length} test sessions</caption>
              <thead>
                <tr>
                  <th scope="col">real \ predicted</th>
                  <th scope="col" className="num">
                    stays away
                  </th>
                  <th scope="col" className="num">
                    comes back
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">stays away</th>
                  <td className="num mono">{m.vn}</td>
                  <td className="num mono">{m.fp}</td>
                </tr>
                <tr>
                  <th scope="row">comes back</th>
                  <td className="num mono">{m.fn}</td>
                  <td className="num mono">{m.vp}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="algo-linhas" data-testid="return-logistic">
            <div>
              <dt>accuracy</dt>
              <dd className="mono">{m.acuracia.toFixed(3)}</dd>
            </div>
            <div>
              <dt>precision · recall · F1 (comes back)</dt>
              <dd className="mono">
                {m.precisao.toFixed(3)} · {m.recall.toFixed(3)} · {m.F1.toFixed(3)}
              </dd>
            </div>
            <div>
              <dt>reminders sent (predicted to stay away)</dt>
              <dd className="mono">
                {avisados} · reaches {pct(recallAviso)} of those who stay away · {pct(precisaoAviso)} of reminders hit
              </dd>
            </div>
          </dl>
          <div className="algo-tabela">
            <table>
              <caption>Predicted return for the same test people, changing only the walk</caption>
              <tbody>
                <tr>
                  {[0, 10, 20, 30, 40].map((mm, i) => (
                    <td key={mm} className="num mono">
                      {mm} min: {pct(curva[i]!)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="algo-tabela">
            <table>
              <caption>Coefficients (log-odds), biggest first</caption>
              <tbody>
                {coefLog.map((c) => (
                  <tr key={c.n}>
                    <td>{c.n}</td>
                    <td className="num mono">{c.w >= 0 ? "+" : ""}{c.w.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <p className="algo-nota">
        The same two models as the team's notebook (scikit-learn), refitted here on every change: least squares for the grade, ridge-penalised logistic regression (C = 1) by Newton&apos;s method for coming back. With every input ticked and the split by person, the coefficients match the notebook&apos;s.
      </p>
    </div>
  );
}

export function RetornoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
