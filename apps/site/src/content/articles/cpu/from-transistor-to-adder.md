---
title: "From transistor to adder"
dek: "Nothing in an adder knows how to add. Four switches make a NAND, nine NANDs make one bit of addition, and the sum appears because the composition is right — which is also why the thing is slow in a way no faster transistor can fix."
handbook: cpu
phase: 2
lab: labs/gates
sources:
  - id: shannon-1938
    author: "Claude E. Shannon"
    year: "1938"
    title: "A Symbolic Analysis of Relay and Switching Circuits"
    where: "Transactions of the American Institute of Electrical Engineers, vol. 57"
    note: "Series contacts are a conjunction, parallel contacts a disjunction. The pull-down network in every CMOS gate below is that sentence, drawn."
  - id: wanlass-sah-1963
    author: "Frank M. Wanlass and Chih-Tang Sah"
    year: "1963"
    title: "Nanowatt logic using field-effect metal-oxide-semiconductor triodes"
    where: "ISSCC Digest of Technical Papers"
    note: "The complementary pair. Read it for why the two networks must be duals, not merely opposites."
  - id: wanlass-patent-1967
    author: "Frank M. Wanlass"
    year: "1967"
    title: "Low Stand-By Power Complementary Field Effect Circuitry, US Patent 3,356,858"
    where: "United States Patent and Trademark Office"
    url: "https://patents.google.com/patent/US3356858A/en"
    note: "The drawings show the inverter, the NAND and the NOR in the order this article builds them."
  - id: kogge-stone-1973
    author: "Peter M. Kogge and Harold S. Stone"
    year: "1973"
    title: "A Parallel Algorithm for the Efficient Solution of a General Class of Recurrence Equations"
    where: "IEEE Transactions on Computers, vol. C-22"
    note: "Carry propagation as a prefix problem. This is the paper that turns the last section's complaint into a fix."
  - id: riscv-isa
    author: "RISC-V International"
    year: "current"
    title: "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA"
    where: "RISC-V International"
    url: "https://riscv.org/technical/specifications/"
    note: "The definition of ADD is two sentences and says nothing about carries. That silence is the point of the closing section."
---

Start with the only component: a switch that is opened and closed by a voltage
rather than a finger.

A MOSFET has three terminals that matter here. Two are the ends of the switch;
the third, the gate, is the command. Put a voltage on the gate and the path
between the other two becomes conducting; remove it and the path opens. The
command terminal draws essentially no steady current — it is a plate of a tiny
capacitor, not a load — which is why one gate's output can command the next
without being drained by it.

There are two flavours, and the difference between them is the whole reason the
next section works.

- An **NMOS** conducts when its gate is high, and it is good at pulling a wire
  down to ground.
- A **PMOS** conducts when its gate is *low*, and it is good at pulling a wire
  up to the supply.

Each is bad at the opposite job. An NMOS dragging a wire upward stops short of
the supply, leaving a weak, degraded 1 — the kind of value the previous article
called dangerous. So the arrangement writes itself: use NMOS only to make
zeros, use PMOS only to make ones, and never ask either to do the other job.

## The two networks

A CMOS gate is two networks in series between the supply and ground, with the
output taken from the point where they meet:

- a **pull-up** network of PMOS transistors, between the supply and the output;
- a **pull-down** network of NMOS transistors, between the output and ground.

They are wired so that for every input combination, exactly one of them
conducts. When the pull-down conducts the output is tied to ground and the gate
says 0; when the pull-up conducts the output is tied to the supply and the gate
says 1.

Two things must never happen, and the model in the lab refuses both out loud.
If *both* networks conduct, there is a path from supply to ground through the
gate: a short, burning current and producing no defensible answer. If
*neither* conducts, the output is connected to nothing — floating, holding
whatever charge it happens to have, which is not a 0, not a 1, and not
detectable by looking at it.

> [!deeper] Why the model refuses instead of guessing
>
> A simulator can always produce *a* number. The cheap implementation of a
> floating node returns the last value, or zero, and the simulation keeps
> running — which is exactly the silent lie this project exists to avoid,
> because the drawing would look correct while describing a circuit that does
> not work.
>
> So the output node in the model counts its branches. It knows how many
> transistors are attached to it, and it refuses to report a value unless
> exactly one network is conducting. Getting that right required making every
> transistor report on every tick, including the ones that are cut off:
> a transistor that stays silent when it is not conducting is indistinguishable
> from a transistor nobody asked, and the node cannot tell a clean pull-down
> from half a circuit that failed to run.

## Series is AND, parallel is OR

Now build the pull-down network for a specific gate, and Shannon's translation
([source](#src-shannon-1938)) does the work.

Two NMOS transistors **in series** conduct only if both are commanded: that
path is a conjunction. Two **in parallel** conduct if either is commanded: that
path is a disjunction. Since the pull-down network conducting means the output
is 0, a series pair gives a gate whose output is 0 exactly when `a AND b` — in
other words, `NOT (a AND b)`. A NAND.

Put the same two transistors in parallel and you get a gate whose output is 0
when `a OR b`: a NOR.

The pull-up network is then forced. It must conduct exactly when the pull-down
does not, and because PMOS transistors are commanded by lows, the construction
is the same shape turned inside out: series becomes parallel, parallel becomes
series. The two networks are duals. This is the structural claim in Wanlass and
Sah ([source](#src-wanlass-sah-1963)), and the drawings in the patent
([source](#src-wanlass-patent-1967)) are the inverter, the NAND and the NOR in
that order.

So the naturally cheap gates in CMOS are the *inverting* ones. NAND costs four
transistors. NOR costs four. And AND costs **six** — a NAND followed by an
inverter — because there is no way to build a non-inverting network out of
switches that only pull in one direction each.

This inverts the intuition most people arrive with. AND and OR are the simple
words, so they feel like the primitives; in silicon they are the compound
forms, and NAND is the atom. Double-click an AND gate in
[Adding, gate by gate](../../../../labs/gates/) and this is what you find: not two
transistors doing something obvious, but a NAND with an inverter hanging off
it.

> [!deeper] Why the parallel side is drawn wide
>
> In the schematic view the model draws for each gate, the pull-up network sits
> against the supply rail at the top and the pull-down against ground at the
> bottom, with transistors in parallel placed side by side and transistors in
> series stacked. That is not decoration — it is the only part of the drawing
> that carries information you cannot get from the label.
>
> Reading the shape tells you the function directly: stacked NMOS means the
> gate says 0 only when *all* those inputs are high, side-by-side NMOS means it
> says 0 when *any* of them is. Once you can read a stack, a gate you have
> never seen before stops being a name to memorise.

## One bit of adding

Adding two bits and an incoming carry produces two outputs:

- the **sum** bit is `a XOR b XOR carry-in` — 1 when an odd number of the three
  inputs are 1;
- the **carry-out** is the majority of the three — 1 when at least two are.

Neither expression contains anything resembling arithmetic. They are Boolean
functions of three bits, and once they are built from gates, the gates have no
idea what they are participating in. That is worth stating plainly because it
is the thing that is genuinely hard to believe until you watch it: put six and
seven into the lab, and thirteen comes out of twenty gates, none of which
contains a table, a rule, or a number.

XOR is the expensive one. It is not a natural CMOS shape — its pull-down
network is not a simple series-parallel arrangement of the inputs — so the
usual construction is four NAND gates, and four NANDs is **sixteen
transistors**. A full adder needs two XORs. That single fact is most of why
arithmetic hardware costs what it does, and it is why the lab's ALU is a
larger, slower thing than the muxes and registers around it.

> [!deeper] The half adder, and why it is not enough
>
> Two bits alone are easier: the sum is `a XOR b` and the carry is `a AND b`.
> That is a *half* adder, and it is a complete answer to the wrong question —
> it has nowhere to put a carry arriving from the bit below.
>
> A full adder is conventionally two half adders and an OR: the first combines
> `a` and `b`, the second combines that partial sum with the incoming carry,
> and the carry-out is 1 if either half adder produced one. Working out why an
> OR suffices — why the two half adders can never both produce a carry at the
> same time — is the small proof that makes the majority function feel
> inevitable rather than memorised.

## Why the adder is slow, and why that is a shape

Chain four full adders, each one's carry-out feeding the next one's carry-in,
and you have the four-bit adder in the lab. It is correct. It is also the
slowest reasonable way to do the job, and the reason is worth being precise
about.

The top bit cannot settle until it knows its carry-in. That carry came from the
bit below, which could not produce it until *its* carry arrived, and so on down
to bit zero. The carry has to walk the whole width of the number, one adder at
a time. Delay grows in proportion to the number of bits — for a 32-bit adder,
a chain roughly eight times longer than the one on screen.

And the delay does not depend on the numbers. Feed the lab two zeros and the
depth counter reads the same as it does for the worst case, because the depth
is measuring the longest path the circuit *contains*, not the work the values
happened to require. The circuit has no shortcut for easy inputs; there is no
"easy" for a circuit. This is the sharpest available demonstration that
propagation delay is a property of structure.

Which is also why it is fixable — by changing the structure. The carry chain
looks sequential, but the question "does a carry come out of bit *k*?" can be
answered without waiting for bit *k−1*, because each bit position either
*generates* a carry (both inputs 1), *propagates* one (exactly one input 1), or
kills it (neither). Those relations compose associatively, and anything
associative can be evaluated as a tree instead of a chain. Kogge and Stone
worked this out in general in 1973 ([source](#src-kogge-stone-1973)),
recognising carry propagation as an instance of a parallel prefix problem —
turning a depth proportional to the width into one proportional to its
logarithm, at the cost of considerably more silicon.

That trade — depth against area — is the shape of nearly every decision above
this level too.

## What the ISA does not say

The RISC-V manual ([source](#src-riscv-isa)) defines `ADD` in about two
sentences: add the two source registers, write the result to the destination,
ignore the overflow. It does not mention a carry chain, a prefix tree, sixteen
transistors, or a nanosecond.

It cannot, and it must not. An implementation is free to use a ripple-carry
adder, a Kogge–Stone tree, or a clerk with an abacus, as long as the bits that
come out match. The lab uses the slow one on purpose, because the slow one is
the one you can see all of at once — and because seeing exactly *why* it is
slow is what makes the fast one make sense.

Next, that adder stops being an isolated circuit and becomes part of something
that holds state: registers, and the ALU that reads them.
