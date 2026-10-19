---
title: "A stack is a box"
dek: "A stack is not a shape in memory — it is a box with one rule about which item leaves next. The rule is the whole data structure, and almost everything surprising about stacks follows from the fact that the rule is a convention somebody has to keep rather than a thing the hardware enforces."
handbook: algorithms
phase: 1
sources:
  - id: knuth-taocp-1
    author: "Donald E. Knuth"
    year: "1997"
    title: "The Art of Computer Programming, Volume 1: Fundamental Algorithms"
    where: "Addison-Wesley, 3rd edition, section 2.2.1"
    note: "The definition that this article is a long footnote to: a stack, a queue and a deque are the same linear list with different rules about where insertion and deletion may happen. Read the section's first two pages and notice that nothing in them is about memory."
  - id: dijkstra-1960
    author: "Edsger W. Dijkstra"
    year: "1960"
    title: "Recursive Programming"
    where: "Numerische Mathematik, volume 2, pages 312–318"
    note: "Where the stack stops being a data structure and becomes the mechanism that makes a language feature possible. Read it for the argument that recursion needs a stack of activation records, written when that was news."
  - id: riscv-psabi
    author: "Kito Cheng and Jessica Clarke (editors)"
    year: "2022"
    title: "RISC-V ABIs Specification, Document Version 1.0"
    where: "RISC-V International"
    url: "https://github.com/riscv-non-isa/riscv-elf-psabi-doc"
    note: "Look for the register table and the paragraph on the stack. The interesting part is which document this is: the stack pointer and the direction the stack grows are defined in the calling convention, not in the instruction set."
  - id: randell-russell-1964
    author: "Brian Randell and Lawford J. Russell"
    year: "1964"
    title: "ALGOL 60 Implementation"
    where: "Academic Press, London"
    note: "The classic account of how a block-structured language is actually run, stack discipline and all. It is worth seeing how much machinery the word 'stack' is standing in for once a real compiler has to use one."
---

A stack is usually introduced as a picture: a tower of plates, items piled on
items, the last one on top. The picture is memorable and it smuggles in
something false — it suggests that a stack is an arrangement in space.

It is not. A stack is a **box with a rule**: of everything inside, the item that
leaves next is the one that arrived last. Nothing else is specified. The items
do not have to be adjacent, the box does not have to grow in any particular
direction, and there is no "top" anywhere except in the rule.

Knuth defines it exactly this way ([source](#src-knuth-taocp-1)): a stack, a
queue and a deque are one linear list with different restrictions on where
insertion and deletion are allowed. The data structures differ by **policy**,
not by material. That is why the lab for this phase draws a stack as a box with
a door and not as a tower: the door is the whole content of the definition.

## The rule is what you buy, and what you pay

Because the rule is so small, it is cheap: both operations touch one end, so
both are constant time, and nothing has to be searched or shifted.

What you pay is the other side of the same sentence. A stack cannot answer "what
is the oldest item in here" without destroying everything in front of it. Not
slowly — *at all*, within its own interface. Whenever somebody asks a stack that
question, the answer involves emptying it into something else, and the cost of
that is exactly the price of having chosen the policy.

So the honest way to choose a stack is not "I need a stack". It is: **the only
question I will ask is about the most recent thing**. If that is true, nothing
beats it. If it is not, you are about to write code that works around your own
container.

> [!deeper] Why "last in, first out" is a statement about questions, not about items
>
> It is tempting to read LIFO as an ordering fact — the items come out backwards.
> It is more useful to read it as a restriction on the questions you are allowed
> to ask, because that is what makes the implementation small. A box that can
> only answer about the newest item needs to remember exactly one position; a box
> that can also answer about the oldest needs two; a box that can answer about
> the middle needs an index, and an index is a second data structure with its own
> cost. Every structure in this phase is the same trade read in a different
> direction: what you decide not to be able to ask is what you stop paying for.

## The stack that runs your program

The reason this one structure shows up in every curriculum is not that it is
useful for parsing. It is that a stack is what makes **recursion** possible, and
that was once a discovery rather than an assumption.

Dijkstra's 1960 paper is where it is argued in print ([source](#src-dijkstra-1960)):
a procedure that calls itself needs one set of local variables per invocation,
those sets come into existence and vanish in exactly last-in-first-out order, and
therefore the machinery that holds them is a stack. The language feature and the
data structure are the same fact seen from two sides. Randell and Russell's
account of implementing ALGOL 60 ([source](#src-randell-russell-1964)) is the
engineering version of that argument: once a real compiler has to do it, "the
stack" turns out to be standing in for a pile of conventions about frames,
display registers and who restores what.

This is the part of the story that connects to the CPU handbook, and it is the
part most people have backwards.

## The hardware does not have a stack

Open the RISC-V ABI specification and look for where the stack is defined
([source](#src-riscv-psabi)). It is in the **calling convention** — a document
about agreements between pieces of software. Register `x2` is named `sp`, the
stack grows towards lower addresses, and the pointer must be 128-bit aligned on
entry to a procedure. All of that is a promise that compilers make to each other.

The instruction set itself does not know. There is no push and no pop; a push is
a subtraction from a register and a store, and a pop is a load and an addition.
The box is a convention imposed on ordinary memory by everyone agreeing to use
one register the same way.

Two consequences follow, and they are the reason this matters outside a
curriculum:

- **Nothing enforces the rule.** A stack overflow is not the box refusing an
  item. It is a store to an address that was never yours, and whether you find
  out depends on whether something else happens to be there — which is why the
  operating system puts an unmapped guard page below the stack, so that the
  violation becomes a fault instead of a silent corruption of whatever was next.
- **Different machines made different choices, and the choice is visible.** Some
  instruction sets do have push and pop; RISC-V deliberately does not, because an
  instruction that does two things is two instructions in a decoder's clothing.
  The structure is the same either way, which is the point: the box is the rule,
  and the rule survives being implemented in completely different ways.

> [!deeper] "Grows downwards" is a convention, and knowing that it is one is the useful part
>
> There is no physical reason for a stack to grow towards lower addresses. The
> habit comes from machines where the program was loaded at the bottom of memory
> and the stack was put at the top so the two could grow towards each other
> without a fixed boundary between them — a layout decision from an era of very
> small memories that is now written into ABIs ([source](#src-riscv-psabi)) and
> therefore into every debugger, stack trace and overflow guard you will ever
> read. It is worth filing as the clean example of a convention that behaves
> exactly like a law: you cannot violate it locally and be understood by anyone,
> even though nothing about the hardware requires it.

## What the lab shows that the definition cannot

The definition fits in one sentence, so the thing worth watching is not the
definition — it is a stack **in use**, with the items moving and the box filling.
That is what [the stack machine](../../../../labs/rpn/) in the next phase is: an
evaluator whose entire memory is one box with this rule, running an expression
one item at a time.

Watch what arrives at the box and what leaves, and the two claims in this
article stop being claims. The depth of the box at any moment is the structure of
what has not been resolved yet, and the moment it empties is the moment the
answer exists.

Where to go next: the queue is the same box with the other rule, and the
difference shows up the first time one of them is full. The full path is on the
[handbook page](../../).
