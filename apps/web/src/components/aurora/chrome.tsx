import { AtlasBar, type NavItem, type QuickAction } from "./bar";
import { auroraFonts } from "./fonts";
import "@/app/aurora.css";

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

// Applies the saved Day/Night choice before first paint so there is no flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("mentorful-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"night":"day";var r=document.currentScript.parentElement;r.setAttribute("data-theme",t==="night"?"dark":"light")}catch(e){}})()`;

export function AuroraChrome({
  schoolName,
  displayName,
  roleLabel,
  nav,
  actions,
  primary,
  tools,
  children,
}: {
  schoolName: string;
  displayName: string;
  roleLabel: string;
  home?: string;
  nav: NavItem[];
  actions: QuickAction[];
  primary?: QuickAction;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`ev ${auroraFonts}`} data-theme="light" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div className="ev-aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <AtlasBar items={nav} actions={actions} primary={primary} tools={tools} displayName={displayName} roleLabel={roleLabel} schoolName={schoolName} initials={initialsOf(displayName)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
      <footer className="ev-foot">
        <span>{schoolName}</span>
        <span>Individual answers and private conversations are never shown to leaders</span>
      </footer>
    </div>
  );
}
