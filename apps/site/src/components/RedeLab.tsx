import {
  ajustesGraficos,
  configIsp,
  configR1,
  configSw1,
  oferece,
  percorrer,
  planoDeEnderecamento,
  saidaDoCliente,
  telecentro,
  texto,
  type DispId,
  type Resultado,
  type Servico,
} from "@ovh/network-domain";
import { useMemo, useState } from "react";

/**
 * A simulação da rede do telecentro: o leitor escolhe quem fala, com quem e
 * por qual serviço, liga e desliga a ACL e o NAT, e vê o pacote salto a salto
 * — com a etiqueta 802.1Q no trunk, o TTL caindo no roteador, a troca de
 * endereço no NAT e a linha da ACL que decidiu. Ao lado, o comando para
 * repetir o mesmo teste no Packet Tracer e o que ele deve mostrar.
 *
 * As abas de baixo são o material da disciplina: o plano de endereçamento e a
 * configuração de cada aparelho, gerados do mesmo modelo.
 */
const ORIGENS: readonly { id: "laptop" | "pc" | "srv"; rotulo: string }[] = [
  { id: "laptop", rotulo: "Learner's laptop (Wi-Fi)" },
  { id: "pc", rotulo: "Staff PC" },
  { id: "srv", rotulo: "OpenLabs server" },
];
const ALVOS: readonly { id: DispId; rotulo: string }[] = [
  { id: "srv", rotulo: "OpenLabs server" },
  { id: "pc", rotulo: "Staff PC" },
  { id: "laptop", rotulo: "Learner's laptop" },
  { id: "r1", rotulo: "R1 (its gateway)" },
  { id: "web", rotulo: "A website on the internet" },
];
const SERVICOS: readonly { id: Servico; rotulo: string }[] = [
  { id: "ping", rotulo: "ping (ICMP)" },
  { id: "http", rotulo: "web page (HTTP, TCP 80)" },
  { id: "dns", rotulo: "name lookup (DNS, UDP 53)" },
  { id: "ssh", rotulo: "remote login (SSH, TCP 22)" },
];

const VEREDITO: Record<Resultado["veredito"], string> = {
  entregue: "Delivered, and the reply came back",
  "acl-ida": "Dropped by the ACL on the way in",
  "acl-volta": "The request arrived; the reply was dropped",
  "vty-recusado": "Refused by the router's vty lines",
  "sem-rota-volta": "The reply was lost: no route back",
  "sem-servico": "Reachable, but that service does not run there",
};

type Aba = "plan" | "r1" | "sw1" | "isp" | "gui";

export function RedeLab() {
  const t = useMemo(() => telecentro(), []);
  const [origem, setOrigem] = useState<"laptop" | "pc" | "srv">("laptop");
  const [alvo, setAlvo] = useState<DispId>("pc");
  const [servico, setServico] = useState<Servico>("ping");
  const [acl, setAcl] = useState(true);
  const [nat, setNat] = useState(true);
  const [aba, setAba] = useState<Aba>("plan");
  const alvoValido = alvo === origem ? (origem === "srv" ? "pc" : "srv") : alvo;
  const r = useMemo(() => percorrer(t, origem, alvoValido, servico, { acl, nat }), [t, origem, alvoValido, servico, acl, nat]);
  const ok = r.veredito === "entregue";
  const nome = (id: DispId) => t.dispositivos[id].nome;
  const linhaDoSalto = (s: Resultado["ida"][number], volta: boolean) => (
    <tr key={`${volta ? "v" : "i"}:${s.de}:${s.para}:${s.quadro.ttl}`} data-volta={volta ? "" : undefined}>
      <td>
        {nome(s.de)} → {nome(s.para)}
      </td>
      <td className="mono">{s.quadro.vlan === undefined ? "—" : `VLAN ${s.quadro.vlan}`}</td>
      <td className="mono">
        {texto(s.quadro.ipOrigem)} → {texto(s.quadro.ipDestino)}
      </td>
      <td className="mono">{s.quadro.ttl}</td>
      <td>{s.nota}</td>
    </tr>
  );
  const configs: Record<Exclude<Aba, "plan" | "gui">, string[]> = { r1: configR1(t), sw1: configSw1(t), isp: configIsp(t) };

  return (
    <div className="redelab-sim" data-testid="network-simulation">
      <fieldset className="redelab-escolhas">
        <legend className="redelab-h">Send something</legend>
        <label>
          From
          <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
            {ORIGENS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          To
          <select value={alvoValido} onChange={(e) => setAlvo(e.target.value as DispId)}>
            {ALVOS.filter((a) => a.id !== origem).map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select value={servico} onChange={(e) => setServico(e.target.value as Servico)}>
            {SERVICOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rotulo}
                {oferece(alvoValido, s.id) ? "" : " — not running there"}
              </option>
            ))}
          </select>
        </label>
        <label className="ctxlab-switch" htmlFor="sim-acl">
          <input id="sim-acl" type="checkbox" role="switch" checked={acl} onChange={(e) => setAcl(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>ACL on the Wi-Fi</span>
        </label>
        <label className="ctxlab-switch" htmlFor="sim-nat">
          <input id="sim-nat" type="checkbox" role="switch" checked={nat} onChange={(e) => setNat(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>NAT to the ISP</span>
        </label>
      </fieldset>

      <div className="redelab-veredito" data-ok={ok ? "" : undefined} role="status" aria-live="polite">
        <b>{VEREDITO[r.veredito]}.</b> {r.porque}
      </div>

      <div className="redelab-tabela">
        <table>
          <caption className="redelab-h">Hop by hop</caption>
          <thead>
            <tr>
              <th scope="col">Hop</th>
              <th scope="col">802.1Q tag</th>
              <th scope="col">IPv4 src → dst</th>
              <th scope="col">TTL</th>
              <th scope="col">What happens</th>
            </tr>
          </thead>
          <tbody>
            {r.ida.map((s) => linhaDoSalto(s, false))}
            {r.volta.map((s) => linhaDoSalto(s, true))}
          </tbody>
        </table>
      </div>

      <section className="redelab-pt" aria-label="Repeat this test in Packet Tracer">
        <h3 className="redelab-h">Repeat it in Packet Tracer · {nome(origem)} → Desktop</h3>
        <pre className="mono redelab-saida">{saidaDoCliente(t, r).join("\n")}</pre>
      </section>

      <div className="redelab-material">
        <div className="deplab-modes" role="radiogroup" aria-label="Course material">
          {(
            [
              ["plan", "Addressing plan"],
              ["r1", "R1 config"],
              ["sw1", "SW1 config"],
              ["isp", "ISP config"],
              ["gui", "Server, AP and hosts"],
            ] as const
          ).map(([id, rotulo]) => (
            <button key={id} type="button" role="radio" aria-checked={aba === id} onClick={() => setAba(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {aba === "plan" ? (
          <div className="redelab-tabela">
            <table>
              <thead>
                <tr>
                  <th scope="col">Network</th>
                  <th scope="col">VLAN</th>
                  <th scope="col">CIDR</th>
                  <th scope="col">Mask</th>
                  <th scope="col">Gateway</th>
                  <th scope="col">Usable range</th>
                  <th scope="col">Broadcast</th>
                  <th scope="col">Hosts</th>
                </tr>
              </thead>
              <tbody>
                {planoDeEnderecamento(t).map((l) => (
                  <tr key={l.cidr}>
                    <td>{l.rede}</td>
                    <td className="mono">{l.vlan}</td>
                    <td className="mono">{l.cidr}</td>
                    <td className="mono">{l.mascara}</td>
                    <td className="mono">{l.gateway}</td>
                    <td className="mono">{l.faixa}</td>
                    <td className="mono">{l.broadcast}</td>
                    <td>{l.hosts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : aba === "gui" ? (
          <dl className="redelab-gui">
            {ajustesGraficos(t).map((a) => (
              <div key={`${a.aparelho}:${a.onde}`}>
                <dt>
                  <b>{a.aparelho}</b> · {a.onde}
                </dt>
                {a.campos.map(([k, v]) => (
                  <dd key={k} className="mono">
                    {k}: {v}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        ) : (
          <pre className="mono redelab-saida" aria-label={`${aba.toUpperCase()} configuration`}>
            {configs[aba].join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
