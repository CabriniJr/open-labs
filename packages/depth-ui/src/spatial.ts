/** Camera math shared by every spatial view. Coordinates stay in model units. */
export interface Point3 { readonly x: number; readonly y: number; readonly z?: number }
export interface SpatialCamera { readonly yaw: number; readonly tilt: number; readonly zoom: number; readonly panX: number; readonly panY: number }
export type SpatialMode = "2d" | "isometric" | "3d";
export interface SpatialNode {
  readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly label: string; readonly sublabel?: string | undefined; readonly tone?: string | undefined;
  readonly elevation?: number | undefined; readonly opacity?: number | undefined; readonly active?: boolean | undefined;
  readonly frame?: boolean | undefined;
}
export interface SpatialPath {
  readonly id: string; readonly points: readonly Point3[]; readonly tone?: string | undefined;
  readonly opacity?: number | undefined; readonly dashed?: boolean | undefined; readonly label?: string | undefined;
  readonly arrow?: boolean | undefined;
}
export interface SpatialMarker extends Point3 { readonly id: string; readonly label?: string | undefined; readonly tone?: string | undefined; readonly opacity?: number | undefined; readonly next?: Point3 | undefined; readonly duration?: number | undefined }
export interface SpatialScene { readonly width: number; readonly height: number; readonly nodes: readonly SpatialNode[]; readonly paths: readonly SpatialPath[]; readonly markers?: readonly SpatialMarker[] | undefined; readonly startedAt?: number | undefined }

export const DEFAULT_CAMERA: SpatialCamera = { yaw: -Math.PI / 4, tilt: Math.atan(Math.sqrt(2)), zoom: 1, panX: 0, panY: 0 };
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function projector(width: number, height: number, camera: SpatialCamera, perspective: boolean) {
  const span = Math.max(1, width, height);
  const raw = ({ x, y, z = 0 }: Point3) => {
    const a = (x - width / 2) / span, b = (y - height / 2) / span, c = z / span;
    const rx = a * Math.cos(camera.yaw) - b * Math.sin(camera.yaw);
    const ry = a * Math.sin(camera.yaw) + b * Math.cos(camera.yaw);
    const sy = ry * Math.cos(camera.tilt) - c * Math.sin(camera.tilt);
    const depth = ry * Math.sin(camera.tilt) - c * Math.cos(camera.tilt);
    const k = perspective ? 2.5 / Math.max(0.5, 2.5 + depth) : 1;
    return { x: rx * k, y: sy * k, depth };
  };
  const corners = [raw({ x: 0, y: 0 }), raw({ x: width, y: 0 }), raw({ x: width, y: height }), raw({ x: 0, y: height }), raw({ x: 0, y: 0, z: span * 0.1 })];
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const fit = Math.min(850 / Math.max(.1, maxX - minX), 430 / Math.max(.1, maxY - minY));
  return (p: Point3) => {
    const q = raw(p);
    return { x: 500 + (q.x - (minX + maxX) / 2) * fit * camera.zoom + camera.panX, y: 290 + (q.y - (minY + maxY) / 2) * fit * camera.zoom + camera.panY, depth: q.depth };
  };
}
