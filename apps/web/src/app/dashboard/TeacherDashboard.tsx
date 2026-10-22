"use client";

import { useMemo, useState, type ReactNode } from "react";
import "./teacher.css";

type Screen = "home" | "culture" | "conversation" | "partner";
type IconName =
  | "home"
  | "scan"
  | "message"
  | "users"
  | "bell"
  | "lock"
  | "arrow"
  | "clock"
  | "check"
  | "calendar"
  | "heart"
  | "shield"
  | "sliders"
  | "close";

const navItems: { id: Screen; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "culture", label: "Culture Scan", icon: "scan" },
  { id: "conversation", label: "Conversations", icon: "message" },
  { id: "partner", label: "My Partner", icon: "users" },
];

const topics = [
  "#classroommanagement",
  "#planning",
  "#communication",
  "#assessment",
  "#celebrations",
] as const;

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 10.8 9-7.3 9 7.3" />
        <path d="M5.5 9.8V21h13V9.8M9.5 21v-6.5h5V21" />
      </>
    ),
    scan: (
      <>
        <path d="M4 4v5M4 4h5M20 4h-5M20 4v5M4 20v-5M4 20h5M20 20h-5M20 20v-5" />
        <path d="M8.5 12h7M12 8.5v7" />
      </>
    ),
    message: (
      <>
        <path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

function PrivacyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`privacy-banner ${compact ? "privacy-banner--compact" : ""}`}>
      <span className="privacy-icon">
        <Icon name="lock" size={17} />
      </span>
      <p>
        <strong>Your conversations are private.</strong> Only topic tags are
        aggregated for school-wide PLC routing, never what you say.
      </p>
    </div>
  );
}

function ScreenHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="screen-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="screen-description">{description}</p>
    </header>
  );
}

function HomeScreen({ navigate }: { navigate: (screen: Screen) => void }) {
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <>
      <div className="home-heading">
        <div>
          <p className="eyebrow" suppressHydrationWarning>
            {today}
          </p>
          <h1>Good morning, Maya.</h1>
          <p>What would feel supportive today?</p>
        </div>
        <div className="week-chip">
          <span>Week 9</span>
          <strong>Fall term</strong>
        </div>
      </div>

      <PrivacyBanner />

      <section className="primary-action-card">
        <div className="primary-action-copy">
          <span className="action-kicker">
            <Icon name="message" size={18} />
            Your next step
          </span>
          <h2>Had a meaningful conversation?</h2>
          <p>
            Capture the topic while it’s fresh. No summary required, and it
            takes less than a minute.
          </p>
          <button
            className="button button--primary"
            onClick={() => navigate("conversation")}
          >
            Log a conversation
            <Icon name="arrow" size={18} />
          </button>
        </div>
        <div className="conversation-orbit" aria-hidden="true">
          <div className="orbit orbit--outer" />
          <div className="orbit orbit--inner" />
          <div className="avatar avatar--lg avatar--maya">M</div>
          <div className="avatar avatar--lg avatar--jordan">J</div>
          <span className="orbit-check">
            <Icon name="check" size={18} />
          </span>
        </div>
      </section>

      <div className="home-grid">
        <button className="culture-entry" onClick={() => navigate("culture")}>
          <div className="culture-entry__icon">
            <Icon name="scan" size={23} />
          </div>
          <div className="culture-entry__copy">
            <span className="card-label">YOUR VOICE MATTERS</span>
            <h3>Complete your Culture Scan</h3>
            <p>
              A short, anonymous check-in that helps your school strengthen
              support for everyone.
            </p>
            <div className="meta-row">
              <span>
                <Icon name="clock" size={16} /> Takes ~5 mins
              </span>
              <span>
                <Icon name="shield" size={16} /> 100% anonymous
              </span>
            </div>
          </div>
          <span className="circle-arrow">
            <Icon name="arrow" size={18} />
          </span>
        </button>

        <article className="partner-card">
          <div className="card-topline">
            <span className="card-label">YOUR MENTORING PARTNER</span>
            <button
              className="text-button"
              onClick={() => navigate("partner")}
            >
              View partnership
            </button>
          </div>
          <div className="partner-row">
            <div className="avatar avatar--jordan">JL</div>
            <div>
              <h3>Jordan Lee</h3>
              <p>8th Grade Science · Lincoln Middle</p>
            </div>
            <span className="status-dot">Active</span>
          </div>
          <blockquote>
            “Small conversations can make a big week feel much more
            manageable.”
          </blockquote>
        </article>
      </div>
    </>
  );
}

function CultureScreen() {
  const [started, setStarted] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  const [question, setQuestion] = useState(1);

  const nextQuestion = () => {
    if (answer === null) return;
    setQuestion((current) => Math.min(current + 1, 26));
    setAnswer(null);
  };

  return (
    <>
      <ScreenHeading
        description="Your perspective helps identify where collective support can make the biggest difference."
        eyebrow="CULTURE & BELONGING"
        title="A clearer picture, shaped by every voice."
      />

      {!started ? (
        <section className="culture-intake-card">
          <div className="culture-intake__art">
            <div className="rings">
              <span />
              <span />
              <span />
              <div className="rings-center">
                <Icon name="heart" size={27} />
              </div>
            </div>
          </div>
          <div className="culture-intake__body">
            <span className="action-kicker action-kicker--light">
              <Icon name="scan" size={17} />
              Fall Culture Scan
            </span>
            <h2>Make space for what’s true.</h2>
            <p>
              This 26-item scan asks about your day-to-day experience at
              school. There are no right answers, and your individual responses
              are never shared.
            </p>
            <div className="scan-facts">
              <div>
                <Icon name="clock" size={21} />
                <span>
                  <strong>~5 minutes</strong>
                  One short sitting
                </span>
              </div>
              <div>
                <Icon name="lock" size={21} />
                <span>
                  <strong>100% anonymous</strong>
                  No individual reporting
                </span>
              </div>
              <div>
                <Icon name="shield" size={21} />
                <span>
                  <strong>Group masking</strong>
                  Gate 3 enforced at k ≥ 5
                </span>
              </div>
            </div>
            <button
              className="button button--primary"
              onClick={() => setStarted(true)}
            >
              Begin Culture Scan
              <Icon name="arrow" size={18} />
            </button>
            <p className="save-note">
              Your progress saves automatically on this device.
            </p>
          </div>
        </section>
      ) : (
        <section className="survey-card">
          <div className="survey-progress">
            <div>
              <span>Question {question} of 26</span>
              <strong>{Math.round((question / 26) * 100)}% complete</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${(question / 26) * 100}%` }} />
            </div>
          </div>
          <div className="survey-question">
            <span className="card-label">YOUR EXPERIENCE</span>
            <h2>I feel comfortable asking colleagues for support.</h2>
            <p>Choose the response that feels most true today.</p>
          </div>
          <div className="scale-options">
            {[
              "Strongly disagree",
              "Disagree",
              "Neither",
              "Agree",
              "Strongly agree",
            ].map((label, index) => (
              <button
                className={answer === index ? "selected" : ""}
                key={label}
                onClick={() => setAnswer(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            ))}
          </div>
          <div className="survey-footer">
            <span>
              <Icon name="lock" size={15} /> Your answer is anonymous
            </span>
            <button
              className="button button--primary"
              disabled={answer === null}
              onClick={nextQuestion}
            >
              Next question
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function ConversationScreen() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const toggleTopic = (topic: string) => {
    setSaved(false);
    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic],
    );
  };

  return (
    <>
      <ScreenHeading
        description="A quick record of connection — not another form to fill out."
        eyebrow="QUICK LOG"
        title="Log a conversation."
      />
      <PrivacyBanner compact />

      <section className="log-card">
        {saved ? (
          <div className="success-state">
            <span className="success-check">
              <Icon name="check" size={30} />
            </span>
            <p className="eyebrow">CONVERSATION LOGGED</p>
            <h2>That’s it. You’re all set.</h2>
            <p>
              Your private note is saved. Only the selected topic tags
              contribute to school-wide support planning.
            </p>
            <button
              className="button button--secondary"
              onClick={() => {
                setSaved(false);
                setSelectedTopics([]);
                setNotes("");
              }}
            >
              Log another conversation
            </button>
          </div>
        ) : (
          <>
            <div className="log-card__header">
              <div>
                <span className="step-count">1</span>
                <div>
                  <h2>When did you connect?</h2>
                  <p>Today is already selected.</p>
                </div>
              </div>
              <label className="date-field">
                <Icon name="calendar" size={18} />
                <input
                  aria-label="Conversation date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  type="date"
                />
                <span>{today}</span>
              </label>
            </div>

            <div className="form-section">
              <div className="form-section__heading">
                <span className="step-count">2</span>
                <div>
                  <h2>What did you talk about?</h2>
                  <p>Select all that apply. At least one is needed.</p>
                </div>
              </div>
              <div className="topic-grid">
                {topics.map((topic) => (
                  <button
                    className={selectedTopics.includes(topic) ? "selected" : ""}
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                  >
                    <span className="topic-check">
                      {selectedTopics.includes(topic) && (
                        <Icon name="check" size={15} />
                      )}
                    </span>
                    {topic}
                  </button>
                ))}
              </div>
              <p className="controlled-note">
                <Icon name="sliders" size={15} />
                Fixed topic tags keep support routing clear and fair.
              </p>
            </div>

            <div className="form-section form-section--optional">
              <div className="form-section__heading">
                <span className="step-count step-count--muted">3</span>
                <div>
                  <h2>
                    Private note <em>Optional</em>
                  </h2>
                  <p>Only you can see this. A few words are enough.</p>
                </div>
              </div>
              <textarea
                maxLength={240}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything you want to remember?"
                value={notes}
              />
              <span className="character-count">{notes.length}/240</span>
            </div>

            <div className="log-footer">
              <span>
                <Icon name="lock" size={16} />
                Your note stays private
              </span>
              <button
                className="button button--primary"
                disabled={selectedTopics.length === 0}
                onClick={() => setSaved(true)}
              >
                Save conversation
                <Icon name="check" size={18} />
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function PartnerScreen({ navigate }: { navigate: (screen: Screen) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [reason, setReason] = useState("");

  const closeModal = () => {
    setModalOpen(false);
    setRequestSent(false);
    setReason("");
  };

  return (
    <>
      <ScreenHeading
        description="A quiet place to understand and manage your mentoring partnership."
        eyebrow="MY PARTNERSHIP"
        title="Support works better together."
      />

      <section className="partner-hero">
        <div className="partner-hero__profile">
          <div className="avatar avatar--xl avatar--jordan">JL</div>
          <div>
            <span className="status-dot">Active partnership</span>
            <h2>Jordan Lee</h2>
            <p>8th Grade Science · Lincoln Middle School</p>
          </div>
        </div>
        <div className="partner-hero__actions">
          <button
            className="button button--primary"
            onClick={() => navigate("conversation")}
          >
            <Icon name="message" size={18} />
            Log a conversation
          </button>
        </div>
      </section>

      <div className="partner-layout">
        <section className="partnership-details">
          <div className="section-title">
            <span>
              <Icon name="heart" size={18} />
            </span>
            <div>
              <h3>Your partnership at a glance</h3>
              <p>Designed around shared context, not evaluation.</p>
            </div>
          </div>
          <div className="detail-grid">
            <div>
              <span>Paired since</span>
              <strong>August 2024</strong>
            </div>
            <div>
              <span>Shared focus</span>
              <strong>Classroom routines</strong>
            </div>
            <div>
              <span>Connection rhythm</span>
              <strong>About every 2 weeks</strong>
            </div>
            <div>
              <span>Last conversation</span>
              <strong>October 14</strong>
            </div>
          </div>
          <div className="conversation-history">
            <div className="card-topline">
              <div>
                <span className="card-label card-label--gold">
                  PRIVATE ACTIVITY
                </span>
                <h3>Recent connections</h3>
              </div>
              <span>Visible only to you</span>
            </div>
            <div className="history-item">
              <span className="history-date">OCT<br />14</span>
              <div>
                <strong>2 topics logged</strong>
                <p>#classroommanagement · #celebrations</p>
              </div>
              <Icon name="check" size={18} />
            </div>
            <div className="history-item">
              <span className="history-date">SEP<br />30</span>
              <div>
                <strong>1 topic logged</strong>
                <p>#planning</p>
              </div>
              <Icon name="check" size={18} />
            </div>
          </div>
        </section>

        <aside className="adjustment-card">
          <span className="adjustment-icon">
            <Icon name="sliders" size={20} />
          </span>
          <h3>Need something different?</h3>
          <p>
            Partnerships don’t always fit, and that’s okay. You can privately
            request an adjustment at any time.
          </p>
          <div className="principal-note">
            <Icon name="lock" size={16} />
            <span>
              <strong>Private request</strong>
              Only your principal sees this request, never your partner.
            </span>
          </div>
          <button
            className="text-button text-button--gold"
            onClick={() => setModalOpen(true)}
          >
            Request a partner adjustment
            <Icon name="arrow" size={17} />
          </button>
        </aside>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="adjustment-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <button
              aria-label="Close"
              className="modal-close"
              onClick={closeModal}
            >
              <Icon name="close" size={20} />
            </button>
            {requestSent ? (
              <div className="success-state success-state--modal">
                <span className="success-check">
                  <Icon name="check" size={30} />
                </span>
                <h2 id="adjustment-title">Your request is private and sent.</h2>
                <p>
                  Your principal will follow up with you directly. Jordan has
                  not been notified.
                </p>
                <button
                  className="button button--primary"
                  onClick={closeModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <span className="modal-icon">
                  <Icon name="sliders" size={22} />
                </span>
                <p className="eyebrow">PRIVATE REQUEST</p>
                <h2 id="adjustment-title">Request a partner adjustment</h2>
                <p className="modal-description">
                  Share only what feels useful. This goes directly to your
                  principal and is never shown to your partner.
                </p>
                <label className="modal-label" htmlFor="adjustment-reason">
                  What would be most helpful?
                  <span>Optional</span>
                </label>
                <textarea
                  id="adjustment-reason"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="A schedule change, different area of experience, or anything else..."
                  value={reason}
                />
                <div className="modal-privacy">
                  <Icon name="lock" size={16} />
                  Only your principal can read this
                </div>
                <button
                  className="button button--primary button--full"
                  onClick={() => setRequestSent(true)}
                >
                  Send private request
                  <Icon name="arrow" size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function TeacherDashboard({ fontVariable }: { fontVariable: string }) {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <div className={`tdash ${fontVariable}`}>
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setScreen("home")}>
          <span className="brand-badge">
            <span>M</span>
          </span>
          <strong>Mentorful Engine</strong>
        </button>

        <nav aria-label="Primary navigation">
          <p>WORKBENCH</p>
          {navItems.map((item) => (
            <button
              aria-current={screen === item.id ? "page" : undefined}
              className={screen === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setScreen(item.id)}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span>
            <Icon name="heart" size={18} />
          </span>
          <p>
            <strong>You’re doing meaningful work.</strong>
            Mentorful is here to make it feel less lonely.
          </p>
        </div>

        <div className="profile">
          <div className="avatar avatar--maya">MR</div>
          <div>
            <strong>Maya Rodriguez</strong>
            <span>5th Grade Teacher</span>
          </div>
          <button aria-label="Notifications">
            <Icon name="bell" size={19} />
          </button>
        </div>
      </aside>

      <div className="mobile-header">
        <button className="brand" onClick={() => setScreen("home")}>
          <span className="brand-badge">
            <span>M</span>
          </span>
          <strong>Mentorful Engine</strong>
        </button>
        <div className="avatar avatar--maya">MR</div>
      </div>

      <main>
        <div className="content">
          {screen === "home" && <HomeScreen navigate={setScreen} />}
          {screen === "culture" && <CultureScreen />}
          {screen === "conversation" && <ConversationScreen />}
          {screen === "partner" && <PartnerScreen navigate={setScreen} />}
        </div>
      </main>

      <nav aria-label="Mobile navigation" className="mobile-nav">
        {navItems.map((item) => (
          <button
            className={screen === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setScreen(item.id)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label.replace("My ", "")}</span>
          </button>
        ))}
      </nav>
    </div>
    </div>
  );
}
