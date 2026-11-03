/**
 * Service 2: the connection graph. Typed edges between component ports; a process moves a quantity along an edge only
 * if the edge's kind permits it. An edge carries the physics of the connection (a pipe's resistance, a wall's U A).
 */
import type { PortKind } from "./registry.ts";
export interface Edge {
    id: string;
    kind: PortKind;
    from: string;
    fromPort: string;
    to: string;
    toPort: string;
    props: Record<string, number>;
}
export declare class Graph {
    edges: Edge[];
    connect(e: Edge): Edge;
    from(component: string, kind?: PortKind): Edge[];
    to(component: string, kind?: PortKind): Edge[];
    between(a: string, b: string, kind?: PortKind): Edge[];
}
