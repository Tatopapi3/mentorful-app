"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuroraPublic } from "@/components/aurora/public-frame";

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
  /** Presentation only: whether the intro screen has been dismissed. Persisted
   *  so leaving and coming back mid-scan doesn't replay the intro. */
  started?: boolean;
};

/**
 * The six labels break onto two lines in the prototype ("Strongly" / "disagree")
 * so the boxes stay a uniform height. Every label is one or two words, so
 * splitting on the space reproduces it exactly — and the accessible name is
 * still the full "Strongly disagree", since a <br> is whitespace to a screen
 * reader.
 */
function twoLine(label: string) {
  return label.split(" ").map((word, i) => (
    <Fragment key={word}>
      {i > 0 && <br />}
      {word}
    </Fragment>
  ));
}

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
  const [started, setStarted] = useState(false);

  // One-time codes (script 024). "checking" until we know whether this database has them; "legacy" before 024 is applied,
  // when the page still saves directly as it always did. The code is kept in memory only, never in the browser's storage.
  const [mode, setMode] = useState<"checking" | "codes" | "legacy">("checking");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    // An empty code is never valid, so this only asks "does survey_code_ok exist?".
    createClient()
      .rpc("survey_code_ok", { p_code: "" })
      .then(({ error }) => {
        const missing = !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|schema cache/i.test(error.message ?? ""));
        setMode(missing ? "legacy" : "codes");
      });
  }, []);

  async function begin() {
    if (mode !== "codes") {
      setStarted(true);
      return;
    }
    setCheckingCode(true);
    setCodeError(null);
    const { data, error } = await createClient().rpc("survey_code_ok", { p_code: code });
    setCheckingCode(false);
    if (error) {
      setCodeError("We couldn’t check the code just now. Check your connection and try again.");
      return;
    }
    if (data !== true) {
      setCodeError("That code isn’t valid, or it has already been used. Ask the person who gave it to you.");
      return;
    }
    setStarted(true);
  }

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
        setStarted(p.started ?? false);
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
    const p: Progress = { respondent, currentSection, answers, started };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  }, [hydrated, respondent, currentSection, answers, started]);

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
      <AuroraPublic>
        <div className="ap-card ap-survey">
          <p className="ap-error">Could not load survey: {loadError}</p>
          <p style={{ marginTop: 8 }}>
            Please refresh the page. If it keeps happening, contact the person who shared this link.
          </p>
        </div>
      </AuroraPublic>
    );
  }

  // Still fetching (items null) or hydrating localStorage — a genuine loading state.
  if (items === null || !hydrated || mode === "checking") {
    return (
      <AuroraPublic>
        <div className="ap-card ap-survey">
          <p>Loading…</p>
        </div>
      </AuroraPublic>
    );
  }

  // Fetch resolved but returned nothing usable (empty table, or an RLS denial
  // which returns [] with no error). Show a clear message — never keep spinning.
  if (items.length === 0 || sections.length === 0) {
    return (
      <AuroraPublic>
        <div className="ap-card ap-survey">
          <h1 style={{ fontSize: 26 }}>Survey unavailable</h1>
          <p style={{ marginTop: 8 }}>
            No survey questions were returned, so the scan can’t be shown right now. The survey may
            not be published yet, or the questions couldn’t be read.
          </p>
          <p style={{ marginTop: 8 }}>
            Please refresh, and if it keeps happening, contact the person who shared this link.
          </p>
        </div>
      </AuroraPublic>
    );
  }

  const totalSections = sections.length;

  // With codes, the page opens on the code step every time the code is not in memory (a first visit, or a reload mid-way:
  // the answers are kept on the device, the code is not, so the person types it again and carries on).
  if (!started || (mode === "codes" && code === "")) {
    return (
      <AuroraPublic right={<span className="ap-prog"><span className="lbl">School Culture Scan</span></span>}>
        <div className="ap-card ap-survey">
          <h1>Before you start</h1>
          <p>
            Twenty-six questions, about six minutes. There are no right answers, and none of this is
            about your teaching.
          </p>
          <p>
            We’re asking about the school around you: who you can go to when something goes wrong,
            whether it’s safe to say a lesson didn’t work, and whether the adults here are pulling in
            the same direction.
          </p>
          <div className="ap-privacy">
            <b>Your answers are anonymous, structurally.</b>
            <p>
              Not “we promise not to look.” When you submit, your responses are stored against a
              random code that is never connected to your login. There is no way to trace an answer
              back to you, including for us. Your principal sees the whole faculty’s pattern and
              nothing else.
            </p>
          </div>
          <p>
            Answer for the school as it is right now, not as you hope it will be. The scan runs again
            later in the year, and the comparison is the part that matters.
          </p>
          {mode === "codes" && (
            <div className="ev-field" style={{ marginTop: 18 }}>
              <label className="ap-label" htmlFor="survey-code">Your one-time code</label>
              <input
                id="survey-code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError(null);
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em" }}
              />
              <p className="ap-fine" style={{ marginTop: 6 }}>
                Your school gave you a code that works once. It lets you in without a login, so nothing ties your answers to you.
              </p>
              {codeError && <p className="ap-error">{codeError}</p>}
            </div>
          )}
          <button
            type="button"
            className="ev-btn primary"
            style={{ marginTop: 16 }}
            disabled={checkingCode || (mode === "codes" && code.replace(/[^0-9a-z]/gi, "").length < 16)}
            onClick={begin}
          >
            {checkingCode ? "Checking…" : "Start"}
          </button>
          <p className="ap-fine">
            You can leave and come back. Your answers stay on this device until you submit.
          </p>
        </div>
      </AuroraPublic>
    );
  }

  const currentDimension = sections[currentSection];
  const currentItems = items.filter((i) => i.dimension === currentDimension);
  const allAnsweredOnScreen = currentItems.every((i) => answers[i.id] != null);
  const isLast = currentSection === totalSections - 1;

  const remaining = currentItems.filter((i) => answers[i.id] == null).length;
  const remainingLabel =
    remaining === 0
      ? "All answered"
      : `${remaining} question${remaining > 1 ? "s" : ""} left in this section`;

  async function handleSubmit() {
    if (!items) return;
    setSubmitting(true);
    setSubmitError(null);

    if (mode === "codes") {
      // The database checks the code, stores the answers against a fresh random id, and marks the code used, in one step.
      const given: Record<string, number> = {};
      for (const item of items) given[item.id] = answers[item.id];
      const { error } = await createClient().rpc("submit_survey", { p_code: code, p_answers: given });
      if (error) {
        setSubmitError(error.message);
        setSubmitting(false);
        return;
      }
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.setItem(COMPLETED_KEY, new Date().toISOString());
      router.push("/survey/complete");
      return;
    }

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
    router.push("/survey/complete");
  }

  return (
    <AuroraPublic
        right={
          <div className="ap-prog">
            {/* The dimension name is deliberately never shown while answering —
                seeing the name of a thing changes how people rate it. Only the
                section number appears here. */}
            <div className="lbl">
              Section {currentSection + 1} of {totalSections}
            </div>
            <div className="bar">
              <i style={{ width: `${((currentSection + 1) / totalSections) * 100}%` }} />
            </div>
          </div>
        }
      >
      <main className="ap-survey">
        {currentItems.map((item) => (
          <fieldset key={item.id} className="ap-item">
            <legend>{item.text}</legend>
            <div className="ap-scale">
              {SCALE.map((s) => {
                const id = `${item.id}-${s.value}`;
                return (
                  <div key={s.value} className="ap-opt">
                    <input
                      type="radio"
                      id={id}
                      name={item.id}
                      value={s.value}
                      checked={answers[item.id] === s.value}
                      onChange={() => setAnswers((prev) => ({ ...prev, [item.id]: s.value }))}
                    />
                    <label htmlFor={id}>{twoLine(s.label)}</label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="ap-nav">
          <span className="left" aria-live="polite">
            {remainingLabel}
          </span>
          <div className="actions">
            <button
              type="button"
              className="ev-btn"
              onClick={() =>
                currentSection === 0 ? setStarted(false) : setCurrentSection((s) => s - 1)
              }
            >
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                className="ev-btn primary"
                disabled={!allAnsweredOnScreen || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            ) : (
              <button
                type="button"
                className="ev-btn primary"
                disabled={!allAnsweredOnScreen}
                onClick={() => setCurrentSection((s) => s + 1)}
              >
                Next section
              </button>
            )}
          </div>
        </div>

        {submitError && <p className="ap-surveyerr">{submitError}</p>}
      </main>
    </AuroraPublic>
  );
}
