# A rede do telecentro no Cisco Packet Tracer

A contraparte real do lab [`labs/telecentro-network`](../../apps/site/src/pages/labs/telecentro-network.astro):
a mesma rede que o filme desenha, montada no Packet Tracer para a disciplina
**Network Architect Solutions** (GS 2026.2 · CitizenTech).

**Tudo o que você digita sai do modelo.** O plano de endereçamento e a
configuração de cada aparelho estão na aba **Simulation** do lab (Addressing
plan · R1 config · SW1 config · ISP config · Server, AP and hosts), gerados por
`packages/network-domain`. Se o número da equipe mudar, mude `EQUIPE_PADRAO` em
`packages/network-domain/src/telecentro/topologia.ts` e copie de novo.

> Número da equipe provisório: **X = 10** → faixa `192.168.10.0/24`.

## 1. Requisitos do enunciado → onde estão

| Requisito (slide 36) | Como esta rede atende |
|---|---|
| 192.168.X.0/24 em ≥ 3 sub-redes | VLSM: CIDADÃO /25 (100 hosts), EQUIPE /27 (20), SERVIDORES /28 (10) |
| Uma VLAN por setor, trunk 802.1Q, router-on-a-stick | VLANs 10/20/30 no SW1; G0/1 do SW1 em trunk; R1 G0/0.10/.20/.30 com `encapsulation dot1Q` |
| DHCP com um pool por VLAN, excluindo gateway e servidor | 3 pools no R1; `excluded-address` do gateway de cada VLAN e de .161–.162 |
| NAT/PAT até um roteador provedor com servidor externo | `ip nat inside source list 1 interface G0/1 overload`; ISP com WEB-INTERNET 203.0.113.10 |
| Servidor com DNS e HTTP (página com a Ficha) | SRV-OPENLABS 192.168.10.162: DNS `openlabs.telecentro` e `www.internet.example`; HTTP com a Ficha |
| ACL estendida: Wi-Fi só HTTP/DNS do servidor + internet, nada da Equipe | `CIDADAO-IN` na entrada de G0/0.20 |
| Roteador só por SSH, senhas e enable secret | `transport input ssh`, `login local`, `enable secret`, `access-class VTY-EQUIPE` |
| Wi-Fi com WPA2 | AP-TELECENTRO: SSID `TELECENTRO-LIVRE`, WPA2-PSK/AES |

## 2. Aparelhos e cabos

| Aparelho | Modelo no Packet Tracer | Porta → Porta |
|---|---|---|
| R1 | 2911 | G0/0 → SW1 G0/1 (trunk) · G0/1 → ISP G0/0 |
| ISP | 2911 | G0/1 → WEB-INTERNET Fa0 |
| SW1 | 2960-24TT | Fa0/1 → PC-MONITOR · Fa0/2 → AP · Fa0/3 → SRV-OPENLABS |
| AP-TELECENTRO | AccessPoint-PT | Port 0 → SW1 Fa0/2 |
| LAPTOP-CIDADAO | Laptop-PT (troque a placa por **WPC300N**) | sem fio |
| PC-MONITOR | PC-PT | Fa0 → SW1 Fa0/1 |
| SRV-OPENLABS | Server-PT | Fa0 → SW1 Fa0/3 |
| WEB-INTERNET | Server-PT | Fa0 → ISP G0/1 |

Todos os cabos são **Copper Straight-Through**.

## 3. Ordem de montagem

1. Coloque os aparelhos e ligue os cabos da tabela.
2. **SW1**: cole a aba *SW1 config* no CLI.
3. **R1**: cole a aba *R1 config*. O `crypto key generate rsa` pode pedir o tamanho: responda `1024`.
4. **ISP**: cole a aba *ISP config*.
5. **SRV-OPENLABS, WEB-INTERNET, AP, laptop e PC**: preencha os campos da aba *Server, AP and hosts*.
   - No HTTP do servidor, edite o `index.html` com a **Ficha da CitizenTech**.
6. No laptop e no PC, *Desktop → IP Configuration → DHCP*.

## 4. Testes que vão no PDF (um print cada)

Cada teste é um capítulo do filme; o painel *In Cisco Packet Tracer* mostra o
comando e a saída esperada. Salve os prints com estes nomes em
`apps/site/public/network/packet-tracer/` e registre-os em `PRINTS`
(`apps/site/src/components/RedeModos.tsx`), e o lab passa a mostrar a captura
real ao lado da saída esperada.

| Print | Capítulo | Onde | Comando | O que deve aparecer |
|---|---|---|---|---|
| `network.png` | Three rooms, one cable | SW1 | `show vlan brief` | VLANs 10, 20, 30 com as portas |
| `dhcp.png` | DHCP | LAPTOP · Command Prompt | `ipconfig /all` | 192.168.10.2, gateway .1, DNS .162 |
| `dns.png` | DNS | LAPTOP · Command Prompt | `nslookup openlabs.telecentro` | 192.168.10.162 |
| `http.png` | HTTP | LAPTOP · Web Browser | `http://openlabs.telecentro` | a página com a Ficha (**a página abrindo pelo nome**) |
| `nat.png` | NAT | R1 (depois de abrir `http://www.internet.example` no laptop) | `show ip nat translations` | 100.64.10.1:1025 ↔ 192.168.10.2:1025 |
| `acl.png` | ACL | LAPTOP · Command Prompt | `ping 192.168.10.130` | `Destination host unreachable` (**acesso barrado**) |
| `ssh.png` | SSH | PC-MONITOR · Command Prompt | `ssh -l admin 192.168.10.129` | `Password:` |
| *(extra)* | — | PC-MONITOR | `ping 192.168.10.162` | resposta com TTL=127 (**ping entre VLANs**) |

O enunciado pede: ping entre VLANs, PC recebendo IP por DHCP, página abrindo
pelo nome, `show ip nat translations` e um acesso barrado pela ACL. Os cinco
estão na tabela.

**Duas diferenças normais.** O primeiro ping costuma perder uma resposta enquanto
o ARP resolve. A tabela de NAT só tem a linha enquanto a conversa está viva:
rode o `show` logo depois de abrir a página. Os tempos (`time<1ms`) variam.

## 5. Senhas de laboratório

As senhas estão em `CREDENCIAIS` (`ios.ts`). Elas são de exemplo, para o PDF.
Numa rede de verdade, troque todas.
