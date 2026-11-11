import {
  CABECALHO,
  CAIXA_DO_APP,
  CAIXAS_DO_BANCO,
  GRUPO,
  ICONE_APP,
  ICONES_BANCO,
  LIGACOES_DO_BANCO,
  LINHA,
  TABELAS,
  TOM_DO_GRUPO,
  type DetalheDoBanco,
  type LigacaoDoBanco,
  type NomeDaTabela,
  type Tabela,
} from "@ovh/database-domain";
import { pathD, poseAt, viewBox, type Animatable, type Film, type Frame, type Glyph } from "@ovh/motion";
import { memo, type ReactNode } from "react";

/**
 * A vista Diagrama: o filme do banco desenhado como um diagrama entidade-
 * relacionamento. Cada tabela é um cartão com as colunas, a chave primária
 * (PK), as estrangeiras (FK) e os valores únicos (UK); cada FK é uma linha da
 * coluna até a chave do pai, com a notação pé de galinha — o garfo do lado
 * "muitos", os dois traços do lado "exatamente um", o círculo quando o muitos
 * pode ser zero.
 *
 * Posições, ligações e fichas vêm do mesmo filme (`filmeDoBanco`): as fichas
 * andam pelo caminho que o modelo decidiu, no mesmo relógio das outras vistas.
 * As colunas que o passo menciona acendem (`detail.realce`). O tipo de cada
 * coluna só aparece com a câmera perto: no quadro inteiro ele virava ruído.
 *
 * SVG puro, sem filtro. A cor de cada peça é o tom dela (`data-tone`).
 */

type Estado = Readonly<Animatable>;

export function Icone({ g, x, y, s }: { g: Glyph; x: number; y: number; s: number }) {
  return (
    <g className="bd-icone" transform={`translate(${x} ${y}) scale(${s / 24})`}>
      {g.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {(g.fill ?? []).map((d) => (
        <path key={d} d={d} className="bd-icone-cheio" />
      ))}
    </g>
  );
}

export type Sigla = "PK" | "FK" | "UK";

/** O papel de cada coluna, em sigla: chave primária, estrangeira, única. Cada sigla tem a sua cor. */
export function siglas(t: Tabela, coluna: string): Sigla[] {
  const fk = (t.fks ?? []).some((f) => f.coluna === coluna);
  const uk = t.colunas.find((c) => c.nome === coluna)?.unico === true || (t.unicos ?? []).some((u) => u.includes(coluna));
  const lista: Sigla[] = [];
  if (coluna === t.pk) lista.push("PK");
  if (fk) lista.push("FK");
  if (uk && coluna !== t.pk) lista.push("UK");
  return lista;
}

const tipoCurto = (tipo: string) => tipo.replace(/\s/gu, "");

const Cartao = memo(function Cartao({ t, glow, dim, ping, tone, sublabel, realce, tipos }: { t: Tabela; glow: number; dim: number; ping: number; tone: string; sublabel: string; realce: string; tipos: boolean }) {
  const b = CAIXAS_DO_BANCO[t.nome];
  const acesas = new Set(realce.split(",").filter((r) => r.startsWith(`${t.nome}.`)).map((r) => r.slice(t.nome.length + 1)));
  return (
    <g className="bd-tabela" data-tone={tone} data-aceso={glow > 0.05 ? "" : undefined} opacity={1 - dim * 0.62} transform={`translate(${b.x} ${b.y})`}>
      {ping > 0 && ping < 1 ? <rect className="bd-ping" x={-ping * 18} y={-ping * 18} width={b.w + ping * 36} height={b.h + ping * 36} rx={12} opacity={1 - ping} /> : null}
      <rect className="bd-corpo" width={b.w} height={b.h} rx={8} />
      <path className="bd-cabeca" d={`M 0 8 a 8 8 0 0 1 8 -8 H ${b.w - 8} a 8 8 0 0 1 8 8 V ${CABECALHO - 4} H 0 Z`} />
      <Icone g={ICONES_BANCO[t.nome]} x={8} y={6} s={18} />
      <text className="bd-nome" x={32} y={20} data-no-translate="">
        {t.nome}
      </text>
      <text className="bd-qtd" x={b.w - 8} y={20}>
        {sublabel}
      </text>
      {t.colunas.map((c, i) => {
        const y = CABECALHO + i * LINHA;
        const s = siglas(t, c.nome);
        const aceso = acesas.has(c.nome);
        return (
          <g key={c.nome} className="bd-coluna" data-no-translate="" data-aceso={aceso ? "" : undefined} data-pk={c.nome === t.pk ? "" : undefined}>
            {aceso ? <rect className="bd-realce" x={2} y={y} width={b.w - 4} height={LINHA} rx={3} /> : null}
            {s.map((sigla, k) => (
              <text key={sigla} className="bd-sigla" data-sigla={sigla} x={6 + k * 17} y={y + 11}>
                {sigla}
              </text>
            ))}
            <text className="bd-col" x={44} y={y + 11}>
              {c.nome}
              {c.nulo === true ? "?" : ""}
            </text>
            {tipos ? (
              <text className="bd-tipo" x={b.w - 7} y={y + 11}>
                {tipoCurto(c.tipo)}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
});

/** O pé de galinha numa ponta da ligação: `s` é para que lado a linha sai da caixa. */
function Pontas({ l }: { l: LigacaoDoBanco }) {
  const { x: fx, y: fy } = l.naFilha;
  const sf = l.saidaFilha;
  const { x: px, y: py } = l.noPai;
  const sp = l.saidaPai;
  return (
    <g className="bd-pontas">
      {/* lado "muitos": o garfo encostado na tabela-filha */}
      <path d={`M ${fx + sf * 13} ${fy} L ${fx} ${fy - 6} M ${fx + sf * 13} ${fy} L ${fx} ${fy} M ${fx + sf * 13} ${fy} L ${fx} ${fy + 6}`} />
      {l.minimo === 0 ? <circle className="bd-zero" cx={fx + sf * 18} cy={fy} r={3.6} /> : <path d={`M ${fx + sf * 17} ${fy - 6} V ${fy + 6}`} />}
      {/* lado "exatamente um": dois traços no pai */}
      <path d={`M ${px + sp * 6} ${py - 6} V ${py + 6} M ${px + sp * 11} ${py - 6} V ${py + 6}`} />
      {/* a cardinalidade escrita, além do desenho: "1" no pai, "0..N" ou "1..N" na filha */}
      <text className="bd-card" x={px + sp * 8} y={py - 9} style={{ textAnchor: sp > 0 ? "start" : "end" }}>
        1
      </text>
      <text className="bd-card" x={fx + sf * 8} y={fy - 9} style={{ textAnchor: sf > 0 ? "start" : "end" }}>
        {l.minimo === 1 ? "1..N" : "0..N"}
      </text>
    </g>
  );
}

/**
 * A legenda do diagrama: o que cada marca quer dizer. Fica no alto, acima das
 * regiões, e aparece no quadro inteiro (capítulo 1); nos outros a câmera chega
 * perto, e a seção "O que é o quê" abaixo do palco repete tudo.
 */
const Legenda = memo(function Legenda() {
  const item = (x: number, y: number, desenho: ReactNode, texto: string) => (
    <g transform={`translate(${x} ${y})`}>
      {desenho}
      <text className="bd-leg-texto" x={0} y={5}>
        {texto}
      </text>
    </g>
  );
  const sigla = (s: string) => (
    <text className="bd-sigla" data-sigla={s} x={-30} y={5}>
      {s}
    </text>
  );
  const pe = (min: 0 | 1 | 2) => (
    <g className="bd-pontas" transform="translate(-10 0)">
      {min === 2 ? (
        <path d="M -40 0 H 0 M -5 -7 V 7 M -11 -7 V 7" />
      ) : (
        <>
          <path d="M -40 0 H 0 M 0 -7 L -14 0 M 0 0 L -14 0 M 0 7 L -14 0" />
          {min === 0 ? <circle className="bd-zero" cx={-20} cy={0} r={4} /> : <path d="M -19 -7 V 7" />}
        </>
      )}
    </g>
  );
  return (
    <g className="bd-legenda" aria-hidden="true">
      <rect className="bd-leg-fundo" x={6} y={4} width={770} height={56} rx={10} />
      {item(52, 20, sigla("PK"), "primary key (underlined)")}
      {item(290, 20, sigla("FK"), "foreign key")}
      {item(450, 20, sigla("UK"), "unique")}
      {item(580, 20, <text className="bd-leg-q" x={-42} y={5}>col?</text>, "may be NULL")}
      {item(76, 44, pe(2), "1 · exactly one")}
      {item(330, 44, pe(0), "0..N · zero or many")}
      {item(610, 44, pe(1), "1..N · one or many")}
    </g>
  );
});

/** Regiões e o que não anda nunca. Memorizado: só o filme muda isto. */
const Fundo = memo(function Fundo({ film }: { film: Film<DetalheDoBanco> }) {
  return (
    <g>
      {film.entities.map((e) =>
        e.type === "region" ? (
          <g key={e.id} className="bd-regiao" data-tone={e.tone ?? "muted"}>
            <rect x={e.box.x} y={e.box.y} width={e.box.w} height={e.box.h} rx={16} />
            <text x={e.box.x + 14} y={e.box.y + 22}>
              {e.label}
            </text>
          </g>
        ) : null,
      )}
    </g>
  );
});

const D_DAS_LIGACOES = new Map(LIGACOES_DO_BANCO.map((l) => [l.id, pathD(l.caminho)]));

export function VistaDiagrama({ film, frame, label }: { film: Film<DetalheDoBanco>; frame: Frame<DetalheDoBanco>; label: string }) {
  const vb = viewBox(film, frame.camera);
  const estado = new Map<string, Estado>();
  for (const e of frame.entities) estado.set(e.spec.id, e.state);
  const realce = (frame.detail?.realce ?? []).join(",");
  const app = estado.get("app");
  return (
    <svg className="bd bd-stage" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={label}>
      <Fundo film={film} />
      <Legenda />
      {LIGACOES_DO_BANCO.map((l) => {
        const s = estado.get(l.id);
        if (s === undefined || s.opacity < 0.02) return null;
        const filhaDim = estado.get(l.filha)?.dim ?? 0;
        const paiDim = estado.get(l.pai)?.dim ?? 0;
        return (
          <g key={l.id} className="bd-fk" data-aceso={s.glow > 0.05 ? "" : undefined} opacity={s.opacity * (1 - Math.max(filhaDim, paiDim) * 0.5)}>
            <path d={D_DAS_LIGACOES.get(l.id)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - s.progress} />
            {s.progress > 0.98 ? <Pontas l={l} /> : null}
          </g>
        );
      })}
      {TABELAS.map((t) => {
        const s = estado.get(t.nome);
        if (s === undefined) return null;
        const tone = s.tone === "live" ? "live" : TOM_DO_GRUPO[GRUPO[t.nome as NomeDaTabela]];
        return <Cartao key={t.nome} t={t} glow={s.glow} dim={s.dim} ping={s.ping} tone={tone} sublabel={s.sublabel} realce={realce} tipos={frame.camera.zoom >= 1.25} />;
      })}
      {app === undefined ? null : (
        <g className="bd-app" data-tone="ink" data-aceso={app.glow > 0.05 ? "" : undefined} transform={`translate(${CAIXA_DO_APP.x} ${CAIXA_DO_APP.y})`}>
          <rect width={CAIXA_DO_APP.w} height={CAIXA_DO_APP.h} rx={CAIXA_DO_APP.h / 2} />
          <Icone g={ICONE_APP} x={18} y={CAIXA_DO_APP.h / 2 - 11} s={22} />
          <text className="bd-nome" x={50} y={CAIXA_DO_APP.h / 2 - 2}>
            {app.label}
          </text>
          <text className="bd-qtd bd-app-sub" x={50} y={CAIXA_DO_APP.h / 2 + 14}>
            {app.sublabel}
          </text>
        </g>
      )}
      {frame.entities.map(({ spec, state }) => {
        if (state.opacity < 0.02) return null;
        if (spec.type === "token") {
          const p = poseAt(spec.path, state.progress);
          const largura = Math.max(64, state.label.length * 7.4 + 20);
          return (
            <g key={spec.id} className="bd-ficha" data-tone={state.tone} transform={`translate(${p.x} ${p.y})`} opacity={state.opacity}>
              <rect x={-largura / 2} y={-11} width={largura} height={20} rx={10} />
              <text y={3}>{state.label}</text>
              {state.sublabel ? (
                <text className="bd-ficha-sub" y={22}>
                  {state.sublabel}
                </text>
              ) : null}
            </g>
          );
        }
        if (spec.type === "note" && state.label) {
          return (
            <g key={spec.id} className="bd-nota" data-tone={state.tone} opacity={state.opacity}>
              <text x={spec.at.x} y={spec.at.y}>
                {state.label}
              </text>
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}
