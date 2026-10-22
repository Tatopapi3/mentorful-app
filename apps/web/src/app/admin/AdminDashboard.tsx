"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  OverviewDepartment,
  OverviewDimension,
  OverviewModel,
  OverviewPair,
  PairStatus,
} from "./overview-model";
import "./overview.css";

type IconName =
  | "shield"
  | "download"
  | "chevron"
  | "close"
  | "lock"
  | "people"
  | "spark"
  | "chart"
  | "bell"
  | "arrowLeft"
  | "arrowRight";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 7.8 7 10 4.2-2.2 7-5.4 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m8 11 4 4 4-4" />
        <path d="M5 20h14" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    people: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z" />
        <path d="m5 15 .7 2.3L8 18.5l-2.3 1.2L5 22l-.7-2.3L2 18.5l2.3-1.2L5 15Z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    arrowLeft: (
      <>
        <path d="m15 18-6-6 6-6" />
        <path d="M21 12H9" />
      </>
    ),
    arrowRight: (
      <>
        <path d="m9 18 6-6-6-6" />
        <path d="M3 12h12" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {paths[name]}
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="Mentorful Engine">
      <span className="brand-mark">
        <span>M</span>
      </span>
      <span>
        Mentorful <b>Engine</b>
      </span>
    </div>
  );
}

function ActionButton({
  children,
  className = "",
  onClick,
  icon,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  icon?: IconName;
}) {
  return (
    <button className={`action-button ${className}`} onClick={onClick} type="button">
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}

function SectionHeading({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

function Network({
  model,
  onSelect,
}: {
  model: OverviewModel;
  onSelect: (name: string) => void;
}) {
  const [selected, setSelected] = useState("");
  if (model.dimensions.length === 0) {
    return (
      <div className="trend-note">
        <Icon name="chart" size={22} />
        <div>
          <b>No scan network yet</b>
          <p>{model.networkCaption}</p>
        </div>
      </div>
    );
  }

  const select = (name: string) => {
    setSelected(name);
    onSelect(name);
  };

  return (
    <div className={`network ${selected ? "has-selection" : ""}`}>
      <svg aria-hidden="true" className="network-lines" preserveAspectRatio="none" viewBox="0 0 600 330">
        {model.edges.map((edge) => (
          <path
            className={`link ${edge.dashed ? "link-faint" : ""}`}
            d={edge.d}
            key={edge.key}
            strokeWidth={edge.width}
          />
        ))}
      </svg>
      {model.dimensions.map((dimension) => (
        <button
          aria-label={`View ${dimension.name} summary, average ${dimension.value}`}
          className={`network-node node-${dimension.position} ${dimension.focus ? "focus-node" : ""} ${selected === dimension.name ? "is-selected" : ""}`}
          key={dimension.name}
          onClick={() => select(dimension.name)}
          type="button"
        >
          {dimension.focus && (
            <span className="focus-label">
              <Icon name="spark" size={13} /> Focus area
            </span>
          )}
          <strong>{dimension.value}</strong>
          <span>{dimension.name}</span>
        </button>
      ))}
    </div>
  );
}

function Heatmap({
  departments,
  onSelect,
}: {
  departments: OverviewDepartment[];
  onSelect: (name: string, locked: boolean) => void;
}) {
  if (departments.length === 0) {
    return <p className="muted-line pad">No departments on the roster yet.</p>;
  }
  return (
    <div className="heatmap">
      <div className="heatmap-header" aria-hidden="true">
        <span />
        <span>Str.</span>
        <span>Rel.</span>
        <span>Cog.</span>
        <span>Eff.</span>
      </div>
      {departments.map((department) => (
        <button
          className={`heatmap-row ${department.locked ? "locked-row" : ""}`}
          key={department.name}
          onClick={() => onSelect(department.name, department.locked)}
          type="button"
        >
          <span className="department-label">
            <b>{department.name}</b>
            <small>
              {department.size === 1 ? "1 teacher" : `${department.size} teachers`}
            </small>
          </span>
          {department.locked ? (
            <span className="locked-cells">
              <Icon name="lock" size={15} /> Hidden to protect anonymity
            </span>
          ) : (
            <>
              <span className="heat-cell shade-2" aria-label={`${department.name} Structural not available`}>
                —
              </span>
              <span className="heat-cell shade-4" aria-label={`${department.name} Relational not available`}>
                —
              </span>
              <span className="heat-cell shade-1" aria-label={`${department.name} Cognitive not available`}>
                —
              </span>
              <span className="heat-cell shade-3" aria-label={`${department.name} Efficacy not available`}>
                —
              </span>
            </>
          )}
        </button>
      ))}
      <div className="heat-scale">
        <span>1</span>
        <i />
        <span>6</span>
        <em>Culture Scan scale</em>
      </div>
    </div>
  );
}

function PairingSummary({ model }: { model: OverviewModel }) {
  const { pairing } = model;
  return (
    <div className="pairing-content">
      <div className="pairing-hero">
        <span className="pair-icon">
          <Icon name="people" size={22} />
        </span>
        <strong>{pairing.crossPct}</strong>
        <p>of pairs connect different departments</p>
      </div>
      {pairing.total > 0 && (
        <>
          <div
            className="progress-bar"
            aria-label={`${pairing.active} active, ${pairing.pending} pending, ${pairing.declined} declined`}
          >
            {pairing.active > 0 && <span className="active-bar" style={{ flex: pairing.active }} />}
            {pairing.pending > 0 && <span className="nudge-bar" style={{ flex: pairing.pending }} />}
            {pairing.declined > 0 && <span className="ended-bar" style={{ flex: pairing.declined }} />}
          </div>
          <div className="progress-legend">
            <span>
              <i className="active-dot" /> <b>{pairing.active}</b> Active
            </span>
            <span>
              <i className="nudge-dot" /> <b>{pairing.pending}</b> Pending
            </span>
            <span>
              <i className="ended-dot" /> <b>{pairing.declined}</b> Declined
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Topics({ model }: { model: OverviewModel }) {
  const max = Math.max(1, ...model.topics.map((topic) => topic.count ?? 0));
  return (
    <div className="topics">
      {model.topics.map((topic, index) => {
        const hidden = topic.count === null;
        const width = hidden ? "14%" : `${((topic.count ?? 0) / max) * 100}%`;
        return (
          <div className="topic-row" key={topic.name}>
            <span className="topic-number">0{index + 1}</span>
            <span className="topic-name">{topic.name}</span>
            <span className="topic-track">
              <i style={{ width }} />
            </span>
            <b className={hidden ? "private-value" : ""}>
              {hidden && <Icon name="lock" size={13} />}
              {hidden ? "fewer than 5" : topic.count}
            </b>
          </div>
        );
      })}
    </div>
  );
}

function SummaryDrawer({
  selection,
  locked,
  dimension,
  department,
  onClose,
}: {
  selection: string;
  locked: boolean;
  dimension?: OverviewDimension;
  department?: OverviewDepartment;
  onClose: () => void;
}) {
  return (
    <>
      <button aria-label="Close summary" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`${selection} summary`} className="drawer">
        <div className="drawer-top">
          <span className="eyebrow">Group summary</span>
          <button aria-label="Close summary" className="icon-button" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </div>
        {locked ? (
          <div className="privacy-message">
            <span className="privacy-lock">
              <Icon name="lock" size={24} />
            </span>
            <h2>Hidden to protect anonymity</h2>
            <p>{selection} has fewer than 5 teachers. Results are never shown for a group this small.</p>
            <ActionButton onClick={onClose}>Close</ActionButton>
          </div>
        ) : (
          <>
            <div className="drawer-title">
              <h2>{selection}</h2>
              <span className="safe-badge">
                <Icon name="shield" size={15} /> Privacy protected
              </span>
            </div>
            {dimension ? (
              <>
                <div className="drawer-stat">
                  <strong>{dimension.value}</strong>
                  <span>out of 6</span>
                </div>
                <div className="drawer-callout">
                  <Icon name={dimension.focus ? "spark" : "chart"} />
                  <div>
                    <b>
                      {dimension.focus
                        ? "Your clearest opportunity"
                        : dimension.strongest
                          ? "Strongest area"
                          : "Culture dimension"}
                    </b>
                    <p>Based on aggregate Culture Scan responses. No individual answers are shown.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="drawer-stat">
                  <strong>{department?.size ?? "—"}</strong>
                  <span>teachers</span>
                  <small>
                    <Icon name="shield" size={12} /> Group is large enough to show
                  </small>
                </div>
                <div className="drawer-callout">
                  <Icon name="chart" />
                  <div>
                    <b>Department view</b>
                    <p>
                      The scan is anonymous and isn’t tied to department, so no department averages are
                      shown.
                    </p>
                  </div>
                </div>
              </>
            )}
            <div className="drawer-note">
              <Icon name="shield" />
              <p>
                <b>Teachers stay protected.</b>
                <br />
                This summary contains aggregates only — never names, answers, or conversation content.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

const SLIDES = ["network", "heatmap", "pairing", "topics"] as const;

function Presentation({ model, onClose }: { model: OverviewModel; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const captions = {
    network: model.networkCaption,
    heatmap: "Department groups stay private unless at least five teachers are represented.",
    pairing: model.pairing.caption,
    topics: model.topicsCaption,
  };

  return (
    <div className="presentation" role="dialog" aria-modal="true" aria-label="Presentation mode">
      <div className="presentation-header">
        <Brand />
        <span>Overview · {model.waveLabel}</span>
        <button aria-label="Exit presentation mode" className="presentation-close" onClick={onClose} type="button">
          <Icon name="close" /> Exit
        </button>
      </div>
      <div className="presentation-stage">
        <span className="presentation-kicker">
          {index + 1} / {SLIDES.length}
        </span>
        <h1>
          {slide === "network" && "How culture dimensions connect"}
          {slide === "heatmap" && "Culture across departments"}
          {slide === "pairing" && "Pairing progress"}
          {slide === "topics" && "What teachers are discussing"}
        </h1>
        <div className="presentation-visual">
          {slide === "network" && <Network model={model} onSelect={() => {}} />}
          {slide === "heatmap" && (
            <Heatmap departments={model.departments} onSelect={() => {}} />
          )}
          {slide === "pairing" && <PairingSummary model={model} />}
          {slide === "topics" &&
            (model.topicsUnavailable ? (
              <div className="trend-note">
                <Icon name="chart" size={22} />
                <div>
                  <b>Topic counts unavailable</b>
                  <p>{model.topicsCaption}</p>
                </div>
              </div>
            ) : (
              <Topics model={model} />
            ))}
        </div>
        <p className="presentation-caption">{captions[slide]}</p>
      </div>
      <div className="presentation-controls">
        <button
          aria-label="Previous slide"
          disabled={index === 0}
          onClick={() => setIndex((value) => value - 1)}
          type="button"
        >
          <Icon name="arrowLeft" />
        </button>
        <div>
          {SLIDES.map((item, itemIndex) => (
            <i className={itemIndex === index ? "current" : ""} key={item} />
          ))}
        </div>
        <button
          aria-label="Next slide"
          disabled={index === SLIDES.length - 1}
          onClick={() => setIndex((value) => value + 1)}
          type="button"
        >
          <Icon name="arrowRight" />
        </button>
      </div>
    </div>
  );
}

const STATUS_META: Record<PairStatus, { cls: string; icon: IconName }> = {
  Active: { cls: "chip-active", icon: "shield" },
  Pending: { cls: "chip-nudge", icon: "bell" },
  Declined: { cls: "chip-ended", icon: "close" },
};

function StatusChip({ status }: { status: PairStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`chip ${meta.cls}`}>
      <Icon name={meta.icon} size={14} /> {status}
    </span>
  );
}

const PAGE_SIZE = 8;

function PairingTab({
  model,
  status,
  onOpen,
}: {
  model: OverviewModel;
  status: string;
  onOpen: (pair: OverviewPair) => void;
}) {
  const [page, setPage] = useState(0);
  const { pairing } = model;
  const rows = pairing.rows.filter((pair) => status === "All statuses" || pair.status === status);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [status]);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Pairing</h1>
          <p>Pairs assigned this cycle. Conversation content is never shown here.</p>
        </div>
      </div>

      <section className="kpi-grid" aria-label="Pairing metrics">
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="people" />
          </span>
          <p>Pairs</p>
          <strong>{pairing.total}</strong>
          <small>
            {pairing.active} active · {pairing.pending} pending
          </small>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="spark" />
          </span>
          <p>Cross-department</p>
          <strong>{pairing.crossPct}</strong>
          <small>
            {pairing.cross} of {pairing.total} pairs
          </small>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="chart" />
          </span>
          <p>Conversations logged</p>
          <strong>{model.conversations.value}</strong>
          <small>{model.conversations.note}</small>
        </article>
        <article className="kpi-card waiting-card">
          <span className="kpi-icon">
            <Icon name="bell" />
          </span>
          <p>
            <i className="amber-dot" aria-hidden="true" /> Waiting for you
          </p>
          <strong>{pairing.pending}</strong>
          <small>Pending pairs in this cycle</small>
        </article>
      </section>

      <section className="pair-layout">
        <article className="chart-card table-card">
          <SectionHeading title="All pairs" subtitle="Select a pair to see who is matched." />
          <div className="status-bar" aria-label={`${pairing.active} active, ${pairing.pending} pending, ${pairing.declined} declined`}>
            <div className="progress-bar">
              {pairing.active > 0 && <span className="active-bar" style={{ flex: pairing.active }} />}
              {pairing.pending > 0 && <span className="nudge-bar" style={{ flex: pairing.pending }} />}
              {pairing.declined > 0 && <span className="ended-bar" style={{ flex: pairing.declined }} />}
            </div>
            <div className="progress-legend">
              <span>
                <i className="active-dot" /> <b>{pairing.active}</b> Active
              </span>
              <span>
                <i className="nudge-dot" /> <b>{pairing.pending}</b> Pending
              </span>
              <span>
                <i className="ended-dot" /> <b>{pairing.declined}</b> Declined
              </span>
            </div>
            <p className="helper">Pending pairs are waiting for approval. Nothing here is a mark against a teacher.</p>
          </div>
          <div className="pair-table" role="table" aria-label="Pairs">
            <div className="pair-row pair-head" role="row">
              {["Teachers", "Departments", "Focus", "Status"].map((heading) => (
                <span key={heading} role="columnheader">
                  {heading}
                </span>
              ))}
            </div>
            {visible.map((pair) => (
              <div
                className="pair-row"
                key={pair.id}
                onClick={() => onOpen(pair)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(pair);
                }}
                role="row"
                tabIndex={0}
              >
                <span data-label="Teachers">
                  <b>{pair.teachers}</b>
                </span>
                <span data-label="Departments">{pair.departments}</span>
                <span data-label="Focus">{pair.focus}</span>
                <span data-label="Status">
                  <StatusChip status={pair.status} />
                </span>
              </div>
            ))}
            {rows.length === 0 && <p className="muted-line pad">No pairs match this filter.</p>}
          </div>
          <div className="pagination">
            <span>
              Showing {visible.length} of {rows.length}
            </span>
            <div>
              <button
                aria-label="Previous page"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                type="button"
              >
                <Icon name="arrowLeft" size={15} />
              </button>
              <b>{safePage + 1}</b>
              <span>of {pages}</span>
              <button
                aria-label="Next page"
                disabled={safePage >= pages - 1}
                onClick={() => setPage(safePage + 1)}
                type="button"
              >
                <Icon name="arrowRight" size={15} />
              </button>
            </div>
          </div>
        </article>

        <div className="side-stack">
          <article className="chart-card side-card">
            <SectionHeading title="Requests" subtitle="Partner requests waiting for a decision." />
            <p className="muted-line request-empty">No partner requests are waiting.</p>
          </article>
          <article className="chart-card side-card">
            <SectionHeading title="Cross-department mix" subtitle="How many pairs connect different departments." />
            <div className="mix">
              <div className="progress-bar">
                {pairing.cross > 0 && <span className="active-bar" style={{ flex: pairing.cross }} />}
                {pairing.same > 0 && <span className="ended-bar" style={{ flex: pairing.same }} />}
              </div>
              <div className="progress-legend">
                <span>
                  <i className="active-dot" /> <b>{pairing.cross}</b> Across departments
                </span>
                <span>
                  <i className="ended-dot" /> <b>{pairing.same}</b> Same department
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default function AdminDashboard({
  model,
  fontVariable,
}: {
  model: OverviewModel;
  fontVariable: string;
}) {
  const [tab, setTab] = useState<"Overview" | "Pairing">("Overview");
  const [department, setDepartment] = useState("All departments");
  const [wave, setWave] = useState(model.waveLabel);
  const [openFilter, setOpenFilter] = useState("");
  const [drawer, setDrawer] = useState<{
    selection: string;
    locked: boolean;
    kind: "dimension" | "department";
  } | null>(null);
  const [pairDrawer, setPairDrawer] = useState<OverviewPair | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [overTime, setOverTime] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [status, setStatus] = useState("All statuses");

  useEffect(() => {
    if (!drawer && !presentation && !pairDrawer) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(null);
        setPairDrawer(null);
        setPresentation(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [drawer, presentation, pairDrawer]);

  useEffect(() => {
    if (!openFilter) return;
    const close = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".filter-wrap")) setOpenFilter("");
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [openFilter]);

  useEffect(() => {
    document.body.style.overflow = presentation ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [presentation]);

  const filters = [
    {
      label: "Department",
      value: department,
      options: ["All departments", ...model.departmentOptions],
      setter: setDepartment,
    },
    {
      label: "Wave",
      value: wave,
      options: [model.waveLabel, "Compare"],
      setter: setWave,
    },
    ...(tab === "Pairing"
      ? [
          {
            label: "Status",
            value: status,
            options: ["All statuses", "Active", "Pending", "Declined"],
            setter: setStatus,
          },
        ]
      : []),
  ];

  const visibleDepartments =
    department === "All departments"
      ? model.departments
      : model.departments.filter((item) => item.name === department);

  const selectedDimension =
    drawer?.kind === "dimension"
      ? model.dimensions.find((item) => item.name === drawer.selection)
      : undefined;
  const selectedDepartment =
    drawer?.kind === "department"
      ? model.departments.find((item) => item.name === drawer.selection)
      : undefined;

  return (
    <div className={`ovw ${fontVariable}`}>
      <header className="topbar">
        <Brand />
        <nav aria-label="Primary navigation">
          {(["Overview", "Pairing"] as const).map((item) => (
            <button
              aria-current={tab === item ? "page" : undefined}
              className={tab === item ? "nav-active" : ""}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {item}
            </button>
          ))}
          <Link href="/report">Reports</Link>
        </nav>
        <div className="header-actions">
          <span className="privacy-badge">
            <Icon name="shield" size={16} /> Groups under 5 are hidden
          </span>
          <ActionButton className="primary-button" icon="download" onClick={() => setPresentation(true)}>
            Present
          </ActionButton>
        </div>
      </header>

      <nav className="section-nav" aria-label="Sections">
        {(["Overview", "Pairing"] as const).map((item) => (
          <button
            aria-current={tab === item ? "page" : undefined}
            className={tab === item ? "nav-active" : ""}
            key={item}
            onClick={() => setTab(item)}
            type="button"
          >
            {item}
          </button>
        ))}
        <Link href="/report">Reports</Link>
      </nav>

      <div className="filterbar">
        <div className="filters">
          {filters.map((filter) => (
            <div className="filter-wrap" key={filter.label}>
              <button
                aria-expanded={openFilter === filter.label}
                className="filter-button"
                onClick={() => setOpenFilter(openFilter === filter.label ? "" : filter.label)}
                type="button"
              >
                <span>
                  <small>{filter.label}</small>
                  {filter.value}
                </span>
                <Icon name="chevron" size={15} />
              </button>
              {openFilter === filter.label && (
                <div className="filter-menu">
                  {filter.options.map((option) => (
                    <button
                      className={filter.value === option ? "selected-option" : ""}
                      key={option}
                      onClick={() => {
                        filter.setter(option);
                        setOpenFilter("");
                      }}
                      type="button"
                    >
                      {option}
                      {filter.value === option && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="active-pills">
          {department !== "All departments" && (
            <button onClick={() => setDepartment("All departments")} type="button">
              {department} <Icon name="close" size={13} />
            </button>
          )}
          {wave === "Compare" && (
            <button onClick={() => setWave(model.waveLabel)} type="button">
              Compare <Icon name="close" size={13} />
            </button>
          )}
          {tab === "Pairing" && status !== "All statuses" && (
            <button onClick={() => setStatus("All statuses")} type="button">
              {status} <Icon name="close" size={13} />
            </button>
          )}
        </div>
        <span className="updated">
          {model.waveLabel}
          {model.synthetic ? " · demo scan" : ""}
        </span>
      </div>

      {wave === "Compare" && (
        <p className="compare-note">No earlier wave to compare yet. This view is the current scan only.</p>
      )}

      {tab === "Pairing" ? (
        <PairingTab model={model} onOpen={setPairDrawer} status={status} />
      ) : (
        <main>
          <section className="focus-banner">
            <div className="focus-icon">
              <Icon name="spark" />
            </div>
            <div>
              <span>Your focus for this semester</span>
              {model.focus ? (
                <p>
                  <b>{model.focus.lead}</b> {model.focus.detail}
                </p>
              ) : (
                <p>
                  <b>No Culture Scan result yet.</b> The focus appears once anonymous responses are in.
                </p>
              )}
            </div>
            {model.focus && (
              <button onClick={() => setShowWhy(!showWhy)} type="button">
                See why <Icon name="chevron" size={14} />
              </button>
            )}
            {showWhy && model.focus && <div className="why-popover">{model.focus.why}</div>}
          </section>

          <section className="kpi-grid" aria-label="Overview metrics">
            <article className="kpi-card">
              <span className="kpi-icon">
                <Icon name="chart" />
              </span>
              <p>Scan completion</p>
              <strong>{model.completion.value}</strong>
              <small>{model.completion.note}</small>
            </article>
            <article className="kpi-card">
              <span className="kpi-icon">
                <Icon name="spark" />
              </span>
              <p>Collective Teacher Efficacy</p>
              <strong>{model.efficacy.value}</strong>
              <small>{model.efficacy.note}</small>
            </article>
            <article className="kpi-card">
              <span className="kpi-icon">
                <Icon name="people" />
              </span>
              <p>Conversations logged</p>
              <strong>{model.conversations.value}</strong>
              <small>{model.conversations.note}</small>
            </article>
            <article className="kpi-card">
              <span className="kpi-icon safe">
                <Icon name="shield" />
              </span>
              <p>Privacy floor</p>
              <strong>5</strong>
              <small>Groups smaller than this stay hidden</small>
            </article>
          </section>

          <section className="chart-grid">
            <article className="chart-card network-card">
              <SectionHeading
                title="How culture dimensions connect"
                subtitle="Circle labels are dimension averages. Line thickness shows which areas move together."
                aside={<span className="legend-line">Thicker line = stronger connection</span>}
              />
              <Network
                model={model}
                onSelect={(selection) => setDrawer({ selection, locked: false, kind: "dimension" })}
              />
              <p className="card-caption">
                <Icon name="spark" size={15} /> {model.networkCaption}
              </p>
            </article>

            <article className="chart-card heatmap-card">
              <SectionHeading
                title="Culture across departments"
                subtitle="Department size is shown. Scan averages are not, because responses aren’t tied to a department."
                aside={<span className="scale-note">1–6 scale</span>}
              />
              <Heatmap
                departments={visibleDepartments}
                onSelect={(selection, locked) => setDrawer({ selection, locked, kind: "department" })}
              />
            </article>

            <article className="chart-card pairing-card">
              <SectionHeading
                title="Pairing progress"
                subtitle="How mentoring pairs are connecting."
                aside={<span className="total-pairs">{model.pairing.total} pairs total</span>}
              />
              <PairingSummary model={model} />
            </article>

            <article className="chart-card topics-card">
              <SectionHeading
                title="What teachers are discussing"
                subtitle="Aggregate topic counts — never conversation content."
                aside={
                  <button
                    aria-pressed={overTime}
                    className="toggle"
                    onClick={() => setOverTime(!overTime)}
                    type="button"
                  >
                    <span className={overTime ? "toggle-on" : ""} /> Over time
                  </button>
                }
              />
              {overTime || model.topicsUnavailable ? (
                <div className="trend-note">
                  <Icon name="chart" size={22} />
                  <div>
                    <b>{overTime ? "Wave comparison" : "Topic counts unavailable"}</b>
                    <p>
                      {overTime
                        ? "This cycle’s totals are the only ones on record, so earlier topic counts aren’t shown."
                        : model.topicsCaption}
                    </p>
                  </div>
                </div>
              ) : (
                <Topics model={model} />
              )}
            </article>
          </section>
        </main>
      )}

      <footer>
        <span>
          <Icon name="shield" size={15} /> Aggregates only. No individual answers or conversation content are shown.
        </span>
        <Link className="faculty-link" href="/admin/map">
          Faculty map
        </Link>
      </footer>

      {drawer && (
        <SummaryDrawer
          department={selectedDepartment}
          dimension={selectedDimension}
          locked={drawer.locked}
          onClose={() => setDrawer(null)}
          selection={drawer.selection}
        />
      )}
      {pairDrawer && (
        <>
          <button aria-label="Close" className="drawer-backdrop" onClick={() => setPairDrawer(null)} type="button" />
          <aside aria-label="Pair details" className="drawer">
            <div className="drawer-top">
              <span className="eyebrow">Pair details</span>
              <button aria-label="Close" className="icon-button" onClick={() => setPairDrawer(null)} type="button">
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer-title">
              <h2>{pairDrawer.teachers}</h2>
              <StatusChip status={pairDrawer.status} />
            </div>
            <p className="drawer-names">
              {pairDrawer.departments}
              <small>{pairDrawer.focus}</small>
            </p>
            <div className="drawer-note">
              <Icon name="shield" />
              <p>
                <b>Conversation content stays with the pair.</b>
                <br />
                Dates and what was said are not available on this screen.
              </p>
            </div>
          </aside>
        </>
      )}
      {presentation && <Presentation model={model} onClose={() => setPresentation(false)} />}
    </div>
  );
}
