// A rede do telecentro: endereçamento, protocolos, comandos do Packet Tracer e o filme.
export { cidr, curinga, ip, mascara, naRede, prefixoPara, texto, vlsm } from "./telecentro/enderecamento.js";
export type { Ipv4, PedidoDeSubrede, SetorId, Subrede } from "./telecentro/enderecamento.js";
export { EQUIPE_PADRAO, NOME_DA_FICHA, NOME_DA_INTERNET, O_QUE_E, PEDIDOS, planoDeEnderecamento, setorDe, telecentro } from "./telecentro/topologia.js";
export type { Cabo, DispId, Dispositivo, Explicacao, LinhaDoPlano, Papel, Telecentro } from "./telecentro/topologia.js";
export {
  avaliarAcl,
  concessao,
  dora,
  enderecoDe,
  comandoIos,
  linhaIos,
  NOME_DA_ACL,
  NOME_DA_ACL_VTY,
  oferece,
  OPCOES_DA_REDE,
  percorrer,
  regrasDoCidadao,
  resolver,
} from "./telecentro/protocolos.js";
export type { Decisao, MensagemDhcp, OpcoesDaRede, Pacote, Quadro, RegraAcl, Resultado, Salto, Servico, TraducaoNat, Veredito } from "./telecentro/protocolos.js";
export { ajustesGraficos, ALVOS, configIsp, configR1, configSw1, CREDENCIAIS, fichaHtml, ipconfig, saidaDoCliente, showAccessLists, showNat, showVlanBrief } from "./telecentro/ios.js";
export type { AjusteGrafico } from "./telecentro/ios.js";
export { ALTURA_DA_REDE, CAIXAS, CAMADAS, CAPITULOS_DA_REDE, filmeDaRede, LARGURA_DA_REDE, TOM_DO_PROTOCOLO } from "./telecentro/filme.js";
export type { Camada, CapituloDaRede, DetalheDaRede, PassoNoPacketTracer } from "./telecentro/filme.js";
export { MAL_ENTENDIDOS_DA_REDE } from "./telecentro/labels.js";
export type { MalEntendidoDeRede } from "./telecentro/labels.js";
export { ICONES_REDE } from "./icones/icones.js";
