import { CAMADAS, filmeDaRede, TOM_DO_PROTOCOLO, type CapituloDaRede, type DetalheDaRede } from "@ovh/network-domain";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, useMemo, useState } from "react";
import { url } from "../lib/urls";
import { ModosDoLab } from "./ModosDoLab";
import { BotaoCopiar, RedeLab } from "./RedeLab";
import { OQueE, VistaRede, VistaSequencia } from "./RedeVistas";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

/**
 * Os prints da equipe no Cisco Packet Tracer, um por capítulo, tirados do
 * `labs/telecentro-network/entrega/telecentro-equipe-10.pkt`. São os mesmos
 * arquivos dos testes do PDF de entrega (`apps/site/public/network/packet-tracer/`).
 * O painel mostra a captura real ao lado da saída esperada; um capítulo sem
 * print diz qual tirar.
 */
const PRINTS: Partial<Record<CapituloDaRede, string>> = {
  network: "teste-7-vlans.png",
  dhcp: "teste-2-dhcp.png",
  dns: "teste-3-dns.png",
  http: "teste-3-pagina-pelo-nome.png",
  nat: "teste-4-nat.png",
  acl: "teste-5-acl.png",
  ssh: "teste-6-ssh.png",
};

const ROTULO_DA_CAMADA: Record<(typeof CAMADAS)[number], string> = {
  application: "application",
  transport: "transport",
  network: "network (IP)",
  link: "link (Ethernet · 802.1Q)",
};

function PainelPacketTracer({ d, capitulo }: { d: DetalheDaRede; capitulo: CapituloDaRede | undefined }) {
  const print = capitulo === undefined ? undefined : PRINTS[capitulo];
  return (
    <section className="redelab-pt" aria-label="The same step in Cisco Packet Tracer">
      <h3 className="redelab-h">In Cisco Packet Tracer · {d.packetTracer.onde}</h3>
      <details className="redelab-cli">
        <summary>Commands ({d.packetTracer.comandos.length} lines)</summary>
        <div className="redelab-config">
          <BotaoCopiar texto={d.packetTracer.comandos.join("\n")} rotulo="Copy the commands of this step" />
          <pre className="mono">{d.packetTracer.comandos.join("\n")}</pre>
        </div>
      </details>
      <p className="redelab-h">Expected output</p>
      <pre className="mono redelab-saida">{d.packetTracer.saida.join("\n")}</pre>
      {print === undefined ? (
        <p className="redelab-print-falta">Screenshot pending: capture this output in your .pkt and save it as <code>network/packet-tracer/{capitulo}.png</code>.</p>
      ) : (
        <img className="redelab-print" src={`${url()}network/packet-tracer/${print}`} alt={`Packet Tracer screenshot: ${capitulo}`} loading="lazy" />
      )}
    </section>
  );
}

function Vitrine() {
  const [acl, setAcl] = useState(true);
  const [nat, setNat] = useState(true);
  const filme = useMemo(() => filmeDaRede({ acl, nat }), [acl, nat]);
  // "Network" abre primeiro: cada aparelho com a cara que ele tem. A sequência
  // mostra as mesmas mensagens no tempo; o 3D continua para quem quer a altura.
  const vistas: readonly MotionView<DetalheDaRede>[] = [
    { id: "rede", label: "Network", render: ({ film: f, frame, label }) => <VistaRede film={f} frame={frame} label={label} /> },
    { id: "sequencia", label: "Sequence", render: ({ film: f, frame, label }) => <VistaSequencia film={f} frame={frame} label={label} /> },
    {
      id: "iso",
      label: "3D",
      render: ({ film: f, t, frame, label }) => (
        <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
          <IsoStage film={f} t={t} frame={frame} label={label} />
        </Suspense>
      ),
    },
  ];
  return (
    <div className="cpuvit redelab" data-testid="network-showcase">
      <MotionPlayer
        film={filme}
        views={vistas}
        initialView="rede"
        flatLabel="Blocks"
        label="A community telecentre network: a learner's laptop joins the public Wi-Fi, gets an address by DHCP, resolves a name, opens the OpenLabs page, reaches the internet through NAT, and is stopped by an ACL at the staff network."
        packetsTitle="Packets"
        packetLegend={[
          { label: "DHCP", tone: TOM_DO_PROTOCOLO.dhcp },
          { label: "DNS", tone: TOM_DO_PROTOCOLO.dns },
          { label: "HTTP", tone: TOM_DO_PROTOCOLO.http },
          { label: "ICMP (ping)", tone: TOM_DO_PROTOCOLO.icmp },
          { label: "SSH", tone: TOM_DO_PROTOCOLO.ssh },
          { label: "dropped / lost", tone: TOM_DO_PROTOCOLO.perdido },
        ]}
        controls={
          <>
            <label className="ctxlab-switch" htmlFor="rede-acl">
              <input id="rede-acl" type="checkbox" role="switch" checked={acl} onChange={(e) => setAcl(e.target.checked)} />
              <span className="ctxlab-switch__track" aria-hidden="true">
                <span />
              </span>
              <span>ACL on the Wi-Fi</span>
            </label>
            <label className="ctxlab-switch" htmlFor="rede-nat">
              <input id="rede-nat" type="checkbox" role="switch" checked={nat} onChange={(e) => setNat(e.target.checked)} />
              <span className="ctxlab-switch__track" aria-hidden="true">
                <span />
              </span>
              <span>NAT to the ISP</span>
            </label>
          </>
        }
        renderDetail={(frame) => {
          const d = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="cpuvit-detail">
              <ol className="cpuvit-niveis mono" aria-label="Layer">
                {CAMADAS.map((c) => (
                  <li key={c} data-on={c === d.camada ? "" : undefined}>
                    {ROTULO_DA_CAMADA[c]}
                  </li>
                ))}
              </ol>
              <dl className="cpuvit-linhas mono">
                {d.linhas.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <PainelPacketTracer d={d} capitulo={frame.chapter?.id as CapituloDaRede | undefined} />
            </div>
          );
        }}
      />
    </div>
  );
}

export function RedeModos() {
  return (
    <>
      <ModosDoLab showcase={() => <Vitrine />} simulation={() => <RedeLab />} inicial="showcase" />
      <OQueE />
    </>
  );
}
