export class Graph {
    edges = [];
    connect(e) { this.edges.push(e); return e; }
    from(component, kind) { return this.edges.filter(e => e.from === component && (!kind || e.kind === kind)); }
    to(component, kind) { return this.edges.filter(e => e.to === component && (!kind || e.kind === kind)); }
    between(a, b, kind) { return this.edges.filter(e => ((e.from === a && e.to === b) || (e.from === b && e.to === a)) && (!kind || e.kind === kind)); }
}
