import { pathLength, poseAt, type CameraState, type EntitySpec, type Film, type Frame, type Tone } from "@ovh/motion";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  RingGeometry,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { Line2 } from "three/examples/jsm/lines/webgpu/Line2.js";
import { Line2NodeMaterial, WebGPURenderer } from "three/webgpu";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { ISO_AZIMUTE, ISO_ELEVACAO, meiaAlturaParaCaber, pontoNoAr, pontosDoCaminho, posicaoDaCamera } from "./iso.js";
import { lerPaleta, type Paleta } from "./tons.js";

/**
 * A cena isométrica: um `Film` do palco animado, de pé.
 *
 * Imperativa de propósito. O React decide QUANDO (um quadro novo, um filme
 * novo); esta classe decide COMO, mexendo nos objetos que já existem em vez de
 * recriá-los. Nenhuma geometria nasce por quadro: um filme monta a cena uma
 * vez, e cada quadro só move, acende e apaga.
 *
 * O renderizador é o `WebGPURenderer`: WebGPU onde o navegador tem, e WebGL2
 * onde não tem, com o mesmo código — a escolha é dele, e o palco anota qual
 * foi em `data-backend`. Não há caminho "só WebGL" para envelhecer ao lado.
 *
 * Custo sob controle, porque 3D na web trava fácil:
 * - desenha sob demanda — só quando o quadro muda ou a câmera é mexida;
 * - para fora da tela (IntersectionObserver);
 * - densidade de pixel limitada a 2;
 * - tudo o que vai para a GPU é liberado em `dispose()`.
 */

interface Peca {
  readonly spec: EntitySpec;
  readonly root: Object3D;
  readonly materiais: Material[];
  readonly rotulo?: HTMLElement;
  readonly sub?: HTMLElement;
  readonly atualizar: (estado: Frame<unknown>["entities"][number]["state"], paleta: Paleta) => void;
}

const ALTURA_DO_ROTULO = 2;

function corDe(css: string, reserva: string): Color {
  const c = new Color();
  try {
    c.setStyle(css);
  } catch {
    c.setStyle(reserva);
  }
  return c;
}

/**
 * Escreve rótulo e sub-rótulo só quando mudam. Um rótulo é DOM, e reescrever
 * DOM a cada quadro em todas as peças é layout a cada quadro.
 */
function escrever(el: HTMLElement, label: string, sub = "", classeDoSub = "iso-sub"): void {
  const chave = `${label}\u0000${sub}`;
  if (el.dataset.k === chave) return;
  el.dataset.k = chave;
  el.textContent = label;
  if (sub !== "") {
    const span = document.createElement("span");
    span.className = classeDoSub;
    span.textContent = sub;
    el.appendChild(span);
  }
  el.hidden = label === "" && sub === "";
}

function marcar(el: HTMLElement, chave: string, valor: string | null): void {
  if (valor === null) {
    if (chave in el.dataset) delete el.dataset[chave];
  } else if (el.dataset[chave] !== valor) el.dataset[chave] = valor;
}

function opacidade(el: HTMLElement, v: number): void {
  const t = v.toFixed(2);
  if (el.style.opacity !== t) el.style.opacity = t;
}

function etiqueta(classe: string, texto: string): { obj: CSS2DObject; el: HTMLElement } {
  const el = document.createElement("div");
  el.className = classe;
  el.textContent = texto;
  const obj = new CSS2DObject(el);
  return { obj, el };
}

let texturaDoHalo: CanvasTexture | null = null;
function halo(): CanvasTexture {
  if (texturaDoHalo !== null) return texturaDoHalo;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  // Luminância, não tinta: o tom vem da `color` do material.
  grad.addColorStop(0, "white");
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  texturaDoHalo = new CanvasTexture(c);
  return texturaDoHalo;
}

export interface IsoOptions {
  /** Altura dos blocos em relação ao menor lado da caixa. */
  readonly alturaRelativa?: number;
  /** Força o backend WebGL2 mesmo com WebGPU disponível (QA, comparação). */
  readonly forcarWebGL?: boolean;
}

export class IsoScene {
  readonly #host: HTMLElement;
  #renderer: WebGPURenderer;
  #pronto = false;
  readonly #labels: CSS2DRenderer;
  readonly #scene = new Scene();
  readonly #camera = new OrthographicCamera(-1, 1, 1, -1, 1, 8000);
  readonly #sol = new DirectionalLight(0xffffff, 1.6);
  readonly #ceu = new HemisphereLight(0xffffff, 0x888888, 1.4);
  readonly #pecas = new Map<string, Peca>();
  readonly #mundo = new Group();
  readonly #observador: IntersectionObserver | null;
  readonly #resize: ResizeObserver | null;
  readonly #temaObs: MutationObserver | null;
  readonly #midia: MediaQueryList | null;
  readonly #options: IsoOptions;
  #paleta: Paleta;
  #film: Film<unknown> | null = null;
  #frame: Frame<unknown> | null = null;
  #visivel = true;
  #pedido = 0;
  #azimute = ISO_AZIMUTE;
  #elevacao = ISO_ELEVACAO;
  #linhas: Line2NodeMaterial[] = [];
  #retemar: (() => void) | null = null;

  constructor(host: HTMLElement, options: IsoOptions = {}) {
    this.#host = host;
    this.#options = options;
    this.#paleta = lerPaleta(host);
    const semGpu = typeof navigator === "undefined" || !("gpu" in navigator);
    this.#renderer = this.#criarRenderer(options.forcarWebGL === true || semGpu);

    this.#labels = new CSS2DRenderer();
    this.#labels.domElement.className = "iso-stage__labels";
    host.appendChild(this.#labels.domElement);

    this.#scene.add(this.#ceu, this.#sol, this.#sol.target, this.#mundo);
    this.#sol.castShadow = true;
    this.#sol.shadow.mapSize.set(1024, 1024);
    // Sem `normalBias`, faces inclinadas para o sol se sombreavam a si mesmas
    // em listras (shadow acne) — visto na revisão das fotos com a r180.
    this.#sol.shadow.bias = -0.0008;
    this.#sol.shadow.normalBias = 1.2;

    this.#observador =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            this.#visivel = entries.some((e) => e.isIntersecting);
            if (this.#visivel) this.pedir();
          });
    this.#observador?.observe(host);
    this.#resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this.#medir());
    this.#resize?.observe(host);
    // O tema troca por atributo na raiz ou pela preferência do sistema.
    const retemar = (this.#retemar = () => {
      this.#paleta = lerPaleta(this.#host);
      if (this.#film !== null) this.setFilm(this.#film);
      if (this.#frame !== null) this.update(this.#frame);
    });
    this.#temaObs = typeof MutationObserver === "undefined" ? null : new MutationObserver(retemar);
    this.#temaObs?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.#midia = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
    this.#midia?.addEventListener("change", retemar);
    this.#medir();
  }

  /**
   * Um renderizador novo, no hospedeiro.
   *
   * Se o dispositivo WebGPU cair — driver reiniciado, GPU trocada, um ambiente
   * que não o sustenta —, a cena se recria em WebGL2 e continua do mesmo quadro.
   * O leitor nunca vê um palco vazio por causa da tecnologia que escolhemos.
   */
  #criarRenderer(forcarWebGL: boolean, tentativa = 0): WebGPURenderer {
    const r = new WebGPURenderer({ antialias: true, alpha: false, powerPreference: "high-performance", forceWebGL: forcarWebGL });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFSoftShadowMap;
    r.domElement.className = "iso-stage__canvas";
    this.#host.prepend(r.domElement);
    this.#pronto = false;
    r.onDeviceLost = () => {
      if (this.#renderer !== r || forcarWebGL) return;
      this.#host.dataset.backendPerdido = "webgpu";
      r.domElement.remove();
      this.#renderer = this.#criarRenderer(true);
      this.#medir();
    };
    r.init().then(
      () => {
        if (this.#renderer !== r) return;
        this.#pronto = true;
        const webgpu = (r.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
        this.#host.dataset.backend = webgpu ? "webgpu" : "webgl2";
        this.pedir();
      },
      (erro: unknown) => {
        if (this.#renderer !== r) return;
        this.#host.dataset.erro = erro instanceof Error ? erro.message : String(erro);
        // Logo depois de o processo de GPU cair, o navegador recusa contexto
        // novo por um instante. Tenta-se de novo, com espera crescente.
        if (tentativa >= 3) {
          this.#host.dataset.backend = "falhou";
          return;
        }
        setTimeout(() => {
          if (this.#renderer !== r) return;
          r.domElement.remove();
          this.#renderer = this.#criarRenderer(true, tentativa + 1);
          this.#medir();
        }, 500 * 2 ** tentativa);
      },
    );
    return r;
  }

  /** Gira a vista. A elevação fica entre o quase-chão e o quase-topo. */
  orbitar(dAzimute: number, dElevacao: number): void {
    this.#azimute += dAzimute;
    this.#elevacao = Math.min(1.35, Math.max(0.25, this.#elevacao + dElevacao));
    this.pedir();
  }

  reenquadrar(): void {
    this.#azimute = ISO_AZIMUTE;
    this.#elevacao = ISO_ELEVACAO;
    this.pedir();
  }

  setFilm(film: Film<unknown>): void {
    this.#limparMundo();
    this.#film = film;
    const p = this.#paleta;
    this.#scene.background = corDe(p.papel, p.tinta);
    this.#ceu.color = corDe(p.papelElevado, p.tinta);
    this.#ceu.groundColor = corDe(p.regua, p.tinta);

    // O chão: recebe sombra e desenha a malha do papel quadriculado.
    const chao = new Mesh(new PlaneGeometry(film.width * 3, film.height * 3), new ShadowMaterial({ opacity: 0.13 }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.set(film.width / 2, 0, film.height / 2);
    chao.receiveShadow = true;
    this.#mundo.add(chao);
    this.#mundo.add(this.#malha(film, p));

    for (const spec of film.entities) {
      const peca = this.#montar(spec, p);
      if (peca === null) continue;
      this.#pecas.set(spec.id, peca);
      this.#mundo.add(peca.root);
    }

    // Sol de cima e de lado, cobrindo o filme todo.
    const cx = film.width / 2;
    const cz = film.height / 2;
    this.#sol.position.set(cx - film.width * 0.3, 900, cz - film.height * 0.6);
    this.#sol.target.position.set(cx, 0, cz);
    const s = this.#sol.shadow.camera;
    const r = Math.max(film.width, film.height) * 0.8;
    s.left = -r;
    s.right = r;
    s.top = r;
    s.bottom = -r;
    s.near = 10;
    s.far = 3000;
    s.updateProjectionMatrix();
    this.pedir();
  }

  update(frame: Frame<unknown>): void {
    this.#frame = frame;
    for (const { spec, state } of frame.entities) this.#pecas.get(spec.id)?.atualizar(state, this.#paleta);
    this.pedir();
  }

  /** Pede um desenho; vários pedidos no mesmo quadro viram um. */
  pedir(): void {
    if (this.#pedido !== 0) return;
    this.#pedido = requestAnimationFrame(() => {
      this.#pedido = 0;
      if (this.#visivel) this.#desenhar();
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.#pedido);
    this.#observador?.disconnect();
    this.#resize?.disconnect();
    this.#temaObs?.disconnect();
    if (this.#retemar !== null) this.#midia?.removeEventListener("change", this.#retemar);
    this.#limparMundo();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
    this.#labels.domElement.remove();
  }

  #medir(): void {
    const w = Math.max(1, this.#host.clientWidth);
    const h = Math.max(1, this.#host.clientHeight);
    this.#renderer.setSize(w, h, false);
    this.#labels.setSize(w, h);
    // Rótulo é HTML em pixels, e a cena encolhe com o palco: sem escala, num
    // celular o texto cobre os blocos. Em tela estreita, só o essencial fica.
    this.#host.style.setProperty("--iso-k", String(Math.max(0.62, Math.min(1, w / 1100))));
    if (w < 640) this.#host.dataset.compacto = "";
    else delete this.#host.dataset.compacto;
    this.pedir();
  }

  #enquadrar(camera: CameraState): void {
    const film = this.#film;
    if (film === null) return;
    const w = Math.max(1, this.#host.clientWidth);
    const h = Math.max(1, this.#host.clientHeight);
    const aspecto = w / h;
    const meia = meiaAlturaParaCaber(film.width / camera.zoom, film.height / camera.zoom, aspecto, this.#elevacao) * 1.02;
    const cam = this.#camera;
    cam.top = meia;
    cam.bottom = -meia;
    cam.left = -meia * aspecto;
    cam.right = meia * aspecto;
    cam.updateProjectionMatrix();
    const alvo = { x: camera.cx, y: 0, z: camera.cy };
    const pos = posicaoDaCamera(alvo, this.#azimute, this.#elevacao, 3000);
    cam.position.set(pos.x, pos.y, pos.z);
    cam.lookAt(new Vector3(alvo.x, alvo.y, alvo.z));
  }

  #desenhar(): void {
    const film = this.#film;
    if (film === null || !this.#pronto) return;
    this.#enquadrar(this.#frame?.camera ?? film.camera);
    this.#renderer.render(this.#scene, this.#camera);
    this.#labels.render(this.#scene, this.#camera);
    // Para o QA: quantas chamadas de desenho o último quadro fez.
    this.#host.dataset.chamadas = String(this.#renderer.info.render.drawCalls ?? this.#renderer.info.render.calls ?? 0);
  }

  #malha(film: Film<unknown>, p: Paleta): Object3D {
    const passo = 40;
    const pts: Vector3[] = [];
    for (let x = 0; x <= film.width; x += passo) pts.push(new Vector3(x, 0.2, 0), new Vector3(x, 0.2, film.height));
    for (let z = 0; z <= film.height; z += passo) pts.push(new Vector3(0, 0.2, z), new Vector3(film.width, 0.2, z));
    const mat = new LineBasicMaterial({ color: corDe(p.regua, p.tinta), transparent: true, opacity: 0.55 });
    return new LineSegments(new BufferGeometry().setFromPoints(pts), mat);
  }

  #linha(cor: Color, largura: number, tracejada: boolean): Line2NodeMaterial {
    const m = new Line2NodeMaterial({ color: cor.getHex(), linewidth: largura, transparent: true, dashed: tracejada, dashSize: 8, gapSize: 7 });
    this.#linhas.push(m);
    return m;
  }

  #montar(spec: EntitySpec, p: Paleta): Peca | null {
    const tomInicial = (spec.tone ?? "ink") as Tone;
    switch (spec.type) {
      case "node":
      case "lane":
        return this.#bloco(spec, p, tomInicial);
      case "link":
        return this.#ligacao(spec, p, tomInicial);
      case "token":
        return this.#ficha(spec, p, tomInicial);
      case "bar":
        return this.#barra(spec, p, tomInicial);
      case "note": {
        const root = new Group();
        const { obj, el } = etiqueta(`iso-note iso-note--${spec.align ?? "middle"}`, spec.label ?? "");
        obj.position.set(spec.at.x, ALTURA_DO_ROTULO, spec.at.y);
        root.add(obj);
        return {
          spec,
          root,
          materiais: [],
          rotulo: el,
          atualizar: (s) => {
            escrever(el, s.label, s.sublabel);
            marcar(el, "tone", s.tone);
            opacidade(el, s.opacity * (1 - 0.7 * s.dim));
            root.visible = s.opacity > 0.01;
            root.position.set(s.dx, 0, s.dy);
          },
        };
      }
      case "region": {
        const root = new Group();
        const { box } = spec;
        const mat = new MeshStandardMaterial({ color: corDe(p.tom(tomInicial), p.tinta), transparent: true, opacity: 0.08 });
        const placa = new Mesh(new BoxGeometry(box.w, 1, box.h), mat);
        placa.position.set(box.x + box.w / 2, 0.5, box.y + box.h / 2);
        root.add(placa);
        const { obj, el } = etiqueta("iso-region", spec.label ?? "");
        obj.position.set(box.x + 12, ALTURA_DO_ROTULO, box.y + 12);
        root.add(obj);
        return {
          spec,
          root,
          materiais: [mat],
          rotulo: el,
          atualizar: (s, pal) => {
            mat.color = corDe(pal.tom(s.tone), pal.tinta);
            mat.opacity = (0.06 + 0.1 * s.glow) * s.opacity;
            escrever(el, s.label);
            marcar(el, "tone", s.tone);
            root.visible = s.opacity > 0.01;
          },
        };
      }
      case "custom":
        // Desenho do domínio em SVG não tem tradução para 3D. O filme continua
        // sendo lido inteiro; só esta peça fica de fora, e a documentação diz.
        return null;
    }
  }

  #bloco(spec: Extract<EntitySpec, { type: "node" | "lane" }>, p: Paleta, tom: Tone): Peca {
    const box = spec.type === "node" ? spec.box : spec.head;
    const shape = spec.type === "node" ? (spec.shape ?? "box") : "box";
    const alturaRel = this.#options.alturaRelativa ?? 0.5;
    const H = Math.max(12, Math.min(44, Math.min(box.w, box.h) * alturaRel));
    const root = new Group();
    const corpo = new Group();
    corpo.position.set(box.x + box.w / 2, 0, box.y + box.h / 2);
    root.add(corpo);

    const geo =
      shape === "circle" || shape === "cylinder"
        ? new CylinderGeometry(Math.min(box.w, box.h) / 2, Math.min(box.w, box.h) / 2, H, 40)
        : shape === "pill" || shape === "box"
          ? new RoundedBoxGeometry(box.w, H, box.h, 3, Math.min(8, H / 3, box.h / 2.5))
          : new BoxGeometry(box.w * 0.72, H, box.h * 0.72);
    const mat = new MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, transparent: true });
    const mesh = new Mesh(geo, mat);
    mesh.position.y = H / 2;
    if (shape === "diamond") mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    corpo.add(mesh);

    const bordaMat = new LineBasicMaterial({ transparent: true });
    const borda = new LineSegments(new EdgesGeometry(geo, 30), bordaMat);
    borda.position.copy(mesh.position);
    borda.rotation.copy(mesh.rotation);
    corpo.add(borda);

    // A onda de "aconteceu aqui": um anel no chão, em volta da peça.
    const anelMat = new MeshStandardMaterial({ transparent: true, opacity: 0, emissiveIntensity: 1 });
    const anel = new Mesh(new RingGeometry(0.5, 0.56, 48), anelMat);
    anel.rotation.x = -Math.PI / 2;
    anel.position.y = 0.6;
    corpo.add(anel);
    const raioDoAnel = Math.max(box.w, box.h) * 0.62;

    const { obj, el } = etiqueta("iso-label", spec.label ?? "");
    obj.position.set(0, H + 4, 0);
    corpo.add(obj);

    // A linha de vida de uma raia: tracejada no chão, da cabeça até o fundo.
    let vida: Line | null = null;
    let vidaMat: LineDashedMaterial | null = null;
    if (spec.type === "lane") {
      vidaMat = new LineDashedMaterial({ dashSize: 6, gapSize: 8, transparent: true, opacity: 0.8 });
      vida = new Line(new BufferGeometry().setFromPoints([new Vector3(0, 0.4, 0), new Vector3(0, 0.4, 1)]), vidaMat);
      root.add(vida);
    }
    const inicioDaVida = box.y + box.h;
    const fimDaVida = spec.type === "lane" ? spec.bottom : 0;

    const materiais: Material[] = [mat, bordaMat, anelMat, ...(vidaMat === null ? [] : [vidaMat])];
    let tomAtual = "";
    return {
      spec,
      root,
      materiais,
      rotulo: el,
      atualizar: (s, pal) => {
        const visivel = s.opacity * (1 - 0.7 * s.dim);
        root.visible = visivel > 0.01;
        if (!root.visible) {
          opacidade(el, 0);
          return;
        }
        if (s.tone !== tomAtual) {
          tomAtual = s.tone;
          const t = corDe(pal.tom(s.tone), pal.tinta);
          const base = corDe(pal.papelElevado, pal.tinta);
          mat.color = base.clone().lerp(t, 0.2);
          mat.emissive = t;
          bordaMat.color = t;
          anelMat.color = t;
          anelMat.emissive = t;
          vidaMat?.color.copy(t);
        }
        mat.emissiveIntensity = 0.04 + s.glow * 0.38;
        mat.opacity = visivel;
        bordaMat.opacity = Math.min(1, visivel * (0.55 + 0.45 * s.glow));
        corpo.position.set(box.x + box.w / 2 + s.dx, 0, box.y + box.h / 2 + s.dy);
        corpo.scale.setScalar(s.scale);
        // Acender levanta a peça um pouco: a energia vira altura.
        mesh.position.y = H / 2 + s.glow * 3;
        borda.position.y = mesh.position.y;
        if (s.ping > 0 && s.ping < 1) {
          anel.visible = true;
          anel.scale.setScalar(raioDoAnel * (1 + s.ping * 0.8));
          anelMat.opacity = 1 - s.ping;
        } else anel.visible = false;
        escrever(el, s.label, s.sublabel);
        opacidade(el, visivel);
        marcar(el, "tone", s.tone);
        marcar(el, "lit", s.glow > 0.05 ? "" : null);
        if (vida !== null) {
          const x = box.x + box.w / 2 + s.dx;
          const fim = inicioDaVida + (fimDaVida - inicioDaVida) * s.progress;
          vida.geometry.setFromPoints([new Vector3(x, 0.4, inicioDaVida + s.dy), new Vector3(x, 0.4, fim + s.dy)]);
          vida.computeLineDistances();
        }
      },
    };
  }

  #ligacao(spec: Extract<EntitySpec, { type: "link" }>, p: Paleta, tom: Tone): Peca {
    const root = new Group();
    const pontos = pontosDoCaminho(spec.path, 1, 48, 1.5);
    const geo = new LineGeometry();
    geo.setPositions(pontos.flatMap((v) => [v.x, v.y, v.z]));
    const mat = this.#linha(corDe(p.tom(tom), p.tinta), 2, spec.dashed === true);
    const linha = new Line2(geo, mat);
    linha.computeLineDistances();
    root.add(linha);
    const segmentos = pontos.length - 1;

    const pontaMat = new MeshStandardMaterial({ transparent: true });
    const ponta = new Mesh(new ConeGeometry(4.5, 11, 16), pontaMat);
    ponta.visible = spec.arrow === true;
    root.add(ponta);

    const at = spec.labelAt ?? 0.5;
    const meio = poseAt(spec.path, at);
    const { obj, el } = etiqueta("iso-link", spec.label ?? "");
    obj.position.set(meio.x, 10, meio.y);
    root.add(obj);
    let tomAtual = "";
    return {
      spec,
      root,
      materiais: [mat, pontaMat],
      rotulo: el,
      atualizar: (s, pal) => {
        const visivel = s.opacity * (1 - 0.7 * s.dim);
        root.visible = visivel > 0.01 && s.progress > 0.001;
        if (!root.visible) {
          opacidade(el, 0);
          return;
        }
        if (s.tone !== tomAtual) {
          tomAtual = s.tone;
          const c = corDe(pal.tom(s.tone), pal.tinta);
          mat.color = c;
          pontaMat.color = c;
          pontaMat.emissive = c;
        }
        mat.opacity = visivel;
        mat.linewidth = 2 + s.glow * 1.5;
        geo.instanceCount = Math.max(1, Math.round(segmentos * s.progress));
        root.position.set(s.dx, 0, s.dy);
        if (ponta.visible) {
          const tip = poseAt(spec.path, s.progress);
          ponta.position.set(tip.x, 1.5, tip.y);
          ponta.rotation.set(0, -(tip.angle * Math.PI) / 180, -Math.PI / 2);
          pontaMat.opacity = visivel;
        }
        const legivel = Math.min(1, Math.max(0, (s.progress - 0.86) / 0.14));
        escrever(el, s.label, s.sublabel);
        marcar(el, "tone", s.tone);
        opacidade(el, legivel * visivel);
      },
    };
  }

  #ficha(spec: Extract<EntitySpec, { type: "token" }>, p: Paleta, tom: Tone): Peca {
    const root = new Group();
    const r = (spec.size ?? 6) * 1.25;
    const mat = new MeshStandardMaterial({ roughness: 0.3, emissiveIntensity: 0.9, transparent: true });
    const esfera = new Mesh(new SphereGeometry(r, 24, 16), mat);
    esfera.castShadow = true;
    root.add(esfera);
    const haloMat = new SpriteMaterial({ map: halo(), transparent: true, depthWrite: false, opacity: 0.55 });
    const brilho = new Sprite(haloMat);
    brilho.scale.setScalar(r * 6);
    root.add(brilho);
    const rastros: Mesh[] = [];
    const rastroMat = new MeshStandardMaterial({ transparent: true, opacity: 0.35, emissiveIntensity: 0.6 });
    for (let k = 0; k < (spec.trail ?? 6); k += 1) {
      const m = new Mesh(new SphereGeometry(r * (1 - (k + 1) / ((spec.trail ?? 6) + 2)), 12, 8), rastroMat);
      rastros.push(m);
      root.add(m);
    }
    const { obj, el } = etiqueta("iso-token", spec.label ?? "");
    root.add(obj);
    const salto = Math.min(60, 16 + pathLength(spec.path) * 0.08);
    let tomAtual = "";
    return {
      spec,
      root,
      materiais: [mat, haloMat, rastroMat],
      rotulo: el,
      atualizar: (s, pal) => {
        const visivel = s.opacity * (1 - 0.7 * s.dim);
        root.visible = visivel > 0.01;
        opacidade(el, root.visible ? visivel : 0);
        if (!root.visible) return;
        if (s.tone !== tomAtual) {
          tomAtual = s.tone;
          const c = corDe(pal.tom(s.tone), pal.tinta);
          mat.color = c;
          mat.emissive = c;
          haloMat.color = c;
          rastroMat.color = c;
          rastroMat.emissive = c;
        }
        mat.opacity = visivel;
        haloMat.opacity = 0.5 * visivel;
        const aqui = pontoNoAr(spec.path, s.progress, 14, salto);
        esfera.position.set(aqui.x + s.dx, aqui.y, aqui.z + s.dy);
        esfera.scale.setScalar(s.scale);
        brilho.position.copy(esfera.position);
        rastros.forEach((m, k) => {
          const u = s.progress - (k + 1) * 0.022;
          m.visible = u > 0;
          if (!m.visible) return;
          const q = pontoNoAr(spec.path, u, 14, salto);
          m.position.set(q.x + s.dx, q.y, q.z + s.dy);
        });
        obj.position.set(esfera.position.x, esfera.position.y + r + 10, esfera.position.z);
        escrever(el, s.label);
        marcar(el, "tone", s.tone);
      },
    };
  }

  #barra(spec: Extract<EntitySpec, { type: "bar" }>, p: Paleta, tom: Tone): Peca {
    const root = new Group();
    const { box } = spec;
    const alto = 9;
    const mat = new MeshStandardMaterial({ roughness: 0.5, transparent: true, emissiveIntensity: 0.15 });
    const geo = new BoxGeometry(1, alto, 1);
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    root.add(mesh);
    const { obj, el } = etiqueta("iso-bar", spec.label ?? "");
    root.add(obj);
    const baixo = (spec.grow ?? "down") === "down";
    let tomAtual = "";
    return {
      spec,
      root,
      materiais: [mat],
      rotulo: el,
      atualizar: (s, pal) => {
        const visivel = s.opacity * (1 - 0.7 * s.dim);
        root.visible = visivel > 0.01 && s.progress > 0.001;
        opacidade(el, root.visible && s.progress > 0.6 ? visivel : 0);
        if (!root.visible) return;
        if (s.tone !== tomAtual) {
          tomAtual = s.tone;
          const c = corDe(pal.tom(s.tone), pal.tinta);
          mat.color = c;
          mat.emissive = c;
        }
        mat.opacity = visivel;
        mat.emissiveIntensity = 0.15 + s.glow * 0.5;
        const w = baixo ? box.w : box.w * s.progress;
        const h = baixo ? box.h * s.progress : box.h;
        mesh.scale.set(Math.max(0.01, w), 1, Math.max(0.01, h));
        mesh.position.set(box.x + w / 2 + s.dx, alto / 2, box.y + h / 2 + s.dy);
        obj.position.set(box.x + box.w + 10 + s.dx, alto + 2, box.y + 8 + s.dy);
        escrever(el, s.label);
        marcar(el, "tone", s.tone);
      },
    };
  }

  #limparMundo(): void {
    this.#mundo.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
      if (o instanceof CSS2DObject) o.element.remove();
    });
    this.#mundo.clear();
    this.#pecas.clear();
    this.#linhas = [];
  }
}
