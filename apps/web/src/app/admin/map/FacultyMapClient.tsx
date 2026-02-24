"use client";

import "reactflow/dist/style.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  OnNodesChange,
  applyNodeChanges,
} from "reactflow";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";

type UserNode = {
  id: string;
  name: string;
  department: string | null;
  strengthTags?: any;
  personalityTags?: any;
  funTags?: any;
};

type LayoutMode = "grid" | "pairings" | "department" | "strength" | "personality";

function firstTag(v: any): string {
  if (!v) return "None";
  if (Array.isArray(v)) return (v[0] ?? "None").toString();
  return v.toString();
}

function hashTo01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export default function FacultyMapClient(props: {
  users: UserNode[];
  edges: { id: string; source: string; target: string; label?: string }[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");

  // Keep nodes in state so we can animate positions between layouts.
  const [nodes, setNodes] = useState<Node[]>(() => {
    const cols = 10;
    const cellX = 150;
    const cellY = 95;

    return props.users.map((u, i) => {
      const j = hashTo01(u.id);
      const jitterX = (j * 2 - 1) * 10;
      const jitterY = ((1 - j) * 2 - 1) * 10;

      const x = (i % cols) * cellX + jitterX;
      const y = Math.floor(i / cols) * cellY + jitterY;

      return {
        id: u.id,
        position: { x, y },
        data: { label: u.name },
        style: {
          padding: 6,
          borderRadius: 10,
          border: "1px solid #ddd",
          fontSize: 12,
          cursor: "pointer",
          width: 130,
          textAlign: "center",
          background: "white",
        },
      };
    });
  });

  // preserve manual drag positions as new "starting positions"
  const draggedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    // if users list changes (shouldn't often), rebuild nodes but keep dragged positions if any
    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      return props.users.map((u) => {
        const existing = prevMap.get(u.id);
        const dragged = draggedPositionsRef.current.get(u.id);
        return {
          id: u.id,
          position: dragged ?? existing?.position ?? { x: 0, y: 0 },
          data: { label: u.name },
          style: existing?.style ?? {
            padding: 6,
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 12,
            cursor: "pointer",
            width: 130,
            textAlign: "center",
            background: "white",
          },
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.users.length]);

  const edgesRF: Edge[] = useMemo(
    () =>
      props.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: false,
      })),
    [props.edges]
  );

  const selected = props.users.find((u) => u.id === selectedId) ?? null;

  const partnerIds = useMemo(() => {
    if (!selectedId) return [];
    const partners: string[] = [];
    for (const e of props.edges) {
      if (e.source === selectedId) partners.push(e.target);
      if (e.target === selectedId) partners.push(e.source);
    }
    return partners;
  }, [props.edges, selectedId]);

  const partnerNames = partnerIds
    .map((id) => props.users.find((u) => u.id === id)?.name)
    .filter(Boolean) as string[];

  function computeClusterCenters(keys: string[], width = 1100, height = 750) {
    const cols = Math.max(2, Math.ceil(Math.sqrt(keys.length)));
    const rows = Math.ceil(keys.length / cols);
    const pad = 120;
    const usableW = Math.max(200, width - pad * 2);
    const usableH = Math.max(200, height - pad * 2);
    const cellW = usableW / cols;
    const cellH = usableH / rows;

    const centers = new Map<string, { x: number; y: number }>();
    keys.forEach((k, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      centers.set(k, {
        x: pad + c * cellW + cellW / 2,
        y: pad + r * cellH + cellH / 2,
      });
    });
    return centers;
  }

  function runLayout(mode: LayoutMode) {
    // Use current positions as starting positions
    const start = nodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));

    const nodeById = new Map(start.map((s) => [s.id, s]));
    const links = props.edges
      .map((e) => ({
        source: nodeById.get(e.source),
        target: nodeById.get(e.target),
      }))
      .filter((l) => l.source && l.target) as any[];

    // cluster keys + centers
    let centers = new Map<string, { x: number; y: number }>();
    let keyForId: (id: string) => string = () => "All";

    if (mode === "department") {
      const keys = Array.from(
        new Set(props.users.map((u) => (u.department ?? "None").toString()))
      ).sort();
      centers = computeClusterCenters(keys);
      const map = new Map(props.users.map((u) => [u.id, (u.department ?? "None").toString()]));
      keyForId = (id) => map.get(id) ?? "None";
    } else if (mode === "strength") {
      const keys = Array.from(new Set(props.users.map((u) => firstTag(u.strengthTags)))).sort();
      centers = computeClusterCenters(keys);
      const map = new Map(props.users.map((u) => [u.id, firstTag(u.strengthTags)]));
      keyForId = (id) => map.get(id) ?? "None";
    } else if (mode === "personality") {
      const keys = Array.from(new Set(props.users.map((u) => firstTag(u.personalityTags)))).sort();
      centers = computeClusterCenters(keys);
      const map = new Map(props.users.map((u) => [u.id, firstTag(u.personalityTags)]));
      keyForId = (id) => map.get(id) ?? "None";
    }

    // Simulation
    const sim = forceSimulation(start as any)
      .alpha(1)
      .alphaDecay(0.08)
      .force("charge", forceManyBody().strength(-260))
      .force("collide", forceCollide(48))
      .force("center", forceCenter(550, 360));

    // Pairing cohesion (always helps, but strongest in pairings mode)
    sim.force(
      "link",
      forceLink(links)
        .id((d: any) => d.id)
        .distance(mode === "pairings" ? 90 : 130)
        .strength(mode === "pairings" ? 0.9 : 0.25)
    );

    // Cluster attraction for certain modes
    if (mode === "department" || mode === "strength" || mode === "personality") {
      sim.force(
        "x",
        forceX((d: any) => centers.get(keyForId(d.id))?.x ?? 550).strength(0.25)
      );
      sim.force(
        "y",
        forceY((d: any) => centers.get(keyForId(d.id))?.y ?? 360).strength(0.25)
      );
    }

    // Grid mode: gently push toward original grid-like anchors
    if (mode === "grid") {
      const cols = 10;
      const cellX = 150;
      const cellY = 95;
      const anchors = new Map<string, { x: number; y: number }>();
      props.users.forEach((u, i) => {
        const x = (i % cols) * cellX + 30;
        const y = Math.floor(i / cols) * cellY + 30;
        anchors.set(u.id, { x, y });
      });

      sim.force("x", forceX((d: any) => anchors.get(d.id)?.x ?? 0).strength(0.22));
      sim.force("y", forceY((d: any) => anchors.get(d.id)?.y ?? 0).strength(0.22));
    }

    // Run fixed ticks (no continuous sim)
    for (let i = 0; i < 220; i++) sim.tick();
    sim.stop();

    const end = new Map(start.map((s: any) => [s.id, { x: s.x, y: s.y }]));

    // Tween positions over ~450ms so you can see movement
    const frames = 16;
    const startPositions = new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));
    let f = 0;

    const step = () => {
      f++;
      const t = f / frames;
      setNodes((prev) =>
        prev.map((n) => {
          const a = startPositions.get(n.id) ?? n.position;
          const b = end.get(n.id) ?? n.position;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          return { ...n, position: { x, y } };
        })
      );
      if (f < frames) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  useEffect(() => {
    runLayout(layoutMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode]);

  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      // record drags
      for (const c of changes) {
        if (c.type === "position" && c.id && (c as any).position) {
          draggedPositionsRef.current.set(c.id, (c as any).position);
        }
      }
      return next;
    });
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 72px)" }}>
      <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 10,
            borderBottom: "1px solid #eee",
            alignItems: "center",
            background: "white",
          }}
        >
          <div style={{ fontWeight: 700, marginRight: 8 }}>Layout</div>
          {(["grid", "pairings", "department", "strength", "personality"] as LayoutMode[]).map(
            (m) => (
              <button
                key={m}
                onClick={() => setLayoutMode(m)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: layoutMode === m ? "#111" : "white",
                  color: layoutMode === m ? "white" : "#111",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {m === "grid"
                  ? "Grid"
                  : m === "pairings"
                    ? "Pairings"
                    : m === "department"
                      ? "Department"
                      : m === "strength"
                        ? "Strength"
                        : "Personality"}
              </button>
            )
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edgesRF}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          fitView
          fitViewOptions={{ padding: 0.22 }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <aside style={{ width: 340, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Teacher</div>
        {!selected ? (
          <div style={{ color: "#666" }}>Click a node to see details.</div>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div>
            <div style={{ color: "#666", marginBottom: 10 }}>{selected.department ?? "—"}</div>

            <div style={{ fontWeight: 600, marginTop: 10 }}>Partners (this cycle)</div>
            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
              {partnerNames.length ? partnerNames.map((n) => <li key={n}>{n}</li>) : <li>None</li>}
            </ul>

            <div style={{ fontWeight: 600, marginTop: 10 }}>Tags</div>
            <pre
              style={{
                fontSize: 11,
                background: "#fafafa",
                padding: 8,
                borderRadius: 8,
                overflowX: "auto",
              }}
            >
{JSON.stringify(
  {
    strengthTags: selected.strengthTags,
    personalityTags: selected.personalityTags,
    funTags: selected.funTags,
  },
  null,
  2
)}
            </pre>
          </>
        )}
      </aside>
    </div>
  );
}
