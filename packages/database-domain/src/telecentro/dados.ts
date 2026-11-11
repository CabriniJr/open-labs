// locale: skip-file — esquema, dados, SQL e mensagens do Oracle: identificadores e saída do banco, que não se traduzem.
// Os dados de exemplo do banco: pelo menos cinco linhas em cada tabela.
//
// Handbooks, fases e labs são o catálogo real do OpenLabs. Telecentros,
// monitores, alunos, computadores, progresso e notas são SIMULADOS: nomes
// fictícios e e-mails no domínio reservado example.com. Nenhum dado pessoal
// real foi usado.
//
// Cada linha traz os valores na ordem das colunas de `esquema.ts`. Datas são
// texto `AAAA-MM-DD` (o tipo DATE da coluna diz como escrevê-las em SQL).
// Daqui saem database/02-dml.sql e o banco que o lab do site carrega.
// Só import de tipo, que o Node apaga: `database/gerar.mjs` lê este arquivo direto.

import type { NomeDaTabela } from "./esquema.js";

export type Valor = number | string | null;

export interface DadosDaTabela {
  /** O comentário que abre a seção da tabela no script DML. */
  readonly nota: string;
  readonly linhas: readonly (readonly Valor[])[];
}

/** Na ordem dos INSERTs: primeiro quem é referenciado, depois quem referencia. */
export const DADOS: Readonly<Record<NomeDaTabela, DadosDaTabela>> = {
  T_TELECENTRO: {
    nota: "a faixa de rede segue o padrão 192.168.X.0/24 da disciplina de redes; o telecentro 1 é o da equipe 10.",
    linhas: [
      [1, "Telecentro Jardim Ângela", "Jardim Ângela", "São Paulo", "SP", 20, "192.168.10.0/24", "2024-03-15"],
      [2, "Telecentro Cidade Tiradentes", "Cidade Tiradentes", "São Paulo", "SP", 15, "192.168.11.0/24", "2023-08-01"],
      [3, "Telecentro Capão Redondo", "Capão Redondo", "São Paulo", "SP", 18, "192.168.12.0/24", "2022-05-20"],
      [4, "Telecentro Jardim Gramacho", "Jardim Gramacho", "Duque de Caxias", "RJ", 12, "192.168.13.0/24", "2025-02-10"],
      [5, "Telecentro Vila Kennedy", "Vila Kennedy", "Rio de Janeiro", "RJ", 10, "192.168.14.0/24", "2025-09-01"],
    ],
  },
  T_MONITOR: {
    nota: "todo telecentro tem pelo menos um monitor.",
    linhas: [
      [1, 1, "Renata Siqueira", "renata.siqueira@example.com", "2024-03-01"],
      [2, 1, "Paulo Freitas", "paulo.freitas@example.com", "2025-01-15"],
      [3, 2, "Sandra Vieira", "sandra.vieira@example.com", "2023-07-20"],
      [4, 3, "Marcos Antunes", "marcos.antunes@example.com", "2022-05-02"],
      [5, 4, "Tatiane Lopes", "tatiane.lopes@example.com", "2025-02-01"],
      [6, 5, "Vinícius Prates", "vinicius.prates@example.com", "2025-08-25"],
    ],
  },
  T_ALUNO: {
    nota: "e-mail é opcional (NULL para quem não tem); dois alunos estão afastados (st_ativo = 'N').",
    linhas: [
      [1, 1, "Ana Beatriz Souza", "2008-04-12", "ana.souza@example.com", "2026-08-03", "S"],
      [2, 1, "Bruno Henrique Lima", "2007-11-30", null, "2026-08-05", "S"],
      [3, 1, "Camila Ferreira Rocha", "1995-02-18", "camila.rocha@example.com", "2026-08-10", "S"],
      [4, 1, "Diego Alves Martins", "2009-07-07", null, "2026-09-01", "N"],
      [5, 2, "Eduarda Nunes Prado", "2006-01-25", "eduarda.prado@example.com", "2026-07-14", "S"],
      [6, 2, "Felipe Cardoso Reis", "1988-09-09", null, "2026-07-20", "S"],
      [7, 2, "Gabriela Monteiro Dias", "2010-03-03", "gabriela.dias@example.com", "2026-09-12", "S"],
      [8, 3, "Henrique Batista Costa", "1979-12-01", "henrique.costa@example.com", "2026-06-02", "S"],
      [9, 3, "Isabela Rezende Paiva", "2008-10-21", null, "2026-06-15", "N"],
      [10, 4, "João Victor Teixeira", "2007-05-05", "joao.teixeira@example.com", "2026-10-01", "S"],
      [11, 4, "Larissa Moura Campos", "1999-08-14", null, "2026-10-03", "S"],
      [12, 5, "Mateus Oliveira Barros", "2005-06-30", "mateus.barros@example.com", "2026-10-20", "S"],
    ],
  },
  T_COMPUTADOR: {
    nota: "os mesmos nomes e endereços do projeto de redes: o servidor tem IP fixo; os outros recebem endereço por DHCP (NULL).",
    linhas: [
      [1, 1, "SRV-OPENLABS", "192.168.10.162", 30],
      [2, 1, "PC-MONITOR", null, 10],
      [3, 1, "LAPTOP-CIDADAO", null, 20],
      [4, 2, "SRV-OPENLABS", "192.168.11.162", 30],
      [5, 2, "PC-MONITOR", null, 10],
      [6, 3, "SRV-OPENLABS", "192.168.12.162", 30],
    ],
  },
  T_HANDBOOK: {
    nota: "o catálogo real do OpenLabs.",
    linhas: [
      [1, "networks", "Networks Visual Handbook", "redes", "building"],
      [2, "otel", "OpenTelemetry Visual Handbook", "observabilidade", "building"],
      [3, "kubernetes", "Kubernetes Visual Handbook", "Kubernetes", "building"],
      [4, "splunk", "Splunk Visual Handbook", "Splunk", "building"],
      [5, "algorithms", "Algorithms Visual Handbook", "algoritmos", "building"],
    ],
  },
  T_FASE: {
    nota: "fases reais dos roteiros; nr_ordem é a posição no roteiro.",
    linhas: [
      [1, 1, 1, "A network you can walk through"],
      [2, 1, 2, "Leaving the building"],
      [3, 1, 3, "Who may talk to whom"],
      [4, 2, 1, "The problem"],
      [5, 2, 2, "The model"],
      [6, 2, 5, "Operating at scale"],
      [7, 3, 1, "A workload becomes real"],
      [8, 4, 2, "Where a byte stream becomes events"],
      [9, 5, 1, "What holds the data"],
    ],
  },
  T_LAB: {
    nota: "labs reais; os dois de redes ainda em breve têm st_disponivel = 'N'.",
    linhas: [
      [1, 1, "telecentro-network", "What happens when a learner joins the telecentre Wi-Fi", "filme", 30, "S"],
      [2, 1, "subnetting-by-need", "Splitting a /24 by how many people need it", "direto", 20, "N"],
      [3, 3, "acl-order", "Move one ACL line and watch what breaks", "direto", 15, "N"],
      [4, 4, "three-pillars", "Three pillars, one blind spot", "fluxo", 25, "S"],
      [5, 5, "anatomy-of-a-trace", "Anatomy of a Trace", "fluxo", 30, "S"],
      [6, 6, "backpressure-and-drops", "Backpressure and drops", "filme", 25, "S"],
      [7, 7, "pod-lifecycle", "A manifest, a Pod, and the controller that replaces it", "estado", 20, "S"],
      [8, 8, "splunk-ingest", "Where parsing happens, and what it costs", "fluxo", 25, "S"],
    ],
  },
  T_AVALIACAO: {
    nota: "um checkpoint por lab publicado.",
    linhas: [
      [1, 1, "Checkpoint: a rede do telecentro", 5, 70],
      [2, 4, "Checkpoint: três pilares", 5, 60],
      [3, 5, "Checkpoint: anatomia de um trace", 4, 60],
      [4, 6, "Checkpoint: backpressure", 5, 70],
      [5, 7, "Checkpoint: ciclo de vida do Pod", 3, 60],
      [6, 8, "Checkpoint: onde o parsing acontece", 4, 60],
    ],
  },
  T_PROGRESSO: {
    nota: "dt_conclusao NULL = lab ainda em andamento.",
    linhas: [
      [1, 1, 1, "2026-08-04", "2026-08-04"],
      [2, 1, 4, "2026-08-11", "2026-08-18"],
      [3, 1, 5, "2026-08-25", null],
      [4, 2, 1, "2026-08-06", "2026-08-13"],
      [5, 3, 1, "2026-08-12", "2026-08-12"],
      [6, 3, 7, "2026-08-19", "2026-08-26"],
      [7, 5, 4, "2026-07-15", "2026-07-15"],
      [8, 5, 6, "2026-07-22", "2026-08-05"],
      [9, 6, 8, "2026-07-21", null],
      [10, 7, 1, "2026-09-13", "2026-09-20"],
      [11, 8, 4, "2026-06-03", "2026-06-03"],
      [12, 8, 8, "2026-06-10", "2026-06-24"],
      [13, 10, 1, "2026-10-02", "2026-10-09"],
      [14, 11, 1, "2026-10-04", null],
      [15, 12, 7, "2026-10-21", "2026-10-21"],
    ],
  },
  T_TENTATIVA: {
    nota: "nota = acertos ÷ questões × 10. Um aluno pode tentar de novo (a aluna 7 refez o checkpoint de redes e subiu de 4 para 8).",
    linhas: [
      [1, 1, 1, "2026-08-04", 4, 8],
      [2, 1, 2, "2026-08-18", 5, 10],
      [3, 2, 1, "2026-08-13", 3, 6],
      [4, 3, 1, "2026-08-12", 5, 10],
      [5, 3, 5, "2026-08-26", 2, 6.67],
      [6, 5, 2, "2026-07-15", 3, 6],
      [7, 5, 4, "2026-08-05", 4, 8],
      [8, 7, 1, "2026-09-20", 2, 4],
      [9, 7, 1, "2026-09-21", 4, 8],
      [10, 8, 2, "2026-06-03", 4, 8],
      [11, 8, 6, "2026-06-24", 3, 7.5],
      [12, 10, 1, "2026-10-09", 5, 10],
    ],
  },
};
