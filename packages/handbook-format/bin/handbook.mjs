#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  criarManifesto, criarPacote, IdSchema, labsExigidos, lerPacote, lerProjeto,
  relatoDeProblemas, VERSOES_SUPORTADAS,
} from "../dist/index.js";

const [command, ...args] = process.argv.slice(2);
const options = {
  new: { github: { type: "string" }, name: { type: "string" }, dir: { type: "string" } },
  check: { dir: { type: "string" }, json: { type: "boolean" } },
  export: { dir: { type: "string" }, out: { type: "string" } },
  inspect: { json: { type: "boolean" } },
  versions: {},
};

try {
  if (!(command in options)) throw new Error("uso: openlabs-handbook new <id> --github <handle> --name <nome> | check [--dir projeto] | export [--dir projeto] [--out pacote.json] | inspect <pacote.json> [--json] | versions");
  const { values, positionals } = parseArgs({ args, options: options[command], allowPositionals: true, strict: true });
  if (positionals.length !== (command === "new" || command === "inspect" ? 1 : 0)) throw new Error(`argumentos inválidos para ${command}`);
  const dir = resolve(values.dir ?? process.cwd());
  if (command === "new") {
    const id = IdSchema.parse(positionals[0]);
    if (!values.github || !values.name) throw new Error("new exige --github e --name de quem mantém o handbook");
    const manifesto = criarManifesto({ id, github: values.github, nome: values.name });
    const target = join(dir, id);
    if (existsSync(target)) throw new Error(`${target} já existe`);
    mkdirSync(join(target, "articles"), { recursive: true });
    writeFileSync(join(target, "handbook.yaml"), manifesto, { flag: "wx" });
    console.log(`✓ ${target}\ncd ${target}\nopenlabs-handbook check`);
  } else if (command === "versions") {
    for (const version of VERSOES_SUPORTADAS) console.log(`${version.apiVersion}: ${version.estado}${version.ler ? "" : " (legado TypeScript)"}`);
  } else if (command === "inspect") {
    const lido = lerPacote(JSON.parse(readFileSync(resolve(positionals[0]), "utf8")));
    if (!lido.ok) throw new Error(lido.errors.join("\n"));
    const p = lido.value;
    const summary = { id: p.handbook.id, bundleVersion: p.bundleVersion, apiVersion: p.handbook.apiVersion, articles: p.articles.length, requiredLabs: labsExigidos(p), ...(p.assessments ? { assessments: p.assessments.assessments.length, questions: p.assessments.questions.length } : {}) };
    if (values.json) console.log(JSON.stringify(summary, null, 2));
    else console.log(`✓ ${summary.id}: ${summary.articles} artigo(s), ${summary.apiVersion}\nLabs exigidos da instalação (código não incluído): ${summary.requiredLabs.map((l) => l.href).join(", ") || "nenhum"}`);
  } else {
    const project = lerProjeto(dir);
    if (command === "check") {
      const report = { ok: project.problemas.length === 0, id: project.handbook?.id ?? null, problems: project.problemas };
      console.log(values.json ? JSON.stringify(report, null, 2) : relatoDeProblemas(project.origem, project.problemas));
      if (!report.ok) process.exitCode = 1;
    } else {
      if (!project.handbook || project.problemas.length) throw new Error(relatoDeProblemas(project.origem, project.problemas));
      const bundle = criarPacote(project.handbook, project.articles, new Date().toISOString().slice(0, 10), project.assessments);
      const json = `${JSON.stringify(bundle, null, 2)}\n`;
      if (values.out) {
        writeFileSync(resolve(values.out), json);
        console.log(`✓ ${resolve(values.out)}`);
      } else process.stdout.write(json);
    }
  }
} catch (e) {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}
