# Roteiro do handbook de redes

O contrato de conteúdo do *Networks Visual Handbook*: um roteiro por lab — a
pergunta, o mal-entendido, a mídia, o showcase, a simulação, o que a altura
significa no 3D, os ícones, as correlações e o critério de pronto. O de forma
está em `.claude/skills/openlabs-lab/SKILL.md`. Atualize este arquivo no mesmo
PR que cria ou muda um lab.

## Por que existe

Nasceu da Global Solution 2026.2 da FIAP (CitizenTech): **acesso gratuito à
educação tecnológica**. O cenário é a rede de um telecentro comunitário — um
lugar gratuito do bairro onde quem não tem computador nem internet aprende
tecnologia. O lugar é o pretexto; o assunto é **como os protocolos funcionam**.

## As regras que valem para todo lab deste handbook

1. **Uma pergunta, um mal-entendido**, como no handbook de OTel.
2. **O dado vem do modelo.** Endereços, etiquetas 802.1Q, TTL, a linha da ACL
   e a tradução do NAT saem de `packages/network-domain`. O filme, a
   simulação e os comandos do Packet Tracer são três leituras do mesmo modelo.
3. **Todo capítulo traz o mesmo passo no Cisco Packet Tracer**: os comandos,
   a saída esperada e o print da equipe quando existir. A saída é a forma
   esperada, não uma captura; o print é a prova.
4. **A altura no 3D é o andar em que o aparelho decide**: hosts no chão (0),
   switch — camada 2 — acima (16), roteador — camada 3 — mais acima (32),
   provedor e internet no topo (48).
5. **A cor do pacote é o protocolo** (`TOM_DO_PROTOCOLO`); vermelho é o que
   foi barrado ou se perdeu. As VLANs são regiões neutras com o número no rótulo.

## Ícones (`ICONES_REDE`)

| ícone | papel |
|---|---|
| `router` | R1 e o ISP |
| `switch` | SW1 |
| `ap` | o ponto de acesso Wi-Fi |
| `laptop`, `pc` | hosts |
| `server` | o servidor do OpenLabs |
| `isp`, `web` | o provedor e o servidor na internet |

## Fase 1 — uma rede que se atravessa

#### telecentro-network — *What happens when a learner joins the telecentre Wi-Fi* · disponível (filme + 3D + livre)
- **Pergunta.** O que acontece, protocolo por protocolo, entre o notebook entrar no Wi-Fi e abrir uma página?
- **Mal-entendido.** "VLAN é só um rótulo" / "o notebook já sabe o próprio IP" / "um 192.168 navega sem NAT" / "a ACL escolhe a melhor regra" / "bloquear um lado deixa o outro passar".
- **Modelo.** `network-domain/telecentro/`: `vlsm` calcula as sub-redes por necessidade; `percorrer(origem, alvo, serviço, {acl, nat})` devolve os saltos com o quadro (MACs, etiqueta 802.1Q, IPs, TTL, portas), o veredito e a linha da ACL que decidiu; `dora` são as quatro mensagens do DHCP; `ios.ts` gera a configuração de R1, SW1 e ISP e as saídas esperadas.
- **Showcase.** `filmeDaRede`: sete capítulos — a rede (VLANs e trunk), DHCP, DNS, HTTP, NAT, ACL e SSH. O painel mostra a camada em foco, o quadro decodificado no salto em curso e o passo no Packet Tracer. **Interativo:** "ACL on the Wi-Fi" e "NAT to the ISP" refazem o filme.
- **Simulação (livre).** `RedeLab`: de quem, para quem, qual serviço; a tabela salto a salto, o veredito, a saída do Command Prompt; e as abas do material (plano de endereçamento e configurações).
- **Contraparte real.** `labs/telecentro-network/README.md`: montagem no Packet Tracer e a lista de prints. A rede montada (vistas lógica e física) está em `labs/telecentro-network/entrega/telecentro-equipe-10.pkt` (Packet Tracer 9.0.1), com as running-configs lidas dos aparelhos ao lado; os prints em `apps/site/public/network/packet-tracer/` alimentam o lab (`PRINTS`) e o PDF de entrega.
- **Pronto quando.** Testes do modelo e do filme verdes, `qa:labs` passando nos dois modos, e os prints da equipe registrados em `PRINTS`. Feito em 13/11/2026: os sete capítulos têm print real.

#### subnetting-by-need · a fazer
Dividir uma /24 pelo número de pessoas de cada setor, e ver o que quebra quando um setor cresce.

## Fase 2 — sair do prédio

#### nat-table · a fazer
Várias conversas ao mesmo tempo atrás de um endereço público: a tabela de PAT com portas diferentes.

## Fase 3 — quem fala com quem

#### acl-order · a fazer
Mover uma linha da ACL e ver o que passa a vazar ou a quebrar.

## Correlações

- ← `host-and-kubernetes-signals` (OTel): o IP de origem que muda entre agent e gateway é o mesmo fenômeno do NAT.
- ← `reading-an-otlp-payload` (OTel): o que viaja dentro do TCP depois que a rede faz a sua parte.
