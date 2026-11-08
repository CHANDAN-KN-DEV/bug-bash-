import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, GraduationCap, Scale, ShieldCheck, Wifi, UsersRound } from 'lucide-react';

export type CompetitionRule = {
  version: string;
  content: string;
  updated_at?: string;
};

const sectionIcons = [GraduationCap, CalendarDays, Scale, Wifi, ShieldCheck, Wifi, UsersRound, ShieldCheck];

const getSections = (content: string) => {
  const sections: Array<{ title: string; items: string[] }> = [];
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) sections.push({ title: heading[1].trim(), items: [] });
    else if (line.trim() && sections.length) {
      sections[sections.length - 1].items.push(line.replace(/^\d+\.\s*/, '').trim());
    }
  }
  return sections;
};

export const RulesReader: React.FC<{
  rule: CompetitionRule;
  onReachedBottom?: () => void;
}> = ({ rule, onReachedBottom }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const sections = useMemo(() => getSections(rule.content), [rule.content]);

  useEffect(() => {
    setProgress(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [rule.version]);

  const handleScroll = useCallback(() => {
    const panel = scrollRef.current;
    if (!panel) return;
    const maximum = panel.scrollHeight - panel.clientHeight;
    const percentage = maximum <= 0 ? 100 : Math.min(100, (panel.scrollTop / maximum) * 100);
    setProgress(percentage);
    if (maximum <= 0 || maximum - panel.scrollTop <= 3) onReachedBottom?.();
  }, [onReachedBottom]);

  useEffect(() => {
    const panel = scrollRef.current;
    if (!panel) return;
    const frame = window.requestAnimationFrame(handleScroll);
    const observer = new ResizeObserver(handleScroll);
    observer.observe(panel);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [handleScroll, rule.content]);

  return (
    <section className="drift-rules-reader" aria-label={`Competition rules version ${rule.version}`}>
      <div className="drift-rules-progress" role="progressbar" aria-label="Rules reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="drift-rules-layout">
        <nav className="drift-rules-toc" aria-label="Rules table of contents">
          <p>CONTENTS · V{rule.version}</p>
          {sections.map((section, index) => {
            const Icon = sectionIcons[index] || CheckCircle2;
            return <a key={`${section.title}-${index}`} href={`#drift-rule-${index}`}><Icon size={15} aria-hidden="true" />{section.title.replace(/^[A-H]\.\s*/, '')}</a>;
          })}
        </nav>
        <div ref={scrollRef} className="drift-rules-scroll" tabIndex={0} onScroll={handleScroll} onKeyUp={handleScroll}>
          <p className="drift-rule-version">ACTIVE VERSION · {rule.version}</p>
          {sections.map((section, index) => {
            const Icon = sectionIcons[index] || CheckCircle2;
            return (
              <section id={`drift-rule-${index}`} key={`${section.title}-${index}`} className="drift-rule-section">
                <h3><Icon size={18} aria-hidden="true" />{section.title}</h3>
                <ol>{section.items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{item}</li>)}</ol>
              </section>
            );
          })}
          {!sections.length && <pre className="whitespace-pre-wrap">{rule.content}</pre>}
          <p className="drift-rules-end">END OF RULES · V{rule.version}</p>
        </div>
      </div>
    </section>
  );
};
