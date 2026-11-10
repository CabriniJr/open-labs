import type { ResultadoNoPainel, Valor } from "@ovh/database-domain";

/** Um valor de célula como o SQL Developer mostra: NULL escrito, número sem casas à toa. */
export const celula = (v: Valor): string => (v === null ? "(null)" : String(v));

/** Um resultado de consulta em tabela, com as linhas destacadas acesas. */
export function TabelaDeResultado({ r, legenda }: { r: Pick<ResultadoNoPainel, "colunas" | "linhas"> & { destaque?: readonly number[]; total?: number }; legenda: string }) {
  const resto = (r.total ?? r.linhas.length) - r.linhas.length;
  return (
    <div className="bdlab-resultado">
      <table>
        <caption className="mono">{legenda}</caption>
        <thead translate="no">
          <tr>
            {r.colunas.map((c) => (
              <th key={c} scope="col" className="mono">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody translate="no">
          {r.linhas.length === 0 ? (
            <tr>
              <td colSpan={r.colunas.length}>no rows selected</td>
            </tr>
          ) : (
            r.linhas.map((l, i) => (
              <tr key={i} data-aceso={r.destaque?.includes(i) === true ? "" : undefined}>
                {l.map((v, j) => (
                  <td key={j} data-nulo={v === null ? "" : undefined}>
                    {celula(v)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {resto > 0 ? <p className="bdlab-mais">… and {resto} more rows</p> : null}
    </div>
  );
}
