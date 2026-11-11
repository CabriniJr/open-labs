---
title: "A foreign key is a promise the database keeps"
dek: "T_ALUNO.id_telecentro is just a number until a constraint says what it points to. From then on the database checks it on every write, from every program, in both directions — and that is what turns ten tables into one model of a telecentre."
handbook: databases
phase: 1
lab: labs/telecentro-database
sources:
  - id: codd-1970
    author: "E. F. Codd"
    year: "1970"
    title: "A Relational Model of Data for Large Shared Data Banks"
    where: "Communications of the ACM 13(6), 377–387"
    url: "https://doi.org/10.1145/362384.362685"
    note: "The paper that defined relations, primary keys and foreign keys. Read section 1.3 for keys and why a relation is a set of rows identified by values, not by position."
  - id: oracle-integrity
    author: "Oracle"
    year: "19c"
    title: "Data Integrity"
    where: "Oracle Database Concepts"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/data-integrity.html"
    note: "Why rules belong in the database rather than in each application, and what a foreign key — a referential integrity constraint — requires of every value."
  - id: oracle-constraint
    author: "Oracle"
    year: "19c"
    title: "constraint"
    where: "Oracle Database SQL Language Reference"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/constraint.html"
    note: "The syntax of PRIMARY KEY, UNIQUE, CHECK and FOREIGN KEY ... REFERENCES, and the semantics of each, including what happens to a NULL."
---

In the OpenLabs database, a learner row carries a number: `id_telecentro = 1`.
That number means "Telecentro Jardim Ângela" only because a row in `T_TELECENTRO`
has `id_telecentro = 1`. On its own, the column is an integer like any other. You
could store 77 in it, and nothing about the integer would object.

What makes it a relationship is one line of DDL:

```sql
ALTER TABLE T_ALUNO ADD CONSTRAINT FK_ALUNO_TELECENTRO
  FOREIGN KEY (id_telecentro) REFERENCES T_TELECENTRO (id_telecentro);
```

From that moment the database promises that every value in `T_ALUNO.id_telecentro`
matches a value in `T_TELECENTRO.id_telecentro`
([Oracle, data integrity](#src-oracle-integrity)). The idea is as old as the
relational model. Rows are not found by position or by pointer; they are found
by the values of their keys, and a key held in another table is how two
relations refer to each other ([Codd](#src-codd-1970)).

## The promise works in both directions

A promise about a reference has two ways of being broken, and the database
watches both.

**Writing a child that points to nothing.** Insert a learner in telecentre 77,
and the database looks for the parent, does not find it, and refuses with
`ORA-02291: integrity constraint violated - parent key not found`. In the lab's
film, this is the moment when the INSERT token travels to `T_TELECENTRO` and
comes back red.

**Deleting a parent that still has children.** Delete telecentre 1, and the
database finds learners, monitors and computers still pointing to it. It
refuses with `ORA-02292: child record found`. The foreign keys in this schema
use the default rule, which forbids deleting a referenced row
([constraint](#src-oracle-constraint)). The alternatives, `ON DELETE CASCADE`
or `ON DELETE SET NULL`, are decisions about what a deletion means. Here a
telecentre with learners should not disappear by accident, so it does not.

## Why the database, and not the program

The OpenLabs database is written to by more than one program. The SQL scripts
load the sample data, the Java API inserts learners and attempts, and a monitor
may fix a row by hand in SQL Developer. If the rule "a learner belongs to an
existing telecentre" lived in the API, the other two would not know about it.
A constraint declared in the database applies to every statement, whoever runs
it, which is why Oracle recommends declaring integrity rules there instead of
re-implementing them in each application ([Oracle, data integrity](#src-oracle-integrity)).

The same is true of the other rules in `01-ddl.sql`, which form a stack. A row
has to pass all of them, in this order.

| Rule | In the OpenLabs schema | Refusal |
| --- | --- | --- |
| `NOT NULL` | every learner has a name | `ORA-01400` |
| type and size | `vl_nota NUMBER(4,2)` holds at most 99.99 | `ORA-01438` |
| `PRIMARY KEY` / `UNIQUE` | one `id_aluno`; one progress row per learner and lab | `ORA-00001` |
| `CHECK` | `vl_nota BETWEEN 0 AND 10`; `nr_vlan IN (10, 20, 30)` | `ORA-02290` |
| `FOREIGN KEY` | the telecentre, the lab, the assessment must exist | `ORA-02291` |

The foreign key is the only rule on this list that has to look at another table.

## Cardinality is where the foreign key lives

A foreign key always sits on the "many" side. `T_ALUNO` holds `id_telecentro`
because a telecentre has many learners and a learner has one telecentre: one to
many, written `T_TELECENTRO 1 — 0..N T_ALUNO` in the lab's diagram. Since the
column is `NOT NULL`, the "1" is mandatory. A learner without a telecentre
cannot be written.

Many to many has no side to put the key on. A learner does many labs, and a lab
is done by many learners. A column holding a list of lab ids would be one value
the database cannot check, join or count. The relational answer is a table in
between: `T_PROGRESSO` holds one row per learner and lab, with two foreign keys
and a `UNIQUE (id_aluno, id_lab)` that stops the same pair from being written
twice. `T_TENTATIVA` does the same for learners and assessments. The schema has
two many-to-many relationships, so it has two associative tables, and each one
carries facts that belong to the pair, such as the start date or the grade.

## What the promise does not cover

A foreign key says the parent exists. It does not say the parent is the right
one: if a learner was registered in telecentre 2 by mistake, the constraint is
satisfied. It also says nothing about a `NULL` foreign key, which refers to no
row and is accepted ([Oracle, data integrity](#src-oracle-integrity)). That is why every
foreign key in the OpenLabs schema is also `NOT NULL`: a learner, a progress
row and an attempt always belong to something.

> [!deeper] Why does 01-ddl.sql add the foreign keys last?
>
> A foreign key references the primary or unique key of another table, so
> that key has to exist first ([Oracle, data integrity](#src-oracle-integrity)). The script
> creates all ten tables first, then adds primary keys, unique keys and checks,
> and only then the foreign keys, so the order of the `CREATE TABLE`
> statements does not matter. The inserts in `02-dml.sql` have no such freedom.
> A child row needs its parent, so `T_TELECENTRO` and `T_HANDBOOK` are filled
> before `T_ALUNO` and `T_FASE`, and the associative tables come last. In the
> lab's 3D view, that order is the height: each table stands on the tables it
> references. These constraints are also what Oracle Data Modeler reads when
> it imports the DDL and draws the relationship lines.
