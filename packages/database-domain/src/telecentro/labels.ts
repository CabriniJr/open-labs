import type { NomeDaTabela } from "./esquema.js";

/**
 * O que as pessoas costumam achar de um banco relacional, e o que a
 * documentação diz. Cada linha é uma crença que o lab foi feito para desmontar.
 */
export interface MalEntendidoDeBanco {
  readonly crenca: string;
  readonly spec: string;
  readonly fonte: string;
}

const ORACLE = "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf";

export const MAL_ENTENDIDOS_DO_BANCO: readonly MalEntendidoDeBanco[] = [
  {
    crenca: "A foreign key is just a column that holds the other table's id.",
    spec: "The constraint is what makes it a foreign key: the database refuses a child row whose value has no parent (ORA-02291) and refuses deleting a parent that still has children (ORA-02292). Without the constraint, it is only a number.",
    fonte: `${ORACLE}/constraint.html`,
  },
  {
    crenca: "A CHECK constraint refuses NULL.",
    spec: "A check constraint is violated only when its condition is FALSE. A NULL makes the condition UNKNOWN, and UNKNOWN passes — NOT NULL is a separate rule.",
    fonte: `${ORACLE}/constraint.html`,
  },
  {
    crenca: "With good data, INNER JOIN and LEFT OUTER JOIN return the same rows.",
    spec: "An outer join also returns the rows that have no match, with NULL in the other table's columns. Rows with no partner are often the answer — the learners who never took an assessment.",
    fonte: `${ORACLE}/Joins.html`,
  },
  {
    crenca: "Many-to-many fits in a column that lists the ids.",
    spec: "In the relational model every value is atomic: one column, one value. A many-to-many relationship becomes a table of pairs — T_PROGRESSO, T_TENTATIVA — each linked 1:N to both sides.",
    fonte: "https://dl.acm.org/doi/10.1145/362384.362685",
  },
  {
    crenca: "An empty text and NULL are different things.",
    spec: "In Oracle they are not: a character value of length zero is treated as NULL, so an empty name hits NOT NULL (ORA-01400).",
    fonte: `${ORACLE}/Nulls.html`,
  },
];

/** O que uma linha de cada tabela é, em inglês, para o site (o dicionário de dados, em português, está em `esquema.ts`). */
export const SOBRE_A_TABELA: Readonly<Record<NomeDaTabela, string>> = {
  T_TELECENTRO: "One row per community telecentre: free computers and public Wi-Fi where OpenLabs runs.",
  T_MONITOR: "One row per staff member who helps learners at a telecentre.",
  T_ALUNO: "One row per learner from the community. The e-mail is optional; st_ativo says whether they still attend.",
  T_COMPUTADOR: "One row per machine on the telecentre network, with the address and VLAN from the networks lab.",
  T_HANDBOOK: "One row per OpenLabs course: networks, OpenTelemetry, Kubernetes…",
  T_FASE: "One row per step of a handbook's curriculum, in order.",
  T_LAB: "One row per interactive lab: a model that runs and that the learner can break.",
  T_AVALIACAO: "One row per end-of-lab checkpoint.",
  T_PROGRESSO: "One row per learner per lab, with the start and finish dates. It turns learner × lab (N:N) into two 1:N.",
  T_TENTATIVA: "One row per assessment a learner hands in, with the grade. It turns learner × assessment (N:N) into two 1:N.",
};

/** A pergunta de cada consulta e o que a junção faz, em inglês, para o site. */
export const SOBRE_A_CONSULTA: Readonly<Record<"consulta1" | "consulta2" | "consulta3", { readonly pergunta: string; readonly juncao: string }>> = {
  consulta1: {
    pergunta: "Who are the learners, and which telecentre does each one attend?",
    juncao: "INNER JOIN keeps only rows that have a partner on both sides. Every learner has a telecentre — the foreign key guarantees it — so every learner appears.",
  },
  consulta2: {
    pergunta: "How many active learners does each telecentre serve, and since when?",
    juncao: "The INNER JOIN pairs each telecentre with its learners, WHERE keeps the active ones, and GROUP BY folds the pairs into one line per telecentre — COUNT, MIN and MAX summarise each pile.",
  },
  consulta3: {
    pergunta: "Which active learners have not taken any assessment yet?",
    juncao: "LEFT OUTER JOIN keeps every learner, even the ones with no attempt — their T_TENTATIVA columns come back NULL. WHERE … IS NULL keeps exactly those: the list a monitor uses to call whoever may be stuck.",
  },
};

/** O que cada coluna guarda, em inglês, para o site. O português está em `esquema.ts` (`descricao`). */
export const SOBRE_A_COLUNA: Readonly<Record<NomeDaTabela, Readonly<Record<string, string>>>> = {
  T_TELECENTRO: {
    id_telecentro: "Telecentre identifier.",
    nm_telecentro: "Name of the telecentre.",
    nm_bairro: "Neighbourhood where it is.",
    nm_cidade: "City where it is.",
    sg_uf: "State abbreviation.",
    nr_computadores: "How many computers the telecentre offers.",
    ds_faixa_rede: "Address range of the local network (the same as in the networks lab), e.g. 192.168.10.0/24.",
    dt_inauguracao: "Date it opened to the public.",
  },
  T_MONITOR: {
    id_monitor: "Monitor identifier.",
    id_telecentro: "Telecentre where they work.",
    nm_monitor: "Monitor's name.",
    ds_email: "Contact e-mail (unique).",
    dt_admissao: "Date they started at the telecentre.",
  },
  T_ALUNO: {
    id_aluno: "Learner identifier.",
    id_telecentro: "Telecentre where they signed up.",
    nm_aluno: "Learner's name.",
    dt_nascimento: "Date of birth (for classes by age group).",
    ds_email: "E-mail, optional: not every learner has one.",
    dt_cadastro: "Sign-up date.",
    st_ativo: "S = attends; N = away.",
  },
  T_COMPUTADOR: {
    id_computador: "Machine identifier.",
    id_telecentro: "Telecentre where it is.",
    nm_hostname: "Name on the network (as in Packet Tracer).",
    ds_endereco_ip: "Fixed IP; empty when the address comes from DHCP.",
    nr_vlan: "VLAN: 10 staff, 20 citizens (Wi-Fi), 30 servers.",
  },
  T_HANDBOOK: {
    id_handbook: "Handbook identifier.",
    cd_slug: "Code used in the site address, e.g. networks.",
    nm_handbook: "Handbook name.",
    ds_assunto: "Subject in one or two words.",
    st_estagio: "building = under construction; planned = planned.",
  },
  T_FASE: {
    id_fase: "Phase identifier.",
    id_handbook: "Handbook it belongs to.",
    nr_ordem: "Position in the curriculum (1, 2, 3…).",
    nm_fase: "Phase title.",
  },
  T_LAB: {
    id_lab: "Lab identifier.",
    id_fase: "Curriculum phase the lab is in.",
    cd_slug: "Code used in the address, e.g. telecentro-network.",
    nm_lab: "Lab title.",
    tp_interacao: "Kind of model: flow, state, film or direct manipulation.",
    nr_minutos: "Estimated time to finish, in minutes.",
    st_disponivel: "S = published; N = coming soon.",
  },
  T_AVALIACAO: {
    id_avaliacao: "Assessment identifier.",
    id_lab: "Lab being assessed.",
    nm_avaliacao: "Assessment title.",
    nr_questoes: "Number of questions.",
    pc_aprovacao: "Minimum percentage to pass.",
  },
  T_PROGRESSO: {
    id_progresso: "Progress record identifier.",
    id_aluno: "Learner.",
    id_lab: "Lab.",
    dt_inicio: "When the learner first opened the lab.",
    dt_conclusao: "When they finished; empty while in progress.",
  },
  T_TENTATIVA: {
    id_tentativa: "Attempt identifier.",
    id_aluno: "Learner who answered.",
    id_avaliacao: "Assessment answered.",
    dt_envio: "When the attempt was handed in.",
    nr_acertos: "How many questions were right.",
    vl_nota: "Grade from 0 to 10.",
  },
};

/** O vocabulário do modelo relacional, cada termo com o exemplo daqui. */
export type IdDoConceito = "tabela" | "atributo" | "pk" | "fk" | "uk" | "nulo" | "check" | "relacionamento" | "cardinalidade" | "associativa";

export interface Conceito {
  readonly id: IdDoConceito;
  readonly nome: string;
  readonly oQueE: string;
  readonly aqui: string;
}

export const CONCEITOS: readonly Conceito[] = [
  { id: "tabela", nome: "Table (entity)", oQueE: "A grid that describes one kind of thing. Each row is one occurrence of it.", aqui: "T_ALUNO has one row per learner; T_LAB one row per lab." },
  { id: "atributo", nome: "Attribute (column)", oQueE: "One property of the thing, always of the same type: a number, a text, a date.", aqui: "nm_aluno VARCHAR2(80), dt_cadastro DATE, vl_nota NUMBER(4,2)." },
  { id: "pk", nome: "Primary key (PK)", oQueE: "The column that identifies each row. It never repeats and is never empty. Underlined in the diagram.", aqui: "id_aluno in T_ALUNO, id_lab in T_LAB — every table has one." },
  { id: "fk", nome: "Foreign key (FK)", oQueE: "A column that holds the primary key of a row in another table. The database refuses a value that does not exist there.", aqui: "T_ALUNO.id_telecentro points to T_TELECENTRO.id_telecentro." },
  { id: "uk", nome: "Unique (UK)", oQueE: "A value, or a pair of values, that cannot repeat — without being the primary key.", aqui: "ds_email in T_MONITOR; the pair (id_aluno, id_lab) in T_PROGRESSO." },
  { id: "nulo", nome: "Optional (NULL)", oQueE: "A column that may be left empty. In the diagram it ends in “?”; all the others are NOT NULL.", aqui: "ds_email? in T_ALUNO: not every learner has an e-mail." },
  { id: "check", nome: "Rule (CHECK)", oQueE: "A condition every row must satisfy, or the database refuses it.", aqui: "vl_nota BETWEEN 0 AND 10; nr_vlan IN (10, 20, 30)." },
  { id: "relacionamento", nome: "Relationship", oQueE: "The link a foreign key creates between two tables. In the diagram it is the line from the FK column to the PK it points to.", aqui: "Each learner belongs to a telecentre: T_ALUNO → T_TELECENTRO." },
  { id: "cardinalidade", nome: "Cardinality", oQueE: "How many rows on one side match how many on the other. Two bars mean exactly one; the fork means many; a circle before it means it may be zero, a bar means at least one.", aqui: "T_TELECENTRO 1 — 0..N T_ALUNO; T_TELECENTRO 1 — 1..N T_MONITOR." },
  { id: "associativa", nome: "Associative table", oQueE: "A table in between that turns a many-to-many relationship into two one-to-many.", aqui: "T_PROGRESSO (learner × lab) and T_TENTATIVA (learner × assessment)." },
];
