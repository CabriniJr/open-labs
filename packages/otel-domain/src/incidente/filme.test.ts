import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDoIncidente, raias } from "./filme.js";
import { investigar, trafego } from "./modelo.js";

const fim = (f: ReturnType<typeof filmeDoIncidente>, cap: string) => frameAt(f, f.chapters.find((c) => c.id === cap)!.end);
const estado = (q: ReturnType<typeof fim>, id: string) => q.entities.find((e) => e.spec.id === id)!.state;

describe("the incident film is read from the model", () => {
  it("lanes never put two overlapping requests on the same row", () => {
    const reqs = trafego(20);
    const raia = raias(reqs);
    for (const a of reqs) for (const b of reqs) if (a.n < b.n && raia.get(a.n) === raia.get(b.n)) expect(a.fim <= b.inicio || b.fim <= a.inicio).toBe(true);
  });

  it("the MTTR clock ends on the model's minutes", () => {
    for (const contexto of [false, true]) {
      const f = filmeDoIncidente({ rps: 20, contexto });
      const m = investigar({ rps: 20, contexto }).busca.minutos;
      expect(estado(fim(f, "search"), "relogio").label).toBe(`MTTR ${m.toFixed(m % 1 === 0 ? 0 : 1)} min`);
    }
  });

  it("without context every candidate lights up; with it, only the failure", () => {
    const sem = fim(filmeDoIncidente({ rps: 20, contexto: false }), "search");
    const com = fim(filmeDoIncidente({ rps: 20, contexto: true }), "search");
    const acesos = (q: typeof sem) => q.entities.filter((e) => e.spec.id.startsWith("r:") && e.state.glow > 0.5).length;
    expect(acesos(sem)).toBe(investigar({ rps: 20, contexto: false }).busca.candidatos.length);
    expect(acesos(com)).toBe(1);
  });
});
