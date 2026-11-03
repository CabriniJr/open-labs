import { formaDe, pathLength, poseAt, type CameraState, type EntitySpec, type Film, type Frame, type Tone } from "@ovh/motion";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Shape as ContornoDoThree,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
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
  Vector2,
  Vector3,
  BufferGeometry,
  type Material,
  type MeshStandardMaterialParameters,
  type Object3D,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { Line2 } from "three/examples/jsm/lines/webgpu/Line2.js";
import { Line2NodeMaterial, WebGPURenderer } from "three/webgpu";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { deslocamentoNoChao, ISO_AZIMUTE, ISO_ELEVACAO, meiaAlturaParaCaber, pontoNoAr, pontosDoCaminho, posicaoDaCamera } from "./iso.js";
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
  #porSoftware = false;
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
  #zoom = 1;
  #pan = { x: 0, z: 0 };
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
        // Um rasterizador por software não sustenta mapas de sombra por quadro.
        // A sombra de contato mantém a leitura de volume sem esse segundo passe.
        const gl = webgpu ? null : r.domElement.getContext("webgl2");
        const debug = gl?.getExtension("WEBGL_debug_renderer_info");
        const porSoftware = debug !== null && debug !== undefined && /swiftshader|llvmpipe|softpipe|software/i.test(String(gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
        if (porSoftware) {
          this.#porSoftware = true;
          r.samples = 0;
          r.shadowMap.enabled = false;
          this.#sol.castShadow = false;
          r.setPixelRatio(Math.min(0.75, window.devicePixelRatio || 1));
          if (this.#film !== null) this.setFilm(this.#film);
          if (this.#frame !== null) this.update(this.#frame);
        }
        this.#host.dataset.qualidade = porSoftware ? "software" : "hardware";
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
    this.#zoom = 1;
    this.#host.dataset.zoom = "1.00";
    this.#pan = { x: 0, z: 0 };
    this.pedir();
  }

  ampliar(fator: number): void {
    this.#zoom = Math.min(5, Math.max(0.5, this.#zoom * fator));
    this.#host.dataset.zoom = this.#zoom.toFixed(2);
    this.pedir();
  }

  deslocar(dx: number, dy: number): void {
    const escala = (this.#camera.top - this.#camera.bottom) / Math.max(1, this.#host.clientHeight);
    const d = deslocamentoNoChao(dx, dy, escala, this.#azimute, this.#elevacao);
    this.#pan.x += d.x;
    this.#pan.z += d.z;
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
    if (!this.#porSoftware) {
      const chao = new Mesh(new PlaneGeometry(film.width * 3, film.height * 3), new ShadowMaterial({ opacity: 0.13 }));
      chao.rotation.x = -Math.PI / 2;
      chao.position.set(film.width / 2, 0, film.height / 2);
      chao.receiveShadow = true;
      this.#mundo.add(chao);
    }
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
    const meia = meiaAlturaParaCaber(film.width / camera.zoom, film.height / camera.zoom, aspecto, this.#elevacao, this.#azimute) * 1.02 / this.#zoom;
    const cam = this.#camera;
    cam.top = meia;
    cam.bottom = -meia;
    cam.left = -meia * aspecto;
    cam.right = meia * aspecto;
    cam.updateProjectionMatrix();
    const alvo = { x: camera.cx + this.#pan.x, y: camera.elev ?? 0, z: camera.cy + this.#pan.z };
    const pos = posicaoDaCamera(alvo, this.#azimute, this.#elevacao, 3000);
    cam.position.set(pos.x, pos.y, pos.z);
    cam.lookAt(new Vector3(alvo.x, alvo.y, alvo.z));
    this.#host.dataset.camera = `${alvo.x.toFixed(1)},${alvo.z.toFixed(1)},${this.#zoom.toFixed(2)}`;
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

  /** Luz difusa no software; materiais físicos continuam nos dispositivos com GPU. */
  #material(params: MeshStandardMaterialParameters = {}): MeshStandardMaterial | MeshLambertMaterial {
    if (!this.#porSoftware) return new MeshStandardMaterial(params);
    const { roughness: _roughness, metalness: _metalness, ...difuso } = params;
    return new MeshLambertMaterial(difuso);
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
            root.position.set(s.dx, spec.elevation ?? 0, s.dy);
          },
        };
      }
      case "region": {
        const root = new Group();
        const { box } = spec;
        const mat = this.#material({ color: corDe(p.tom(tomInicial), p.tinta), transparent: true, opacity: 0.08 });
        // Espessura da placa proporcional à peça: com 1 unidade fixa, ela
        // enterrava as portas de um nível fundo, que medem menos que isso.
        const esp = 1 * (spec.textScale ?? 1);
        const placa = new Mesh(new BoxGeometry(box.w, esp, box.h), mat);
        // O topo fica um fio acima do chão: rente a ele, os dois brigavam pelo
        // mesmo pixel (z-fighting em listras).
        placa.position.set(box.x + box.w / 2, esp * 0.02 - esp / 2, box.y + box.h / 2);
        root.add(placa);
        const { obj, el } = etiqueta("iso-region", spec.label ?? "");
        obj.position.set(box.x + 12 * (spec.textScale ?? 1), ALTURA_DO_ROTULO * (spec.textScale ?? 1), box.y + 12 * (spec.textScale ?? 1));
        root.add(obj);
        return {
          spec,
          root,
          materiais: [mat],
          rotulo: el,
          atualizar: (s, pal) => {
            mat.color = corDe(pal.tom(s.tone), pal.tinta);
            mat.opacity = (0.06 + 0.1 * s.glow) * s.opacity;
            root.position.y = spec.elevation ?? 0;
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
    // Proporcional à peça, sem piso absoluto: uma porta lógica de 1 unidade
    // num nível fundo não pode virar uma torre de 12.
    const H = spec.height ?? Math.min(44, Math.min(box.w, box.h) * alturaRel);
    const elevacao = spec.elevation ?? 0;
    const material = spec.material ?? "matte";
    const pequena = Math.min(box.w, box.h) < 24;
    const root = new Group();
    const corpo = new Group();
    corpo.position.set(box.x + box.w / 2, 0, box.y + box.h / 2);
    root.add(corpo);
    const contatoMat = new MeshBasicMaterial({ map: halo(), color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false });
    const contato = new Mesh(new PlaneGeometry(box.w * 1.45, box.h * 1.45), contatoMat);
    contato.rotation.x = -Math.PI / 2;
    contato.position.y = 0.25;
    corpo.add(contato);

    // Formas do catálogo: o MESMO contorno do palco plano, levantado em sólido.
    const extrudada = !["circle", "cylinder", "pill", "box", "stack", "diamond", "window", "server"].includes(shape);
    const forma = extrudada ? formaDe(shape, box.w, box.h) : null;
    const geo =
      shape === "circle" || shape === "cylinder"
        ? new CylinderGeometry(Math.min(box.w, box.h) / 2, Math.min(box.w, box.h) / 2, H, 40)
        : forma !== null
          ? (() => {
              // y do palco é z do mundo; a extrusão sobe em y depois da rotação.
              const c = new ContornoDoThree(forma.contorno.map((p) => new Vector2(p.x, -p.y)));
              const g = new ExtrudeGeometry(c, { depth: H, bevelEnabled: true, bevelThickness: H * 0.06, bevelSize: Math.min(box.w, box.h) * 0.02, bevelSegments: 2, curveSegments: 6 });
              g.rotateX(-Math.PI / 2);
              g.translate(0, -H / 2, 0);
              return g;
            })()
          : shape === "window"
            ? new RoundedBoxGeometry(box.w * 0.9, H, box.h * 0.16, 2, 3)
          : shape === "pill" || shape === "box" || shape === "stack" || shape === "server"
            ? new RoundedBoxGeometry(box.w, H, box.h, 3, Math.min(8, H / 3, box.h / 2.5))
            : new BoxGeometry(box.w * 0.72, H, box.h * 0.72);
    // Do que a peça é feita muda como a luz bate nela: é o que faz a tampa de um
    // chip ler como metal e o die como silício, sem textura nenhuma.
    const ACABAMENTO = {
      matte: { roughness: 0.62, metalness: 0.05, mistura: 0.2 },
      metal: { roughness: 0.28, metalness: 0.85, mistura: 0.08 },
      // Silício é escuro com brilho: pouca tinta, muito reflexo.
      silicon: { roughness: 0.16, metalness: 0.7, mistura: 0.22 },
      pcb: { roughness: 0.85, metalness: 0.0, mistura: 0.7 },
      glass: { roughness: 0.05, metalness: 0.1, mistura: 0.15 },
    } as const;
    const acabamento = ACABAMENTO[material];
    const mat = this.#material({ roughness: acabamento.roughness, metalness: acabamento.metalness, transparent: true });
    const mesh = new Mesh(geo, mat);
    let detalhe: LineSegments | null = null;
    // Equipamento: o bloco vira três lâminas com fresta entre elas.
    const laminas: Mesh[] = [];
    if (shape === "stack" || shape === "server") {
      mesh.visible = false;
      const alturaDaLamina = (H * 1.6) / 3;
      for (let i = 0; i < 3; i += 1) {
        const l = new Mesh(new RoundedBoxGeometry(box.w, alturaDaLamina - 3, box.h, 2, 3), mat);
        l.position.y = alturaDaLamina / 2 + i * alturaDaLamina;
        l.castShadow = true;
        l.receiveShadow = true;
        laminas.push(l);
      }
    }
    mesh.position.y = H / 2;
    if (shape === "diamond") mesh.rotation.y = Math.PI / 4;
    // Sombra só para peça grande: o mapa de sombra cobre o filme inteiro, e numa
    // peça de uma unidade ele vira serrilhado.
    mesh.castShadow = !pequena;
    mesh.receiveShadow = !pequena;
    corpo.add(mesh);
    // Janela em um monitor, sobre um pé. A forma mantém a função também sem rótulo.
    const acessorios: Mesh[] = [];
    const face = this.#material({ color: corDe(p.tinta, p.tinta).lerp(corDe(p.papelElevado, p.tinta), 0.12), roughness: 0.5, transparent: true });
    if (shape === "window") {
      const tela = new Mesh(new BoxGeometry(box.w * 0.8, H * 0.72, 1), face);
      tela.position.set(0, H * 0.53, box.h * 0.085);
      const pe = new Mesh(new RoundedBoxGeometry(box.w * 0.55, H * 0.1, box.h * 0.68, 2, 2), mat);
      pe.position.set(0, H * 0.05, box.h * 0.13);
      acessorios.push(tela, pe);
      for (const [largura, y] of [[0.6, 0.72], [0.45, 0.48], [0.3, 0.32]] as const) {
        const linha = new Mesh(new BoxGeometry(box.w * largura, H * 0.035, 1), mat);
        linha.position.set(-box.w * (0.6 - largura) / 2, H * y, box.h * 0.085 + 1);
        acessorios.push(linha);
      }
    }
    if (shape === "server" || shape === "stack") {
      for (const l of laminas) {
        const painel = new Mesh(new BoxGeometry(box.w * 0.7, H * 0.1, 1), face);
        painel.position.set(-box.w * 0.04, l.position.y, box.h / 2 + 0.5);
        acessorios.push(painel);
      }
    }
    for (const acessorio of acessorios) corpo.add(acessorio);
    // Os detalhes da forma na face de cima; os pinos de um chip, rentes à base.
    if (forma !== null && (forma.detalhes.length > 0 || forma.circulos.length > 0)) {
      const pts: Vector3[] = [];
      const fora = (p: { x: number; y: number }) => Math.abs(p.x) > box.w / 2 + 1e-6 || Math.abs(p.y) > box.h / 2 + 1e-6;
      for (const d of forma.detalhes) {
        const y = d.some(fora) ? H * 0.18 : H * 1.01;
        for (let i = 1; i < d.length; i += 1) pts.push(new Vector3(d[i - 1]!.x, y, d[i - 1]!.y), new Vector3(d[i]!.x, y, d[i]!.y));
      }
      for (const c of forma.circulos) {
        for (let i = 0; i < 24; i += 1) {
          const a0 = (i / 24) * Math.PI * 2;
          const a1 = ((i + 1) / 24) * Math.PI * 2;
          pts.push(new Vector3(c.x + Math.cos(a0) * c.r, H * 1.01, c.y + Math.sin(a0) * c.r), new Vector3(c.x + Math.cos(a1) * c.r, H * 1.01, c.y + Math.sin(a1) * c.r));
        }
      }
      detalhe = new LineSegments(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ transparent: true }));
      corpo.add(detalhe);
    }
    for (const l of laminas) corpo.add(l);

    const bordaMat = new LineBasicMaterial({ transparent: true });
    const borda = new LineSegments(new EdgesGeometry(geo, 30), bordaMat);
    const bordasDasLaminas = laminas.map((l) => {
      const b = new LineSegments(new EdgesGeometry(l.geometry, 30), bordaMat);
      b.position.copy(l.position);
      corpo.add(b);
      return b;
    });
    if (shape === "stack" || shape === "server") borda.visible = false;
    borda.position.copy(mesh.position);
    borda.rotation.copy(mesh.rotation);
    corpo.add(borda);

    // A onda de "aconteceu aqui": um anel no chão, em volta da peça.
    const anelMat = this.#material({ transparent: true, opacity: 0, emissiveIntensity: 1 });
    const anel = new Mesh(new RingGeometry(0.5, 0.56, 48), anelMat);
    anel.rotation.x = -Math.PI / 2;
    anel.position.y = 0.6;
    corpo.add(anel);
    const raioDoAnel = Math.max(box.w, box.h) * 0.62;

    const { obj, el } = etiqueta("iso-label", spec.label ?? "");
    obj.position.set(0, (shape === "stack" || shape === "server" ? H * 1.6 : H) * 1.08 + Math.min(4, H * 0.3), 0);
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

    const materiais: Material[] = [mat, face, contatoMat, bordaMat, anelMat, ...(vidaMat === null ? [] : [vidaMat])];
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
          mat.color = base.clone().lerp(t, acabamento.mistura);
          mat.emissive = t;
          bordaMat.color = t;
          if (detalhe !== null) (detalhe.material as LineBasicMaterial).color = t;
          anelMat.color = t;
          anelMat.emissive = t;
          vidaMat?.color.copy(t);
        }
        mat.emissiveIntensity = 0.04 + s.glow * 0.38;
        mat.opacity = visivel;
        contatoMat.opacity = visivel * 0.12;
        face.opacity = visivel;
        bordaMat.opacity = Math.min(1, visivel * (0.55 + 0.45 * s.glow));
        if (detalhe !== null) (detalhe.material as LineBasicMaterial).opacity = visivel * 0.8;
        corpo.position.set(box.x + box.w / 2 + s.dx, elevacao + s.lift, box.y + box.h / 2 + s.dy);
        corpo.scale.setScalar(s.scale);
        // Acender levanta a peça um pouco: a energia vira altura.
        // Proporcional à peça: 3 unidades fixas jogavam uma porta de 0,45 de
        // altura sete alturas para cima, longe do próprio rótulo.
        mesh.position.y = H / 2 + s.glow * H * 0.12;
        borda.position.y = mesh.position.y;
        if (detalhe !== null) detalhe.position.y = s.glow * H * 0.12;
        laminas.forEach((l, i) => {
          // Aceso, o rack "respira": as lâminas se afastam um pouco.
          l.position.y = ((H * 1.6) / 3) * (i + 0.5) + s.glow * H * (0.05 + i * 0.05);
          bordasDasLaminas[i]!.position.y = l.position.y;
          if (acessorios[i] !== undefined) acessorios[i]!.position.y = l.position.y;
        });
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
    // Tudo que tem tamanho fixo (ponta, altura, rótulo) escala com a peça: num
    // nível fundo, uma ponta de seta de 4,5 unidades cobre a porta inteira.
    const k = spec.textScale ?? 1;
    const pontos = pontosDoCaminho(spec.path, 1, 48, 1.5 * k);
    const geo = new LineGeometry();
    geo.setPositions(pontos.flatMap((v) => [v.x, v.y, v.z]));
    const mat = this.#linha(corDe(p.tom(tom), p.tinta), 2, spec.dashed === true);
    const linha = new Line2(geo, mat);
    linha.computeLineDistances();
    root.add(linha);
    const segmentos = pontos.length - 1;

    const pontaMat = this.#material({ transparent: true });
    const ponta = new Mesh(new ConeGeometry(4.5 * k, 11 * k, 16), pontaMat);
    ponta.visible = spec.arrow === true;
    root.add(ponta);

    const at = spec.labelAt ?? 0.5;
    const meio = poseAt(spec.path, at);
    const { obj, el } = etiqueta("iso-link", spec.label ?? "");
    obj.position.set(meio.x, 10 * k, meio.y);
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
        root.position.set(s.dx, spec.elevation ?? 0, s.dy);
        if (ponta.visible) {
          const tip = poseAt(spec.path, s.progress);
          ponta.position.set(tip.x, 1.5 * k, tip.y);
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
    const mat = this.#material({ roughness: 0.3, emissiveIntensity: 0.9, transparent: true });
    const esfera = new Mesh(new SphereGeometry(r, 24, 16), mat);
    esfera.castShadow = true;
    root.add(esfera);
    const haloMat = new SpriteMaterial({ map: halo(), transparent: true, depthWrite: false, opacity: 0.55 });
    const brilho = new Sprite(haloMat);
    brilho.scale.setScalar(r * 6);
    root.add(brilho);
    const rastros: Mesh[] = [];
    const rastroMat = this.#material({ transparent: true, opacity: 0.35, emissiveIntensity: 0.6 });
    for (let k = 0; k < (spec.trail ?? 6); k += 1) {
      const m = new Mesh(new SphereGeometry(r * (1 - (k + 1) / ((spec.trail ?? 6) + 2)), 12, 8), rastroMat);
      rastros.push(m);
      root.add(m);
    }
    const { obj, el } = etiqueta("iso-token", spec.label ?? "");
    root.add(obj);
    // Arco e altura proporcionais ao caminho: num nível fundo o caminho mede
    // unidades, e um salto fixo de 16 jogaria a ficha para fora do quadro.
    const comprimento = pathLength(spec.path);
    const salto = Math.min(60, comprimento * 0.22);
    const base = Math.min(14, comprimento * 0.12);
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
        root.position.y = spec.elevation ?? 0;
        const aqui = pontoNoAr(spec.path, s.progress, base, salto);
        esfera.position.set(aqui.x + s.dx, aqui.y, aqui.z + s.dy);
        esfera.scale.setScalar(s.scale);
        brilho.position.copy(esfera.position);
        rastros.forEach((m, k) => {
          const u = s.progress - (k + 1) * 0.022;
          m.visible = u > 0;
          if (!m.visible) return;
          const q = pontoNoAr(spec.path, u, base, salto);
          m.position.set(q.x + s.dx, q.y, q.z + s.dy);
        });
        obj.position.set(esfera.position.x, esfera.position.y + r * 2.2, esfera.position.z);
        // Etiqueta de pacote: cabeçalho na cor do tipo e o conteúdo embaixo.
        const chave = `${s.label}\u0000${s.sublabel}`;
        if (el.dataset.k !== chave) {
          el.dataset.k = chave;
          el.replaceChildren();
          const head = document.createElement("span");
          head.className = "iso-token__head";
          head.textContent = s.label;
          el.appendChild(head);
          if (s.sublabel !== "") {
            const sub = document.createElement("span");
            sub.className = "iso-token__sub";
            sub.textContent = s.sublabel;
            el.appendChild(sub);
          }
          el.hidden = s.label === "";
        }
        marcar(el, "tone", s.tone);
      },
    };
  }

  #barra(spec: Extract<EntitySpec, { type: "bar" }>, p: Paleta, tom: Tone): Peca {
    const root = new Group();
    const { box } = spec;
    const alto = 9 * (spec.textScale ?? 1);
    const mat = this.#material({ roughness: 0.5, transparent: true, emissiveIntensity: 0.15 });
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
        root.position.y = spec.elevation ?? 0;
        const w = baixo ? box.w : box.w * s.progress;
        const h = baixo ? box.h * s.progress : box.h;
        mesh.scale.set(Math.max(0.01, w), 1, Math.max(0.01, h));
        mesh.position.set(box.x + w / 2 + s.dx, alto / 2, box.y + h / 2 + s.dy);
        obj.position.set(box.x + box.w + 10 * (spec.textScale ?? 1) + s.dx, alto * 1.2, box.y + 8 * (spec.textScale ?? 1) + s.dy);
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
