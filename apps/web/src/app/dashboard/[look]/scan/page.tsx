import { Icon } from "@/components/teacher/icons";
import { ScanLink, ScanStatusLabel } from "@/components/teacher/scan-card";

export default function ScanPage() {
  return (
    <main className="ev-main">
      <header className="ta-hello">
        <p className="ev-eyebrow">Culture &amp; belonging</p>
        <h1>
          A clearer picture, shaped by <em>every voice</em>.
        </h1>
        <p className="ev-lead">Your perspective helps show where support across the school can make the biggest difference.</p>
      </header>

      <section className="ta-scan">
        <div className="ta-scan-art" aria-hidden>
          <i /><i /><i />
          <span><Icon name="heart" size={28} /></span>
        </div>
        <div className="ta-scan-body">
          <p className="ev-eyebrow">School Culture Scan</p>
          <h2>Make space for what&rsquo;s <em>true</em>.</h2>
          <p>
            Twenty-six questions about the school around you: who you can go to when something goes wrong, whether it&rsquo;s safe to say a lesson didn&rsquo;t work, and whether the adults here are pulling in the same direction. There are no right answers, and none of it is about your teaching.
          </p>
          <ul className="ta-facts-row">
            <li><Icon name="clock" size={20} /><span><strong>About six minutes</strong>One short sitting</span></li>
            <li><Icon name="lock" size={20} /><span><strong>Anonymous, structurally</strong>Stored against a random code, never your login</span></li>
            <li><Icon name="shield" size={20} /><span><strong>Whole-faculty pattern only</strong>Your principal sees nothing individual</span></li>
          </ul>
          <div className="ta-row">
            <ScanLink />
            <small className="ev-muted"><ScanStatusLabel /></small>
          </div>
          <p className="ev-small">Your progress saves on this device. The scan runs again later in the year; the comparison is the part that matters.</p>
        </div>
      </section>
    </main>
  );
}
