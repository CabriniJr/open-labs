import { CollectorLab } from "./CollectorLab";
import { CollectorVitrine } from "./CollectorVitrine";
import { ModosDoLab } from "./ModosDoLab";

export function CollectorModos() {
  return <ModosDoLab showcase={() => <CollectorVitrine />} simulation={() => <CollectorLab />} />;
}
