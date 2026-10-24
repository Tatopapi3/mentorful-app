"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { createLog, submitLog } from "../actions";
import { createDash, type Dash, type Datasets } from "./dash";
import { createLive } from "./live";

type Saved = { ok: true } | { ok: false; error: string };

/**
 * Mounts the "Mentorful Teacher Dashboard" artifact page inside the app.
 *
 * The page is plain HTML + scripts (public/dashboard-v2/dashboard.html). Its
 * markup and styles go into the container; each script runs in its own
 * function scope so a remount (React strict mode, fast refresh) can't collide
 * on top-level `const`s. Cross-script state lives on window, as the artifact
 * already arranges.
 *
 * Writes go through the same server actions as /dashboard, so 011's policies
 * still decide what a teacher can create or submit.
 */
export default function ArtifactDashboard({ data, me }: { data: Datasets; me: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dashRef = useRef<Dash | null>(null);
  const router = useRouter();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;

    const dash = createDash(data, { teacher: me });
    dashRef.current = dash;

    const persistLog = async (fields: Record<string, string>): Promise<Saved> => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await createLog(fd);
      if (res.ok) router.refresh();
      return res;
    };
    const submit = async (id: string): Promise<Saved> => {
      const fd = new FormData();
      fd.set("log_id", id);
      try {
        await submitLog(fd);
        router.refresh();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Couldn't submit." };
      }
    };
    // The visit screen: the pair channel, shared files and live drafts (see live.ts, 016).
    const live = createLive(() => router.refresh());
    live.watchLogs();
    Object.assign(window, { d3, dash, MF_persistLog: persistLog, MF_submitLog: submit, MF_live: live });

    fetch("/dashboard-v2/dashboard.html")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((html) => {
        if (cancelled) return;
        const tpl = document.createElement("template");
        tpl.innerHTML = html;
        const scripts = [...tpl.content.querySelectorAll("script")].map((s) => {
          s.remove();
          return s.textContent ?? "";
        });
        root.replaceChildren(tpl.content);
        for (const code of scripts) new Function(code)();
      })
      .catch((e) => {
        console.error("[dashboard v2] mount failed", e);
        if (!cancelled) root.textContent = "The dashboard couldn’t load. Try reloading the page.";
      });

    return () => {
      cancelled = true;
      dashRef.current = null;
      // Lets the visit screen stop the camera and leave its pair channel.
      window.dispatchEvent(new Event("mf-unmount"));
      void live.close();
      root.replaceChildren();
    };
    // Mount once; fresh server data flows in through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dashRef.current?.setSources(data);
  }, [data]);

  return <div id="dash-root" ref={ref} />;
}
