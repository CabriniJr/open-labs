# A rede do telecentro no Cisco Packet Tracer

A contraparte real do lab [`labs/telecentro-network`](../../apps/site/src/pages/labs/telecentro-network.astro):
a mesma rede que o filme desenha, montada no Packet Tracer para a disciplina
**Network Architect Solutions** (GS 2026.2 · CitizenTech).

**Tudo o que você digita sai do modelo.** O plano de endereçamento e a
configuração de cada aparelho estão na aba **Simulation** do lab (Addressing
plan · R1 config · SW1 config · ISP config · Server, AP and hosts), gerados por
`packages/network-domain`. Se o número da equipe mudar, mude `EQUIPE_PADRAO` em
`packages/network-domain/src/telecentro/topologia.ts` e copie de novo.

> Número da equipe: **X = 10** → faixa `192.168.10.0/24`. Não houve numeração
> oficial das equipes; o número foi escolhido pela equipe e é o mesmo no `.pkt`,
> no PDF e no lab.

**A rede já está montada:** [`entrega/telecentro-equipe-10.pkt`](entrega/telecentro-equipe-10.pkt)
(Cisco Packet Tracer 9.0.1). Ao abrir, espere uns 30 segundos (ou clique em
*Fast Forward Time*) para o switch convergir e os hosts pegarem endereço por
DHCP. As running-configs lidas dos aparelhos estão ao lado
(`entrega/running-config-*.txt`), e os prints dos testes em
`apps/site/public/network/packet-tracer/`. As seções 3 e 4 abaixo explicam
como montar a mesma rede do zero.

**Entrega.** Com o site no ar (`pnpm dev`),
`node labs/telecentro-network/entrega/gerar-pdf.mjs` gera o PDF a partir de
`/labs/telecentro-network/entrega/`. Os nomes e RMs vêm de um `equipe.json`
local, fora do git (veja o cabeçalho do script). Sem esse arquivo, sai um
rascunho com o campo em amarelo. Os PDFs não vão para o repositório.

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

## 3. Montagem, clique por clique

Tempo estimado: 30 a 40 minutos. Os comandos estão no lab, aba **Simulação**,
nas abas *R1 config*, *SW1 config* e *ISP config*. Cada uma tem o botão
**Copiar comandos**. Os nomes de menu abaixo são os do Packet Tracer 8, em
inglês.

### 3.1 Colocar os aparelhos

A barra de aparelhos fica no canto inferior esquerdo: primeiro a categoria, depois o modelo.

| Aparelho | Categoria → modelo | Depois de soltar |
|---|---|---|
| R1 e ISP | *Network Devices → Routers → 2911* (dois) | clique no nome embaixo do ícone e renomeie para `R1` e `ISP` |
| SW1 | *Network Devices → Switches → 2960* | renomeie para `SW1` |
| AP-TELECENTRO | *Network Devices → Wireless Devices → AccessPoint-PT* | renomeie |
| PC-MONITOR | *End Devices → PC* | renomeie |
| LAPTOP-CIDADAO | *End Devices → Laptop* | renomeie, e troque a placa (3.3) |
| SRV-OPENLABS e WEB-INTERNET | *End Devices → Server* (dois) | renomeie |

Uma dica de organização: deixe WEB-INTERNET e ISP de um lado ("a internet") e o resto do outro, como na topologia do PDF.

### 3.2 Ligar os cabos

*Connections* (ícone do raio) → **Copper Straight-Through** (a linha preta
contínua). Clique no aparelho de origem, escolha a porta na lista, clique no
de destino, escolha a porta. As portas exatas estão na tabela da seção 2:

1. PC-MONITOR **FastEthernet0** → SW1 **FastEthernet0/1**
2. AP-TELECENTRO **Port 0** → SW1 **FastEthernet0/2**
3. SRV-OPENLABS **FastEthernet0** → SW1 **FastEthernet0/3**
4. SW1 **GigabitEthernet0/1** → R1 **GigabitEthernet0/0**
5. R1 **GigabitEthernet0/1** → ISP **GigabitEthernet0/0**
6. ISP **GigabitEthernet0/1** → WEB-INTERNET **FastEthernet0**

Os pontos dos cabos ficam vermelhos no começo: é normal. Eles ficam verdes depois do `no shutdown` (passos 3.4 e 3.5) e depois do tempo de convergência do switch, de até 30 segundos.

### 3.3 Trocar a placa do notebook para Wi-Fi

LAPTOP-CIDADAO → aba **Physical**:

1. Desligue o notebook no botão de energia da imagem.
2. Arraste a placa de rede que está na lateral (*PT-LAPTOP-NM-1CFE*) para a lista de módulos à esquerda.
3. Arraste **WPC300N** da lista para o encaixe vazio.
4. Ligue de novo.

### 3.4 SW1

SW1 → aba **CLI** → aperte Enter → cole os comandos de *SW1 config*. O switch
já sai salvo (`write memory` é a última linha).

### 3.5 R1

R1 → aba **CLI**. Na pergunta *"Would you like to enter the initial
configuration dialog? [yes/no]"*, digite `no` e Enter. Depois cole os
comandos de *R1 config*.

- O `crypto key generate rsa` demora alguns segundos. Se o CLI perguntar o tamanho da chave, responda `1024`.
- Se alguma linha der `% Invalid input`, cole de novo só o bloco daquela parte. O CLI do Packet Tracer às vezes perde linhas quando recebe muitas de uma vez. Colar em duas metades evita isso.

### 3.6 ISP

ISP → aba **CLI** → `no` na pergunta inicial → cole *ISP config*.

### 3.7 Servidores, ponto de acesso e hosts

Os valores estão na aba *Server, AP and hosts* do lab.

- **SRV-OPENLABS**
  1. *Desktop → IP Configuration → Static*: IP `192.168.10.162`, máscara `255.255.255.240`, gateway `192.168.10.161`, DNS `192.168.10.162`.
  2. *Services → DNS*: ligue (On). Acrescente os dois registros, Name + Address + *Add*:
     - `openlabs.telecentro` → `192.168.10.162`
     - `www.internet.example` → `203.0.113.10`
  3. *Services → HTTP*: deixe ligado e edite o `index.html` com a **Ficha da CitizenTech**.
- **WEB-INTERNET:** *Desktop → IP Configuration → Static*: IP `203.0.113.10`, máscara `255.255.255.0`, gateway `203.0.113.1`.
- **AP-TELECENTRO:** *Config → Port 1*: SSID `TELECENTRO-LIVRE`, *WPA2-PSK*, *PSK Pass Phrase* `AprenderLivre2026`, *Encryption Type* AES.
- **LAPTOP-CIDADAO**
  1. *Config → Wireless0*: SSID `TELECENTRO-LIVRE`, *WPA2-PSK*, a mesma senha.
  2. *Desktop → IP Configuration → DHCP*. Deve aparecer `192.168.10.2` em poucos segundos; se aparecer *"DHCP failed"*, clique em DHCP de novo.
- **PC-MONITOR:** *Desktop → IP Configuration → DHCP*. Deve aparecer `192.168.10.130`.

### 3.8 Salvar

*File → Save As* → `telecentro-equipe-10.pkt`. Esse é o arquivo da entrega.

### 3.9 Se algo não funcionar

Rode no CLI do aparelho e mande a saída para conferência:

- `show ip interface brief`: todas as interfaces usadas devem estar *up/up*.
- `show vlan brief` (no SW1)
- `show running-config`
- `ipconfig` (no notebook ou no PC)

O lab mostra o que cada um deve exibir. Uma diferença ali aponta direto para o passo que faltou.

## 4. Testes que vão no PDF (um print cada)

Cada teste é um capítulo do filme; o painel *In Cisco Packet Tracer* mostra o
comando e a saída esperada. Os prints do `.pkt` estão com estes nomes em
`apps/site/public/network/packet-tracer/` e registrados em `PRINTS`
(`apps/site/src/components/RedeModos.tsx`); o lab mostra a captura real ao
lado da saída esperada. O PDF usa também os prints complementares
(`teste-2-dhcp-pc`, `teste-3-dns`, `teste-4-nat-navegador`,
`teste-5-acl-contadores`, `teste-6-ssh-wifi`, `teste-8-wpa2-ap`,
`teste-8-wpa2-notebook`) e `topologia.png`. Todos foram tirados do `.pkt`
entregue, depois de reaberto, sem nenhum ajuste manual.

O `.pkt` usa os comentários e as descrições de interface em português
(`configR1(t, "pt")`, e o mesmo para SW1 e ISP); o lab mostra a versão em
inglês. Os comandos são idênticos nas duas (há teste para isso).

| Print | Capítulo | Onde | Comando | O que deve aparecer |
|---|---|---|---|---|
| `teste-7-vlans.png` | Three rooms, one cable | SW1 | `show vlan brief` | VLANs 10, 20, 30 com as portas |
| `teste-2-dhcp.png` | DHCP | LAPTOP · Command Prompt | `ipconfig /all` | 192.168.10.2, gateway .1, DNS .162 |
| `teste-3-dns.png` | DNS | LAPTOP · Command Prompt | `nslookup openlabs.telecentro` | 192.168.10.162 |
| `teste-3-pagina-pelo-nome.png` | HTTP | LAPTOP · Web Browser | `http://openlabs.telecentro` | a página com a Ficha (**a página abrindo pelo nome**) |
| `teste-4-nat.png` | NAT | R1 (depois de abrir `http://www.internet.example` no laptop) | `show ip nat translations` | 100.64.10.1:1025 ↔ 192.168.10.2:1025 |
| `teste-5-acl.png` | ACL | LAPTOP · Command Prompt | `ping 192.168.10.130` | `Destination host unreachable` (**acesso barrado**) |
| `teste-6-ssh.png` | SSH | PC-MONITOR · Command Prompt | `ssh -l admin 192.168.10.129` | `Password:` |
| `teste-1-ping-entre-vlans.png` | — | PC-MONITOR | `ping 192.168.10.162` | resposta com TTL=127 (**ping entre VLANs**) |

O enunciado pede: ping entre VLANs, PC recebendo IP por DHCP, página abrindo
pelo nome, `show ip nat translations` e um acesso barrado pela ACL. Os cinco
estão na tabela.

**Duas diferenças normais.** O primeiro ping costuma perder uma resposta enquanto
o ARP resolve. A tabela de NAT só tem a linha enquanto a conversa está viva:
rode o `show` logo depois de abrir a página. Os tempos (`time<1ms`) variam.

## 5. Senhas de laboratório

As senhas estão em `CREDENCIAIS` (`ios.ts`). Elas são de exemplo, para o PDF.
Numa rede de verdade, troque todas.
