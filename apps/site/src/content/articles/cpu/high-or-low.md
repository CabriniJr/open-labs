---
title: "High or low: what a bit costs"
dek: "A bit is not a thing a wire contains. It is a decision imposed on a voltage — and the discipline that makes the decision safe is paid for in headroom, in time, and in energy."
handbook: cpu
phase: 1
sources:
  - id: shannon-1938
    author: "Claude E. Shannon"
    year: "1938"
    title: "A Symbolic Analysis of Relay and Switching Circuits"
    where: "Transactions of the American Institute of Electrical Engineers, vol. 57"
    note: "The paper that says a switching circuit and a Boolean expression are the same object. Everything above this article's line stands on it."
  - id: wanlass-sah-1963
    author: "Frank M. Wanlass and Chih-Tang Sah"
    year: "1963"
    title: "Nanowatt logic using field-effect metal-oxide-semiconductor triodes"
    where: "ISSCC Digest of Technical Papers"
    note: "The complementary pair, and the claim in the title: a gate that holds its answer for almost no power."
  - id: wanlass-patent-1967
    author: "Frank M. Wanlass"
    year: "1967"
    title: "Low Stand-By Power Complementary Field Effect Circuitry, US Patent 3,356,858"
    where: "United States Patent and Trademark Office"
    url: "https://patents.google.com/patent/US3356858A/en"
    note: "The same idea written as a claim, with the drawings. Worth reading for how plainly the stand-by power problem is stated."
  - id: riscv-isa
    author: "RISC-V International"
    year: "current"
    title: "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA"
    where: "RISC-V International"
    url: "https://riscv.org/technical/specifications/"
    note: "Read it looking for the word volt. It is not there, and that absence is the subject of the last section here."
---

A wire does not hold a bit. A wire holds a voltage, and a voltage is a
continuous quantity — 0.00 V, 0.43 V, 1.62 V, and every value in between,
drifting with temperature, with what the neighbouring wire just did, with how
much current the thing at the far end is drawing. Nothing in physics divides
that line in two.

The division is imposed. We declare a band near ground to mean **0**, a band
near the supply to mean **1**, and — this is the part that is easy to skip —
we declare the space between them to mean *nothing at all*. A bit is that
declaration. It is a decision about a voltage, not a property of one.

The decision is not free. It is paid for three times.

## The first cost: headroom

If a gate promised only "I will output something below the threshold for a
zero", then a receiver reading exactly at the threshold would be right at the
edge of being wrong, and the smallest disturbance would flip it. So the two
bands are not adjacent. A gate must **output** more decisively than a gate is
required to **accept**: outputs are pushed hard toward the rails, inputs are
allowed to be sloppier. The gap between what is promised and what is required
is the noise margin, and it is voltage deliberately left unused.

That asymmetry buys something remarkable: a gate emits a signal *cleaner* than
the one it received. Noise picked up along a wire is squeezed back out at the
next gate instead of accumulating. This is why a chain of ten thousand gates
works at all. An analog chain of ten thousand stages would be mud by stage
fifty.

> [!deeper] Why the threshold is not in the middle
>
> The convenient picture is a switch at exactly half the supply. The real
> transfer curve — output voltage against input voltage — is an S: nearly flat
> near each rail, steep in the middle. What matters is not where the curve
> crosses the halfway line but where its slope passes −1. Between those two
> points the gate *amplifies* the difference from the threshold, which is
> exactly the restoring behaviour above. The flat regions are where a whole
> range of inputs collapses onto almost the same output, and that collapse is
> the discarding of noise.
>
> It also explains a rule that otherwise looks like superstition: a slowly
> rising input is dangerous. While the input crawls through the steep region,
> the gate is a high-gain analog amplifier holding its output somewhere in the
> forbidden band, and anything downstream is reading a value that means
> nothing.

## The second cost: time

A gate does not change its output when its input changes. It changes it
*afterwards*.

Every wire has capacitance — it is a conductor near other conductors, and that
is all a capacitor is. To move a wire from 0 to 1 you must move charge onto it,
and the transistor doing the moving delivers current at a finite rate. The
voltage climbs an exponential curve toward the rail, and the gate downstream
does not see a valid 1 until that curve has climbed past the accept
threshold.

So delay is not a tax added to the logic. Delay *is* the logic, seen on a
clock. And it composes the way the circuit is shaped: a signal that must pass
through eight gates in a row waits for eight of those climbs, one after
another, no matter how simple each gate is.

This is the quantity the labs in this handbook count. When
[Adding, gate by gate](../../../../labs/gates/) reports a depth in substeps, it is
not counting work — it is counting the longest chain a value had to walk before
the whole circuit stopped changing. Feed the adder zeros and the depth does not
drop. Nothing was easier; the shape was the same.

> [!deeper] Why the model counts substeps instead of nanoseconds
>
> A real delay is a number of picoseconds that depends on the process, the
> supply voltage, the temperature, the load, and how many other gates that
> output has to drive. Putting a plausible-looking nanosecond figure on the
> screen would be inventing precision the model does not have — and this
> project treats a confident wrong number as worse than an honest coarse one.
>
> What the model *does* know exactly is the structure: which gate cannot settle
> until which other gate has. Counting that is counting the critical path in
> gate delays, which is the unit an architect actually reasons in when
> comparing two designs. The nanoseconds arrive later, from a technology
> library, and they multiply this number — they do not replace it.

## The third cost: energy

Charging that capacitance takes energy, and roughly half of what leaves the
supply is dissipated as heat in the transistor doing the charging rather than
stored on the wire. Discharging spends the stored half as heat too. So each
full swing of a wire costs about `C·V²` of energy, split across the two
transitions — a cost paid per *change*, not per unit of time.

Which gives the central number of digital design: dynamic power grows with the
capacitance you switch, with the switching rate, and with the **square** of the
supply voltage. Halving the supply quarters this term. It also shrinks the
noise margin and slows every one of those exponential climbs, which is the
entire tension in the field compressed into one sentence.

A gate that is not switching, meanwhile, costs almost nothing. That is not
obvious and it is not universal — it is a property of the complementary
arrangement Wanlass and Sah published in 1963
([source](#src-wanlass-sah-1963)), where a pull-up network and a pull-down
network are wired so that in any settled state exactly one of them conducts.
There is no path from supply to ground, so a gate holding an answer draws
essentially no current. The title of that paper is *Nanowatt logic*, and the
claim was as radical as it sounds: the logic families it displaced burned power
continuously just to hold a value still. Wanlass wrote the same idea as a
patent four years later ([source](#src-wanlass-patent-1967)), and it states the
stand-by power problem more plainly than most textbooks do.

The next article opens those two networks up. This one only needs the
consequence: the reason a modern chip can hold billions of bits without melting
is that holding is nearly free, and it is *changing* that costs.

## Why the algebra came first

It would be reasonable to assume the algebra was invented to describe the
circuits. It was the other way round. Boole's algebra of logic was almost a
century old, and unemployed, when Claude Shannon — writing a master's thesis at
MIT, then publishing it in 1938 ([source](#src-shannon-1938)) — observed that a
network of relay contacts and a Boolean expression are not merely analogous.
They are the same object under two notations: contacts in series are a
conjunction, contacts in parallel are a disjunction, and simplifying the
expression *is* removing contacts from the circuit.

That is the hinge this entire handbook turns on. Because a circuit can be
written as an expression, a circuit can be designed by manipulating
expressions, checked by evaluating them, and composed without knowing what is
inside the parts being composed. Every level above this one — gates, adders,
the ALU, the datapath — exists because that translation is exact.

> [!deeper] What the translation does not carry
>
> The algebra is timeless: `a AND b` has no notion of *when*. The circuit is
> not, and the two costs above are precisely what the notation drops.
>
> This is why the same Boolean function has many circuits, why the interesting
> engineering happens in choosing among them, and why the next article can
> claim that a ripple-carry adder is slow *because of its shape* — the shape is
> visible in the circuit and invisible in the expression. It is also why every
> lab here reports depth alongside the answer. The answer is the algebra. The
> depth is the part the algebra threw away.

## What the ISA does not say

Open the RISC-V ISA manual ([source](#src-riscv-isa)) and search for the word
*volt*. It is not there. There is no threshold, no noise margin, no
capacitance, no picosecond.

That absence is a deliberate engineering artefact, and it is the reason the
rest of this handbook is possible. The instruction set is a contract that says
what a machine must *compute*, phrased entirely in bit patterns and their
meanings. Everything in this article sits below that contract. A RISC-V core
built from relays would be slow, enormous, and correct.

So the layers are honest about what they know. This one knows about volts and
knows nothing about instructions. The one above it knows about gates and
nothing about volts. The lab lets you cross the boundary by hand: double-click
a gate in [Adding, gate by gate](../../../../labs/gates/) and the transistors are
there, switching, with the same rule holding one level down.
