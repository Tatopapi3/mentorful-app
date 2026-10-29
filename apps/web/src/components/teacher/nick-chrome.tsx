import SiteHeader from "@/components/SiteHeader";
import { signOut } from "@/lib/auth/actions";
import "@/app/aurora.css";
import "./teacher-nick.css";
import { TeacherNickTabs } from "./nick-tabs";

/**
 * The teacher dashboard in Nick's design: his own header (navy badge, serif wordmark), his tab bar, paper and teal. The
 * pages inside are the very same ones the Aurora look uses; the .ta-nick theme re-skins them in his palette and type,
 * the same way his leadership views re-skin the shared constellation.
 */
export function NickTeacherChrome({ base, displayName, schoolName, children }: { base: string; displayName: string; schoolName: string; children: React.ReactNode }) {
  return (
    <div className="ev ta-nick" data-theme="light">
      <SiteHeader
        right={
          <span className="ta-nick-who">
            <span>
              {displayName} <small>· Teacher</small>
            </span>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </span>
        }
      />
      <div className="ta-nick-frame">
        <TeacherNickTabs base={base} />
        <div className="ta-nick-body">{children}</div>
      </div>
      <footer className="ta-nick-foot">
        <span>{schoolName}</span>
        <span>Individual answers and private conversations are never shown to leaders</span>
      </footer>
    </div>
  );
}
