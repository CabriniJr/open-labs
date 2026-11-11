import ddl from "../../../../../../database/01-ddl.sql?raw";
import dml from "../../../../../../database/02-dml.sql?raw";
import dql from "../../../../../../database/03-dql.sql?raw";
import modeler from "../../../../../../database/entrega/ddl-para-o-data-modeler.sql?raw";
import type { APIRoute } from "astro";

/**
 * Os scripts da entrega, para baixar do passo a passo no Oracle. São os
 * arquivos do repositório (gerados de packages/database-domain), sem segunda
 * cópia no public/.
 */
export function getStaticPaths() {
  return Object.entries({ "01-ddl.sql": ddl, "02-dml.sql": dml, "03-dql.sql": dql, "ddl-para-o-data-modeler.sql": modeler }).map(([file, content]) => ({ params: { file }, props: { content } }));
}

export const GET: APIRoute = ({ props }) => new Response(props.content, { headers: { "Content-Type": "application/sql; charset=utf-8" } });
