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

/** A perspective lens that frames the same height as the orthographic lens. */
export function distanciaParaCaber(meiaAltura: number, fov = 40): number {
  return Math.max(1, meiaAltura) / Math.tan(fov * Math.PI / 360);
}

/** Fit every corner, including the near edge enlarged by perspective. */
export function distanciaPerspectivaParaCaber(largura: number, profundidade: number, aspecto: number, azimute = ISO_AZIMUTE, elevacao = ISO_ELEVACAO, altura = 64, fov = 40): number {
  const tan = Math.tan(fov * Math.PI / 360);
  const sa = Math.sin(azimute), ca = Math.cos(azimute), se = Math.sin(elevacao), ce = Math.cos(elevacao);
  let distance = 1;
  for (const x of [-largura / 2, largura / 2]) for (const z of [-profundidade / 2, profundidade / 2]) for (const y of [0, altura]) {
    const right = ca * x - sa * z;
    const up = -sa * se * x + ce * y - ca * se * z;
    const near = sa * ce * x + se * y + ca * ce * z;
    distance = Math.max(distance, near + Math.max(Math.abs(right) / (tan * aspecto), Math.abs(up) / tan));
  }
  return distance;
}

/** Screen-space drag translated onto the ground plane, independent of lens. */
export function deslocamentoNoChao(dx: number, dy: number, azimute: number, elevacao: number, escala: number): { x: number; z: number } {
  const fundo = -dy / Math.max(.2, Math.sin(elevacao));
  return { x: (-dx * Math.cos(azimute) + fundo * Math.sin(azimute)) * escala, z: (dx * Math.sin(azimute) + fundo * Math.cos(azimute)) * escala };
}

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
  const telaH = (largura * Math.abs(Math.sin(azimute)) + altura * Math.abs(Math.cos(azimute))) * Math.sin(elevacao) + 64 * Math.cos(elevacao);
  return Math.max(telaH / 2, telaW / 2 / aspecto);
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
