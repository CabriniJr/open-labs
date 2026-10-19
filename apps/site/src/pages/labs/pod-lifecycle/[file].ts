import guide from "../../../../../../labs/pod-lifecycle/README.md?raw";
import deployment from "../../../../../../labs/pod-lifecycle/deployment.yaml?raw";
import pod from "../../../../../../labs/pod-lifecycle/pod.yaml?raw";
import type { APIRoute } from "astro";

/** A contraparte baixada é o arquivo do repo, sem segunda cópia no public/. */
export function getStaticPaths() {
  return Object.entries({ "README.md": guide, "deployment.yaml": deployment, "pod.yaml": pod })
    .map(([file, content]) => ({ params: { file }, props: { content } }));
}

export const GET: APIRoute = ({ params, props }) => new Response(props.content, {
  headers: { "Content-Type": params.file?.endsWith("yaml") ? "text/yaml; charset=utf-8" : "text/plain; charset=utf-8" },
});
