// locale: skip-file — a Ficha da CitizenTech é um documento em português (o PDF de entrega e a página do servidor no Packet Tracer), não interface do site.
import { texto } from "./enderecamento.js";
import type { Telecentro } from "./topologia.js";

/**
 * A Ficha da CitizenTech: os nove campos do briefing, na ordem do enunciado.
 * É a mesma ficha no PDF de entrega e na página que o servidor do telecentro
 * serve. O telecentro é o do Jardim Ângela, o mesmo que o banco de dados
 * cadastra com a faixa 192.168.10.0/24.
 */
export function ficha(t: Telecentro): ReadonlyArray<readonly [campo: string, valor: string]> {
  return [
    ["Nome da CitizenTech", "OpenLabs no Telecentro"],
    ["Cidade e bairro", "São Paulo (SP) — Jardim Ângela, no Telecentro Jardim Ângela"],
    ["Cidadão beneficiado", "Quem não tem computador nem internet em casa e quer aprender tecnologia: estudantes de escola pública, jovens e adultos da comunidade."],
    ["Problema, em uma frase", "O ensino de tecnologia gratuito e prático não chega a quem mais precisa dele."],
    ["Como funciona", "Um telecentro comunitário oferece Wi-Fi gratuito e computadores; o OpenLabs roda no servidor local, com laboratórios interativos que funcionam mesmo sem internet."],
    ["O que cada parte faz", `A rede separa equipe, Wi-Fi público (${t.ssid}) e servidores em VLANs e protege o servidor do OpenLabs; o banco de dados guarda telecentros, alunos, labs e avaliações; a API publica esses dados; os algoritmos e a análise de dados medem o uso e o aprendizado.`],
    ["Link do repositório", "https://github.com/CabriniJr/open-labs"],
    ["Indicador de impacto", "Alunos ativos por telecentro e avaliações concluídas por mês."],
    ["ODS conectados", "ODS 4 (educação de qualidade), ODS 9 (inovação e infraestrutura), ODS 10 (redução das desigualdades), ODS 11 (cidades e comunidades sustentáveis)."],
  ];
}

/** Sem acento: o navegador do Packet Tracer não garante UTF-8. */
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/—/gu, "-");

/** A página que o servidor do telecentro serve: a Ficha da CitizenTech. */
export function fichaHtml(t: Telecentro): string {
  return [
    "<html><head><title>OpenLabs no Telecentro</title></head><body>",
    "<h1>Ficha da CitizenTech</h1>",
    ...ficha(t).map(([campo, valor]) => `<p><b>${semAcento(campo)}:</b> ${semAcento(valor)}</p>`),
    `<p><i>Servido por SRV-OPENLABS (${texto(t.dispositivos.srv.ip!)}) na VLAN ${t.subredes.servidores.vlan}.</i></p>`,
    "</body></html>",
  ].join("\n");
}
