/**
 * O som dos labs de algoritmos, com Web Audio e nada mais.
 *
 * O ouvido percebe o que o olho perde em 200 barras: uma ordenação que sobe de
 * tom é uma que está pondo os grandes no fim; uma busca cujo tom sobe devagar
 * está longe do destino. Cada nota é um oscilador curto com envelope (ataque de
 * 4 ms, queda exponencial) — o clique de um oscilador cortado seco não existe.
 *
 * Regras de convivência:
 * - nada toca antes de um gesto do leitor (o navegador exige, e é educado);
 * - no máximo `VOZES` notas soando ao mesmo tempo, e um intervalo mínimo por
 *   pista: a 64 passos por quadro, tocar todos viraria ruído branco;
 * - a escolha de ligar/desligar fica no navegador do leitor (localStorage),
 *   e `prefers-reduced-motion` não muda o som — é outra preferência.
 */
const CHAVE = "openlabs-algo-som-v1";
const VOZES = 24;
const INTERVALO_MINIMO = 0.028;

type Onda = "sine" | "triangle" | "square" | "sawtooth";

class MotorDeSom {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private soando = 0;
  private ultimo = new Map<string, number>();
  private ouvintes = new Set<(ligado: boolean) => void>();
  ligado = true;
  volume = 0.5;

  constructor() {
    try {
      const salvo = typeof localStorage === "undefined" ? null : localStorage.getItem(CHAVE);
      if (salvo !== null) {
        const v = JSON.parse(salvo) as { ligado?: boolean; volume?: number };
        if (typeof v.ligado === "boolean") this.ligado = v.ligado;
        if (typeof v.volume === "number") this.volume = Math.min(1, Math.max(0, v.volume));
      }
    } catch {
      // Sem armazenamento: vale o padrão, só nesta visita.
    }
  }

  /** Chame dentro de um clique: cria (ou acorda) o contexto de áudio. */
  acordar(): void {
    if (typeof window === "undefined") return;
    try {
      if (this.ctx === null) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx === undefined) return;
        this.ctx = new Ctx();
        this.mestre = this.ctx.createGain();
        this.mestre.gain.value = this.volume * 0.6;
        this.mestre.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  definir(ligado: boolean, volume = this.volume): void {
    this.ligado = ligado;
    this.volume = volume;
    if (this.mestre !== null) this.mestre.gain.value = volume * 0.6;
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ ligado, volume }));
    } catch {
      // Sem armazenamento: a escolha vale até fechar a página.
    }
    for (const f of this.ouvintes) f(ligado);
  }

  ouvir(f: (ligado: boolean) => void): () => void {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  }

  /**
   * Uma nota. `pista` limita o ritmo por fonte (cada pista da corrida tem a
   * sua); `pan` põe a pista à esquerda ou à direita, de −1 a 1.
   */
  nota(freq: number, opcoes: { dur?: number; onda?: Onda; ganho?: number; pan?: number; pista?: string; quando?: number } = {}): void {
    const ctx = this.ctx;
    if (!this.ligado || ctx === null || this.mestre === null || ctx.state !== "running") return;
    const agora = ctx.currentTime + (opcoes.quando ?? 0);
    const pista = opcoes.pista ?? "geral";
    const antes = this.ultimo.get(pista) ?? 0;
    if (opcoes.quando === undefined && agora - antes < INTERVALO_MINIMO) return;
    if (this.soando >= VOZES) return;
    this.ultimo.set(pista, agora);
    const dur = opcoes.dur ?? 0.07;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = opcoes.onda ?? "triangle";
    osc.frequency.setValueAtTime(Math.max(40, Math.min(4000, freq)), agora);
    const pico = (opcoes.ganho ?? 0.12) * 0.9;
    env.gain.setValueAtTime(0.0001, agora);
    env.gain.exponentialRampToValueAtTime(pico, agora + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, agora + dur);
    let saida: AudioNode = env;
    if (typeof ctx.createStereoPanner === "function" && opcoes.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opcoes.pan));
      env.connect(p);
      saida = p;
    }
    osc.connect(env);
    saida.connect(this.mestre);
    this.soando += 1;
    osc.onended = () => {
      this.soando -= 1;
      osc.disconnect();
      saida.disconnect();
    };
    osc.start(agora);
    osc.stop(agora + dur + 0.02);
  }

  /** Um arpejo maior subindo a partir de `base`: a chegada de quem terminou. */
  chegada(base = 523.25, pan?: number): void {
    [1, 1.25, 1.5, 2].forEach((m, k) => this.nota(base * m, { dur: 0.22, onda: "sine", ganho: 0.14, ...(pan === undefined ? {} : { pan }), quando: k * 0.07, pista: `chegada${k}` }));
  }

  /** Um deslize de tom, para a rota sendo traçada. */
  deslize(de: number, para: number, dur = 0.5): void {
    const ctx = this.ctx;
    if (!this.ligado || ctx === null || this.mestre === null || ctx.state !== "running") return;
    const agora = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(de, agora);
    osc.frequency.exponentialRampToValueAtTime(para, agora + dur);
    env.gain.setValueAtTime(0.0001, agora);
    env.gain.exponentialRampToValueAtTime(0.1, agora + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, agora + dur);
    osc.connect(env);
    env.connect(this.mestre);
    osc.start(agora);
    osc.stop(agora + dur + 0.02);
  }
}

/** Um motor por página: todas as pistas dividem o mesmo limite de vozes. */
export const som = new MotorDeSom();

/** Tom de um valor numa faixa, em escala de semitons (soa como escala, não como sirene). */
export function tomDe(fracao: number, grave = 180, agudo = 1320): number {
  const f = Math.max(0, Math.min(1, fracao));
  return grave * (agudo / grave) ** f;
}
