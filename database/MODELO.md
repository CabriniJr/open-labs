# Modelo do banco do OpenLabs no Telecentro

Gerado por `database/gerar.mjs` a partir de `packages/database-domain`. É um diagrama de
**conferência**: o diagrama entregue na disciplina é o do Oracle Data Modeler (veja
`README.md`, seção 2). Os dois têm de mostrar as mesmas tabelas e ligações.

```mermaid
erDiagram
  T_TELECENTRO ||--|{ T_MONITOR : "telecentro"
  T_TELECENTRO ||--o{ T_ALUNO : "telecentro"
  T_TELECENTRO ||--o{ T_COMPUTADOR : "telecentro"
  T_HANDBOOK ||--|{ T_FASE : "handbook"
  T_FASE ||--o{ T_LAB : "fase"
  T_LAB ||--o{ T_AVALIACAO : "lab"
  T_ALUNO ||--o{ T_PROGRESSO : "aluno"
  T_LAB ||--o{ T_PROGRESSO : "lab"
  T_ALUNO ||--o{ T_TENTATIVA : "aluno"
  T_AVALIACAO ||--o{ T_TENTATIVA : "avaliacao"
  T_TELECENTRO {
    NUMBER id_telecentro PK
    VARCHAR2 nm_telecentro
    VARCHAR2 nm_bairro
    VARCHAR2 nm_cidade
    CHAR sg_uf
    NUMBER nr_computadores
    VARCHAR2 ds_faixa_rede UK
    DATE dt_inauguracao
  }
  T_MONITOR {
    NUMBER id_monitor PK
    NUMBER id_telecentro FK
    VARCHAR2 nm_monitor
    VARCHAR2 ds_email UK
    DATE dt_admissao
  }
  T_ALUNO {
    NUMBER id_aluno PK
    NUMBER id_telecentro FK
    VARCHAR2 nm_aluno
    DATE dt_nascimento
    VARCHAR2 ds_email UK
    DATE dt_cadastro
    CHAR st_ativo
  }
  T_COMPUTADOR {
    NUMBER id_computador PK
    NUMBER id_telecentro FK
    VARCHAR2 nm_hostname
    VARCHAR2 ds_endereco_ip
    NUMBER nr_vlan
  }
  T_HANDBOOK {
    NUMBER id_handbook PK
    VARCHAR2 cd_slug UK
    VARCHAR2 nm_handbook
    VARCHAR2 ds_assunto
    VARCHAR2 st_estagio
  }
  T_FASE {
    NUMBER id_fase PK
    NUMBER id_handbook FK
    NUMBER nr_ordem
    VARCHAR2 nm_fase
  }
  T_LAB {
    NUMBER id_lab PK
    NUMBER id_fase FK
    VARCHAR2 cd_slug UK
    VARCHAR2 nm_lab
    VARCHAR2 tp_interacao
    NUMBER nr_minutos
    CHAR st_disponivel
  }
  T_AVALIACAO {
    NUMBER id_avaliacao PK
    NUMBER id_lab FK
    VARCHAR2 nm_avaliacao
    NUMBER nr_questoes
    NUMBER pc_aprovacao
  }
  T_PROGRESSO {
    NUMBER id_progresso PK
    NUMBER id_aluno FK
    NUMBER id_lab FK
    DATE dt_inicio
    DATE dt_conclusao
  }
  T_TENTATIVA {
    NUMBER id_tentativa PK
    NUMBER id_aluno FK
    NUMBER id_avaliacao FK
    DATE dt_envio
    NUMBER nr_acertos
    NUMBER vl_nota
  }
```
