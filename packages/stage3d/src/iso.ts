import { poseAt, type Path } from "@ovh/motion";

/**
 * A matemática da vista isométrica, separada do three.js para ser testável.
 *
 * O chão do mundo 3D é o plano do diagrama: `x` do palco vira `x`, `y` do palco
 * vira `z`, e a altura é o `y` do mundo. Assim o mesmo `Film` — as mesmas
 * caixas, os mesmos caminhos — é desenhado de pé, sem que o autor escreva
 * nada de novo.
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Ângulos da isometria verdadeira: 45° de azimute e arctan(1/√2) de elevação. */
export const ISO_AZIMUTE = Math.PI / 4;
export const ISO_ELEVACAO = Math.atan(1 / Math.SQRT2);

/** Onde a câmera fica, olhando para `alvo`, a uma distância `d`, girada `azimute`. */
export function posicaoDaCamera(alvo: Vec3, azimute: number, elevacao: number, d: number): Vec3 {
  const horizontal = Math.cos(elevacao) * d;
  return {
    x: alvo.x + Math.sin(azimute) * horizontal,
    y: alvo.y + Math.sin(elevacao) * d,
    z: alvo.z + Math.cos(azimute) * horizontal,
  };
}

/**
 * Metade da altura do quadro ortográfico que mostra `largura × altura` do chão
 * inteiros, vistos de cima em ângulo, numa tela de proporção `aspecto`.
 *
 * Um retângulo do chão, girado 45° e achatado pela elevação, ocupa na tela uma
 * caixa de largura `(w + h)·cos45` e altura `(w + h)·sin45·sin(elev)`. O quadro
 * precisa caber nas duas direções.
 */
export function meiaAlturaParaCaber(largura: number, altura: number, aspecto: number, elevacao = ISO_ELEVACAO, azimute = ISO_AZIMUTE): number {
  const telaW = largura * Math.abs(Math.cos(azimute)) + altura * Math.abs(Math.sin(azimute));
  const telaH = (largura * Math.abs(Math.sin(azimute)) + altura * Math.abs(Math.cos(azimute))) * Math.sin(elevacao);
  return Math.max(telaH / 2, telaW / 2 / aspecto);
}

/** Arrasto em pixels → deslocamento no plano do chão, relativo à câmera. */
export function deslocamentoNoChao(dx: number, dy: number, escala: number, azimute: number, elevacao: number): { x: number; z: number } {
  const vertical = dy / Math.sin(elevacao);
  return {
    x: escala * (-dx * Math.cos(azimute) - vertical * Math.sin(azimute)),
    z: escala * (dx * Math.sin(azimute) - vertical * Math.cos(azimute)),
  };
}

/**
 * Os pontos de um caminho do palco, no chão, com um arco de altura: uma ficha
 * que viaja entre dois blocos sobe e desce, e a profundidade vira leitura.
 */
export function pontoNoAr(path: Path, u: number, base: number, salto: number): Vec3 {
  const p = poseAt(path, u);
  return { x: p.x, y: base + Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * salto, z: p.y };
}

export function pontosDoCaminho(path: Path, ate = 1, amostras = 48, altura = 0): Vec3[] {
  const n = Math.max(2, Math.ceil(amostras * Math.max(ate, 0.02)));
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = poseAt(path, (i / n) * ate);
    return { x: p.x, y: altura, z: p.y };
  });
}
