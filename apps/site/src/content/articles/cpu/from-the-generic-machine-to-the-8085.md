---
title: "From the generic machine to the 8085"
dek: "The generic machine is not a simplified 8085. Write the same sum for both and the byte streams have the same grammar — opcode first, operand behind it — but the numbers disagree in two specific places, and knowing which two is the difference between a model and a story."
handbook: cpu
phase: 6
sources:
  - id: intel-8080-8085-asm
    author: "Intel Corporation"
    year: "1978"
    title: "8080/8085 Assembly Language Programming Manual"
    where: "Intel Corporation, order number 9800301C"
    url: "https://archive.org/details/bitsavers_intel80859mblyLanguageProgrammingManualNov78_5034151"
    note: "Every opcode byte and every clock-state count quoted below is read from Appendix A of this manual, which lists the instruction set both alphabetically and in numerical order. It is also where the byte-order rule is stated, in the description of LXI."
  - id: intel-mcs80-85-user
    author: "Intel Corporation"
    year: "1983"
    title: "MCS-80/85 Family User's Manual"
    where: "Intel Corporation"
    url: "https://www.bitsavers.org/components/intel/MCS80/MCS80_85_Users_Manual_Jan83.pdf"
    note: "The hardware half: the 8085's AD0–AD7 pins carry the low address byte and then the data, with ALE marking the instant the address is valid. The chip has fewer wires than our model, and the timing chapter shows what that costs."
  - id: valiante-deck
    author: "Filippo Valiante Filho"
    year: "n.d."
    title: "Princípio de Funcionamento de um Microprocessador"
    where: "Lecture deck, prof.valiante.info — used with the author's permission"
    note: "The generic machine, including its three deliberately invented opcodes and the example program compared here. The bridge to a real chip is the last thing the deck does, and this article is our version of that step."
---

Here is the sum from [the lab](../../../../labs/micro/), written for the
machine that runs there:

```
LOAD  0A        ; AC <- 0A
ADD   05        ; AC <- AC + 05
ADD   12        ; AC <- AC + 12
STORE 2000      ; (2000) <- AC
```

```
86 0A / 8B 05 / 8B 12 / B7 20 00
```

Nine bytes. Now the same sum for the Intel 8085 — a chip that shipped, was
documented down to the clock state, and can still be bought:

```
MVI  A,0Ah      ; A <- 0Ah
ADI  05h        ; A <- A + 05h
ADI  12h        ; A <- A + 12h
LXI  H,2000h    ; H <- 20h, L <- 00h
MOV  M,A        ; (H,L) <- A
```

```
3E 0A / C6 05 / C6 12 / 21 00 20 / 77
```

Ten bytes. Put the two streams side by side and read them as sentences rather
than as numbers, because that is where the answer to "was the generic machine
lying to me?" actually lives.

## What does not change

**A byte of opcode, then the operand behind it.** Both machines are read
front-to-back by a processor that does not know what is coming: the first byte
says what to do and how many bytes to expect, and only then can the rest be
interpreted. `3E 0A` is the same sentence as `86 0A` — load this accumulator
with the byte that follows.

**The two formats.** The 8085 has more addressing modes than the generic
machine, but the two the generic machine has are both here, doing the same
jobs: `MVI A,0Ah` and `ADI 05h` are opcode-plus-value in two bytes;
`LXI H,2000h` is opcode-plus-address in three.

**H and L.** They are not an analogy. The 8085 has registers named H and L, it
pairs them to form a 16-bit address, and `M` in a mnemonic means "the memory
byte that H and L point at". `MOV M,A` is `MAR ← H:L` and then a write —
exactly the last two micro-steps of the generic machine's `STORE`, with the
same registers holding the same halves for the same reason.

**One accumulator in the middle of the arithmetic.** `ADI` adds to A and
nowhere else, just as `ADD` adds to AC and nowhere else. The 8085 has six other
general registers, but they are places to keep things, not places to compute.

**And the cycle.** Fetch still precedes execute, and for the same physical
reason. The 8085's address and data lines are not merely shared in the way ours
are — they are *the same pins*. Its eight AD0–AD7 lines carry the low byte of
the address first and the data second, with an ALE pulse marking the instant
the address is on them ([source](#src-intel-mcs80-85-user)). The generic
machine's MAR, which looks like a teaching contrivance, is a real component on
a real 8085 board: an external latch that holds the address after the
processor's pins have moved on to something else.

> [!deeper] Why fewer wires makes the argument stronger
>
> The generic machine has sixteen address wires and eight data wires, all
> separate. The previous article argued that this is already enough to force
> fetch and execute apart: one address bus, one address at a time.
>
> The 8085 has it worse and admits it in the pinout. Multiplexing address and
> data onto the same eight pins saves eight pins on a forty-pin package, and
> the price is paid in time — the low address byte and the data byte take turns
> on the same wires within a single memory access. A model that gave the
> student *more* buses than the real chip would be flattering the hardware. This
> one does not; it just draws the separation that the 8085 achieves with a
> latch.

## What changes

**The opcodes are real, and the deck's are not.** `86`, `8B` and `B7` were
picked by the author of the reference model precisely so that they would not
mean anything ([source](#src-valiante-deck)). On the 8085 those same three
bytes are all valid instructions and none of them is what the generic machine
uses them for: `86` is `ADD M`, `8B` is `ADC E`, `B7` is `ORA A`
([source](#src-intel-8080-8085-asm)). A student who came away thinking `B7`
meant "store" would be carrying a fact that is wrong on every real machine,
which is why the generic machine's opcodes are worth saying out loud as
invented.

**The opcode has fields inside it.** `MOV` on the 8085 is one opcode family:
the top two bits say "move", three bits name the destination, three name the
source. `77` is `MOV M,A` because `110` is the memory pseudo-register and `111`
is the accumulator. With eight opcode bits and 256 possible values, a machine
with seven addressable registers has to spend most of that space encoding
*which* register — while an accumulator machine, having only one place for
arithmetic to happen, spends none of it and can afford to be sparse.

**The address is stored backwards.** This is the difference most worth
noticing, because it changes the bytes on the page. The generic machine reads
an address high half first: `B7 20 00` is store-to-`2000`, and the micro-step
that fills `H` runs before the one that fills `L`.

The 8085 does the opposite. The manual states the rule in the description of
`LXI` — the instruction "loads its third byte into the first register of the
pair and its second byte into the second register", so `LXI H,2000h` assembles
to `21 00 20`, low byte first ([source](#src-intel-8080-8085-asm)). Write
`21 20 00` and you have loaded `0020`, and your program writes its result into
the middle of somebody else's data.

> [!deeper] STA, and the instruction we did not need to split
>
> The 8085 actually has an exact counterpart to the generic `STORE`: `STA
> addr`, opcode `32`, three bytes, "store the accumulator at this address".
> `STA 2000h` is `32 00 20`, and it is `B7 20 00` with a different opcode and
> the two address halves swapped.
>
> The `LXI` + `MOV M,A` pair used above is two instructions where one would do,
> and that is the point of writing it that way: it puts the address in H and L
> where you can see it, and makes the store a *pointer* operation. Once the
> address is in a register pair, incrementing it walks through memory — which
> is how a real program does anything to more than one byte, and something the
> single `STA` form cannot do.

**Time is counted in clock states, not in transfers.** The lab counts
micro-steps, where one tick is one register transfer, and the four generic
instructions cost twenty-nine of them. Intel counts *time periods*: `MVI r` is
7, `ADI` is 7, `LXI` is 10, `MOV M,r` is 7 — thirty-eight for the five-instruction
version ([source](#src-intel-8080-8085-asm)).

Those two numbers do not convert into each other and should not be compared.
A time period on the 8085 is a clock state, and an opcode fetch occupies four
of them by itself; a micro-step in the lab is one transfer, however long the
silicon would need. What survives the difference is the shape: both counts are
dominated by fetching rather than by adding, and in both the store costs
noticeably more than the arithmetic, for the same reason — it has an address to
assemble.

## So was it a lie?

No, and the test is concrete: everything the generic machine taught you
transfers, and the things that break are the things it declared invented.

Take the byte stream apart on either machine and you find an opcode, a fetch
that must precede its own decoding, an operand fetched afterwards, an
accumulator, a latch holding the address, and a control unit spending most of
its time not computing. Change machine and the numbers change: different
opcodes, a different byte order, more registers, a stack that actually works, an
interrupt line that does something. Not one of those changes the sentence the
processor is reading.

That is the honest claim, and it is a narrow one. The generic machine is not a
simplified 8085 — a simplification would be an 8085 with parts removed, and it
would mislead you about the parts that are left. It is a different machine of
the same kind, small enough that the kind is visible.
