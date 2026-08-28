export interface InspectorLine {
  readonly path: string;
  readonly text: string;
  readonly depth: number;
  readonly changed?: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Achata um objeto em linhas legíveis, cada uma carregando o caminho de onde
 * veio. É o caminho que permite marcar exatamente o campo que mudou.
 */
export function toInspectorLines(
  value: unknown,
  changedPaths: readonly string[] = [],
  path = "",
  depth = 0,
): InspectorLine[] {
  const changed = new Set(changedPaths);
  const mark = (line: InspectorLine): InspectorLine =>
    changed.has(line.path) ? { ...line, changed: true } : line;

  const label = path === "" ? "" : `"${path.split(".").at(-1)}": `;

  if (isRecord(value) || Array.isArray(value)) {
    const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value);

    const lines: InspectorLine[] = [mark({ path, text: `${label}${open}`, depth })];
    for (const [key, child] of entries) {
      lines.push(
        ...toInspectorLines(
          child,
          changedPaths,
          path === "" ? key : `${path}.${key}`,
          depth + 1,
        ),
      );
    }
    lines.push(mark({ path, text: close, depth }));
    return lines;
  }

  return [mark({ path, text: `${label}${JSON.stringify(value)}`, depth })];
}

export interface InspectorProps {
  readonly value: unknown;
  readonly changedPaths: readonly string[];
  readonly label?: string;
}

export function Inspector({ value, changedPaths, label }: InspectorProps) {
  const lines = toInspectorLines(value, changedPaths);
  return (
    <div className="dui-inspector">
      {label ? <p className="dui-inspector__label">{label}</p> : null}
      <pre className="dui-inspector__body">
        {lines.map((line, i) => (
          <span
            key={`${line.path}-${i}`}
            className="dui-inspector__line"
            data-changed={line.changed === true ? "true" : undefined}
            style={{ paddingInlineStart: `${line.depth * 1.25}ch` }}
          >
            {line.text}
            {"\n"}
          </span>
        ))}
      </pre>
    </div>
  );
}
