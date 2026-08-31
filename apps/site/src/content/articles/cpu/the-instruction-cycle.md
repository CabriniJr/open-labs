---
title: "The instruction cycle"
dek: "One memory, one address bus, one data bus. The byte that says what to do and the byte that gets worked on cannot cross the same wires in the same instant — so the machine does them in turn, and that turn-taking is the whole cycle."
handbook: cpu
phase: 4
lab: labs/micro
sources:
  - id: von-neumann-1945
    author: "John von Neumann"
    year: "1945"
    title: "First Draft of a Report on the EDVAC"
    where: "Moore School of Electrical Engineering, University of Pennsylvania (contract W-670-ORD-4926)"
    note: "Orders and numbers live in the same memory, addressed the same way. Everything below follows from that one decision — including the part where the machine has to go and get its own instructions."
  - id: burks-goldstine-vonneumann-1946
    author: "Arthur W. Burks, Herman H. Goldstine and John von Neumann"
    year: "1946"
    title: "Preliminary Discussion of the Logical Design of an Electronic Computing Instrument"
    where: "Institute for Advanced Study, Princeton"
    note: "The control organ described as an organ: something that holds the current order and issues it. Read the sections on the control for the argument that a register holding the instruction is not an optimisation but a requirement."
  - id: wilkes-1951
    author: "Maurice V. Wilkes"
    year: "1951"
    title: "The Best Way to Design an Automatic Calculating Machine"
    where: "Report of the Manchester University Computer Inaugural Conference, p. 16"
    note: "The control unit as a sequencer running micro-operations rather than a heap of ad-hoc logic. The phase register in this lab is that idea at its smallest possible size."
  - id: valiante-deck
    author: "Filippo Valiante Filho"
    year: "n.d."
    title: "Princípio de Funcionamento de um Microprocessador"
    where: "Lecture deck, prof.valiante.info — used with the author's permission"
    note: "The reference model this lab reconstructs: the registers, the two buses, the two instruction formats, the phase list and the example program. The prose here is ours; the machine's shape is his."
---

Open [the lab](../../../../labs/micro/), pause it, and step through the first
four instants of any program. Nothing has been added yet. The accumulator still
reads `0x00`, and the machine has spent four instants moving a single byte out
of memory and looking at it.

That is not the lab being slow. It is the machine being honest about something
a diagram usually hides.

## One of everything

This processor has one memory. The program sits at `0x0000`, the data at
`0x2000`, and there is exactly one 16-line address bus and one 8-line data bus
between the memory and the CPU.

Count what those wires can carry. The address bus holds one address at a time —
sixteen wires, sixteen bits, one number. The data bus holds one byte. So in any
one instant the machine can name exactly one memory location and move exactly
one byte to or from it.

Now try to do fetch and execute at once. To fetch, the address bus must carry
the program counter. To execute `ADD 05`, the address bus must carry the
address of the operand. Those are two different numbers, and there is one bus.
The conflict is not subtle and there is no clever wiring around it: the
machine must take turns.

That is the instruction cycle. It is not a pedagogical device, or a convention,
or a stage in a lifecycle diagram. It is what a machine with one address bus
and one data bus is *forced* to do, and everything else in this article is
bookkeeping on top of that one constraint.

> [!deeper] Why the machine has to fetch anything at all
>
> A machine could have its program in a separate store, read by separate
> wires, and then fetching would not compete with executing. Some do — the lab
> next door, [the single-cycle datapath](../../../../labs/cpu/), keeps
> instruction memory and data memory as two objects, which is exactly why an
> entire instruction fits inside one tick there.
>
> The reason this one does not is the design in von Neumann's EDVAC draft
> ([source](#src-von-neumann-1945)): orders and numbers in the same memory,
> written in the same alphabet, addressed the same way. That is what makes a
> program a thing you can load, compute, and overwrite — and the price of it is
> that the orders now live somewhere the machine has to go and get them from,
> over the same wires it uses for everything else.

## A tick is a transfer

In this lab one tick is not one instruction. One tick is one **micro-step**: a
single transfer between registers, or a single bus transaction. The control
unit holds a phase between ticks, and the phase decides which control lines are
lit — which is the only state a single-cycle machine never has to keep.

Fetching an instruction takes three of them, and it is the same three every
time:

1. **Addressing the instruction.** `MAR ← PC`. The address latch takes a copy
   of the program counter, and the address bus now carries it.
2. **Fetching the instruction.** `READ`. The memory answers with a byte and
   the data latch holds it: `MBR` has the opcode.
3. **Decoding.** `IR ← MBR`, and `PC` is incremented. Now the machine knows
   what it was told to do — and not one instant earlier.

That third step is worth sitting with. Until decoding happens the control unit
has no legitimate way to know whether the next byte is a value or the first
half of an address, so it cannot start fetching one. It is not being cautious;
it genuinely does not have the information. The registers holding it — one for
the address going out, one for the byte coming back, one for the order being
obeyed — are the set argued for in the IAS report
([source](#src-burks-goldstine-vonneumann-1946)), and they are minimal in the
strict sense: remove any one and the transfer above has nowhere to land.

## Where the two formats part

After decoding, the machine takes one of two roads, because this instruction
set has exactly two shapes.

**Opcode plus value**, two bytes: `LOAD 0A`, `ADD 05`. Three more micro-steps —
address the operand, fetch it, execute. `LOAD` walks the byte from `MBR` into
the accumulator; `ADD` drops it into the temporary register, lights the adder,
and the accumulator takes the sum. Six instants, opcode to result.

**Opcode plus high byte plus low byte**, three bytes: `STORE 2000`,
`LOADM 2000`, `JMP 000A`, `JZ 0020`. The address does not fit in the eight-bit
data bus, so it arrives in halves: address, fetch, keep in `H`; address, fetch,
keep in `L`. Six micro-steps to assemble one 16-bit number out of two 8-bit
deliveries — the cost of a data bus narrower than an address.

Then the roads part again. `STORE` and `LOADM` still owe the memory a
transaction: `MAR ← H:L` — the one moment in the whole machine when the address
does not come from the program counter — and then the write or the read.
Eleven instants in total. `JMP` and `JZ` owe nothing to memory, because for a
branch the address *is* the result: `PC ← H:L`, and the next fetch lands
somewhere else. Ten instants.

> [!deeper] The branch that is not taken costs the same
>
> `JZ` with the zero flag clear does nothing at all in its last micro-step —
> no register is written, no bus transaction happens. It still takes ten
> instants, because the nine before it were spent finding out what the address
> was, and the machine had to fetch those two bytes before it could know
> whether it wanted them.
>
> This is why branches are expensive in a way that has nothing to do with the
> arithmetic. The work is in the fetching, and the fetching is unconditional.
> Every trick a real processor plays here — predicting, prefetching,
> speculating — is an attempt to get that work done before the answer is
> needed, and it exists because of the seven wasted instants you can watch
> happen in this lab.

## Reading the timing table

The table beside the stage is the second view of the same run, and it is
deliberately coarser than the animation: after an opening row that records
where the program counter started, there is **one row per bus transaction**,
not one row per tick.

Type in the four-instruction example and watch the count:

```
LOAD  0A
ADD   05
ADD   12
STORE 2000
```

Twenty-nine micro-steps go by. Ten of them touch the memory — two for each of
the first three instructions, four for the store — so the table ends up eleven
rows tall, and the animation ran nearly three times as long as the table is
deep. The gap between those two numbers is the work that never reaches a bus.

Read a row as one conversation with the memory. `Control` says whether it was a
`READ` or a `WRITE`. The two bus columns say what was on the address lines and
what came back on the data lines. The register columns say what was written
*because of* that byte — and here is the rule that matters:

**A column that was not written stays empty.** Not "unchanged", not the
previous value repeated: empty. A table that repeated the last value everywhere
would fill up with transfers that never happened, and you could no longer see
which register each instant actually touched.

The converse rule is sharper. When the second `ADD` loads `8B` into the
instruction register, the byte that was already there was also `8B` — nothing
changed. The cell still shows `8B`, because the transfer *happened*. A table
built by comparing before and after would print an empty cell there and quietly
claim the instruction register was untouched during a fetch. That would be a
lie of exactly the kind this project is built to make impossible, so the table
is built from the control lines that were lit, not from differences.

Two more things to look for in a run:

- The last row of a `STORE` is a `WRITE`, and its `PC` column is empty.
  Storing a result does not advance the program.
- Read the `Instruction` column downward and you get the program back, one
  entry per opcode fetch, assembled out of bytes the run actually carried
  rather than out of the source you typed. Keep stepping past the end and a
  twelfth row appears with that column blank: the machine read the byte after
  the program, found nothing that decodes, and stopped. A read that fetched
  garbage is still a read, and it still gets a row.

## The phase is the machine

Everything above is one small idea repeated: the control unit knows which phase
it is in, the phase says which lines to light, and lighting them produces the
next phase. Nothing in the datapath decides anything. The registers do as they
are told; the ALU adds whatever is put in front of it; the memory answers the
address it is given.

Wilkes called this the right way to build a control unit in 1951
([source](#src-wilkes-1951)): rather than wiring a bespoke tangle of logic per
opcode, treat the control as a sequencer that steps through micro-operations.
The machine here is the smallest version of that argument — a phase register
and a table — and its instruction set is small enough that you can hold the
whole sequence in your head, which is the only reason the argument is visible
at all.

The reference model, the register set, the two formats and the phase list all
come from Prof. Valiante's lecture deck ([source](#src-valiante-deck)), used
with his permission. What the lab adds is time: his table is a page, and this
one is a machine that has to arrive at it.

Next, the same sum written for a processor that actually shipped — and what
survives the trip.
