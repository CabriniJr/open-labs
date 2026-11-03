import { CpuLab } from "./CpuLab";
import { CpuVitrine } from "./CpuVitrine";
import { ModosDoLab } from "./ModosDoLab";

export function CpuModos() {
  return <ModosDoLab showcase={() => <CpuVitrine />} simulation={() => <CpuLab />} />;
}
