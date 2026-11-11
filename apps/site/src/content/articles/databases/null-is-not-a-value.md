---
title: "NULL is not a value, it is a question mark"
dek: "Bruno has no e-mail, and five learners have no attempt. In SQL both come out as NULL, which means unknown, not empty and not zero. Comparisons with it return a third truth value, and that third value explains why a LEFT JOIN can quietly become an INNER JOIN and why COUNT(*) reports attempts nobody took."
handbook: databases
phase: 2
lab: labs/join-by-hand
sources:
  - id: oracle-nulls
    author: "Oracle"
    year: "19c"
    title: "Nulls"
    where: "Oracle Database SQL Language Reference"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Nulls.html"
    note: "Short and complete: the empty string is treated as NULL, any comparison with NULL is UNKNOWN, and a WHERE clause that evaluates to UNKNOWN returns no rows. The table of conditions containing nulls is worth memorising."
  - id: oracle-null-conditions
    author: "Oracle"
    year: "19c"
    title: "Null Conditions"
    where: "Oracle Database SQL Language Reference"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Null-Conditions.html"
    note: "IS NULL and IS NOT NULL — the only conditions that test for NULL and return TRUE or FALSE."
  - id: oracle-constraint
    author: "Oracle"
    year: "19c"
    title: "constraint"
    where: "Oracle Database SQL Language Reference"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/constraint.html"
    note: "Check constraints: each row must make the condition TRUE or unknown, which is why a CHECK does not refuse a NULL."
  - id: oracle-joins
    author: "Oracle"
    year: "19c"
    title: "Joins"
    where: "Oracle Database SQL Language Reference"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Joins.html"
    note: "Inner joins, outer joins, and the rows an outer join returns from one table when no row of the other satisfies the join condition."
  - id: oracle-count
    author: "Oracle"
    year: "19c"
    title: "COUNT"
    where: "Oracle Database SQL Language Reference"
    url: "https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/COUNT.html"
    note: "COUNT(expr) counts the rows where expr is not null; COUNT(*) counts all rows, nulls included."
---

`T_ALUNO.ds_email` is optional. Bruno, learner 2, has no e-mail, so his row stores
`NULL`. The temptation is to read that as an empty field, or a blank string, or
a zero. In SQL it is none of those. It marks a value that is unknown or absent,
and the database treats it as a question mark that cannot be compared with
anything, not even with another question mark.

## Comparisons with NULL are not false

Ask for learners whose e-mail equals `NULL`:

```sql
SELECT nm_aluno FROM T_ALUNO WHERE ds_email = NULL;
```

It returns no rows. Not Bruno, not anyone. `ds_email = NULL` is neither true nor
false: it is **UNKNOWN**, and Oracle's own table of conditions lists `a = NULL`,
`a != NULL` and `a = 10` (with `a` null) as UNKNOWN
([Nulls](#src-oracle-nulls)). A `WHERE` clause keeps only rows for which the
condition is TRUE, so a condition that evaluates to UNKNOWN returns nothing
([Nulls](#src-oracle-nulls)). To ask the question you meant, use the conditions
built for it, `IS NULL` and `IS NOT NULL`, which answer TRUE or FALSE
([Null conditions](#src-oracle-null-conditions)).

Oracle adds a twist: it treats a character value of length zero as NULL
([Nulls](#src-oracle-nulls)). An empty name is a missing name, which is why the
lab's "learner with an empty name" is refused by `NOT NULL` (`ORA-01400`) and
not stored as `''`.

## A CHECK lets NULL through

`T_TENTATIVA` has `CHECK (vl_nota BETWEEN 0 AND 10)`. Insert a NULL grade, and
the check evaluates to UNKNOWN, which is not FALSE. A check constraint is
satisfied when the condition is TRUE *or unknown* ([constraint](#src-oracle-constraint)),
so the row passes the check. What stops it is a different rule: the column is
`NOT NULL`. In the OpenLabs schema the two always come as a pair when a value is
required, because each one closes a gap the other leaves open.

## The JOIN makes NULLs of its own

So far the NULLs were stored in the table. A LEFT OUTER JOIN creates new ones.
Join `T_ALUNO` with `T_TENTATIVA` on `te.id_aluno = a.id_aluno`, and the five
learners with no attempt still come out, once each, with every attempt column
NULL. That is what an outer join adds to an inner one: the rows of one table
for which no row of the other satisfies the join condition
([Joins](#src-oracle-joins)). In the lab, INNER returns 12 rows and LEFT returns 17.

Then the third truth value strikes. Add a filter on the grade:

```sql
  FROM T_ALUNO a
  LEFT OUTER JOIN T_TENTATIVA te
    ON te.id_aluno = a.id_aluno
 WHERE te.vl_nota >= 7
```

The `WHERE` runs on the rows the join produced. For the five learners without
an attempt, `te.vl_nota` is NULL and `NULL >= 7` is UNKNOWN, so their rows are
dropped, together with every attempt below 7. The result has 8 rows, exactly the
same as the INNER JOIN. The LEFT JOIN did its work and the WHERE undid it. Move
the condition into `ON`, and it chooses which attempt counts as a partner
instead. Every learner stays, and those without a good grade come back with
NULL: 14 rows.

This is also why the third query of the OpenLabs database is written the way
it is. To find active learners who never took an assessment, it keeps them with
a LEFT JOIN and then asks for exactly the NULL the join created:
`WHERE te.id_tentativa IS NULL`.

## Counting rows, counting values

Group the LEFT JOIN by learner and count:

```sql
SELECT a.nm_aluno, COUNT(*) FROM … GROUP BY a.id_aluno, a.nm_aluno;
```

Mateus, who never took an assessment, is reported with 1. `COUNT(*)` counts
rows, nulls included, and his NULL row is a row. `COUNT(te.id_tentativa)`
counts the rows where the expression is not null ([COUNT](#src-oracle-count)),
and gives him 0. One character in the query decides whether the report the
monitor reads is true.

> [!deeper] Why does NOT UNKNOWN stay UNKNOWN?
>
> SQL logic has three values, and negation does not rescue a question mark: NOT
> FALSE is TRUE, but NOT UNKNOWN is still UNKNOWN ([Nulls](#src-oracle-nulls)).
> So `WHERE NOT (ds_email = 'x')` does not return Bruno either. His e-mail is
> not known to differ from 'x'. When a NULL can reach a condition, write the
> case explicitly, with `IS NULL`, an `OR`, or a function such as `NVL` that
> substitutes a value you choose. In the lab, the grade filter shows the same
> rule from the other side: whatever turns a NULL into UNKNOWN in a `WHERE`
> removes that row.
