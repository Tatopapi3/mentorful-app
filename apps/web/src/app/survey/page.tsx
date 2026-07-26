"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PROGRESS_KEY = "mentorful:culture-scan-v2:progress";
const COMPLETED_KEY = "mentorful:culture-scan-v2:completed";

const SCALE = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Slightly disagree" },
  { value: 4, label: "Slightly agree" },
  { value: 5, label: "Agree" },
  { value: 6, label: "Strongly agree" },
] as const;

type Item = {
  id: string;
  position: number;
  dimension: string;
  reverse: boolean;
  text: string;
};

type Progress = {
  respondent: string;
  currentSection: number;
  answers: Record<string, number>;
};

export default function SurveyPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const [respondent, setRespondent] = useState<string>("");
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    // Never spin forever: if the read hasn't resolved in time, surface an error
    // rather than an infinite "Loading…".
    const timeout = setTimeout(() => {
      if (!settled) {
        setLoadError(
          "The survey is taking too long to load. Check your connection and refresh the page."
        );
      }
    }, 15000);

    supabase
      .from("survey_items")
      .select("id, position, dimension, reverse, text")
      .eq("active", true)
      .order("position")
      .then(({ data, error }) => {
        settled = true;
        clearTimeout(timeout);
        if (error) {
          setLoadError(error.message);
          return;
        }
        // An RLS denial returns an empty array with no error, so [] is a real
        // outcome the render must handle — not a perpetual loading state.
        setItems((data ?? []) as Item[]);
      });

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as Progress;
        setRespondent(p.respondent);
        setCurrentSection(p.currentSection ?? 0);
        setAnswers(p.answers ?? {});
      } catch {
        const r = crypto.randomUUID();
        setRespondent(r);
      }
    } else {
      const r = crypto.randomUUID();
      setRespondent(r);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !respondent) return;
    const p: Progress = { respondent, currentSection, answers };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  }, [hydrated, respondent, currentSection, answers]);

  const sections = useMemo(() => {
    if (!items) return [] as string[];
    const seen: string[] = [];
    for (const item of items) {
      if (!seen.includes(item.dimension)) seen.push(item.dimension);
    }
    return seen;
  }, [items]);

  if (loadError) {
    return (
      <main style={{ maxWidth: 600, margin: "80px auto", padding: 24 }}>
        <p style={{ color: "red" }}>Could not load survey: {loadError}</p>
        <p style={{ marginTop: 8 }}>
          Please refresh the page. If it keeps happening, contact the person who shared this link.
        </p>
      </main>
    );
  }

  // Still fetching (items null) or hydrating localStorage — a genuine loading state.
  if (items === null || !hydrated) {
    return (
      <main style={{ maxWidth: 600, margin: "80px auto", padding: 24 }}>
        <p>Loading…</p>
      </main>
    );
  }

  // Fetch resolved but returned nothing usable (empty table, or an RLS denial
  // which returns [] with no error). Show a clear message — never keep spinning.
  if (items.length === 0 || sections.length === 0) {
    return (
      <main style={{ maxWidth: 600, margin: "80px auto", padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>Survey unavailable</h1>
        <p style={{ marginTop: 8 }}>
          No survey questions were returned, so the scan can’t be shown right now. The survey may not
          be published yet, or the questions couldn’t be read.
        </p>
        <p style={{ marginTop: 8 }}>
          Please refresh, and if it keeps happening, contact the person who shared this link.
        </p>
      </main>
    );
  }

  const totalSections = sections.length;
  const currentDimension = sections[currentSection];
  const currentItems = items.filter((i) => i.dimension === currentDimension);
  const allAnsweredOnScreen = currentItems.every((i) => answers[i.id] != null);
  const isLast = currentSection === totalSections - 1;

  async function handleSubmit() {
    if (!items) return;
    setSubmitting(true);
    setSubmitError(null);

    const surveyId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID;
    const schoolId = process.env.NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID;
    if (!surveyId || !schoolId) {
      setSubmitError(
        "Missing NEXT_PUBLIC_CULTURE_SCAN_SURVEY_ID or NEXT_PUBLIC_CULTURE_SCAN_SCHOOL_ID in .env.local."
      );
      setSubmitting(false);
      return;
    }

    const rows = items.map((item) => {
      const raw = answers[item.id];
      const scored = item.reverse ? 7 - raw : raw;
      return {
        survey_id: surveyId,
        school_id: schoolId,
        respondent,
        item_id: item.id,
        raw_value: raw,
        scored_value: scored,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from("survey_responses").insert(rows);
    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    localStorage.removeItem(PROGRESS_KEY);
    localStorage.setItem(COMPLETED_KEY, new Date().toISOString());
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <p style={{ marginTop: 0 }}>
        Section {currentSection + 1} of {totalSections}
      </p>

      <ol style={{ display: "flex", flexDirection: "column", gap: 24, paddingLeft: 20 }}>
        {currentItems.map((item) => (
          <li key={item.id}>
            <p style={{ margin: "0 0 8px" }}>{item.text}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SCALE.map((s) => (
                <label key={s.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    name={item.id}
                    value={s.value}
                    checked={answers[item.id] === s.value}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [item.id]: s.value }))
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 32,
        }}
      >
        <button
          type="button"
          disabled={currentSection === 0}
          onClick={() => setCurrentSection((s) => s - 1)}
          style={{ padding: 8, borderRadius: 4 }}
        >
          Back
        </button>
        {isLast ? (
          <button
            type="button"
            disabled={!allAnsweredOnScreen || submitting}
            onClick={handleSubmit}
            style={{ padding: 8, borderRadius: 4 }}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!allAnsweredOnScreen}
            onClick={() => setCurrentSection((s) => s + 1)}
            style={{ padding: 8, borderRadius: 4 }}
          >
            Next
          </button>
        )}
      </div>

      {submitError && (
        <p style={{ color: "red", marginTop: 16 }}>{submitError}</p>
      )}
    </main>
  );
}
