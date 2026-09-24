"use client";

import { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import SegmentedControl from "@/registry/components/segmented-control/segmented-control";
import { motionTokens } from "@/lib/motion-tokens";
import { stats as exampleStats, type Stat } from "./stats-band-data";
import styles from "./stats-band.module.css";

export type { Stat } from "./stats-band-data";
export type StatsBandLayout = "plain" | "divided";

export interface StatsBandProps {
  /** Three or four stats read best. */
  stats?: Stat[];
  /** `plain` lets the numbers float; `divided` rules the band top and bottom and draws a line between stats. */
  layout?: StatsBandLayout;
  title?: string;
  description?: string;
  /** Seconds each number takes to count up. Defaults to 1.6. */
  duration?: number;
  /** Number formatting locale. Fixed by default so server and client agree. */
  locale?: string;
  className?: string;
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;

function useFormatter(decimals: number, locale: string) {
  return useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, numberingSystem: "latn" }), [decimals, locale]);
}

/**
 * One number that counts from zero to its value the first time the band is in view. The final value reserves the
 * width underneath, so the layout never moves while digits change.
 */
function CountUp({ stat, run, delay, duration, reduced, locale }: { stat: Stat; run: boolean; delay: number; duration: number; reduced: boolean; locale: string }) {
  const live = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  const format = useFormatter(stat.decimals ?? 0, locale);
  const final = format.format(stat.value);

  useLayoutEffect(() => {
    if (reduced || done.current || !live.current) return;
    live.current.textContent = format.format(0);
  }, [format, reduced]);

  useEffect(() => {
    const node = live.current;
    if (!node) return;
    if (reduced) { node.textContent = final; done.current = true; return; }
    if (!run || done.current) return;
    const controls = animate(0, stat.value, {
      duration,
      delay,
      ease: enter,
      onUpdate: latest => { node.textContent = format.format(latest); },
      onComplete: () => { node.textContent = final; done.current = true; },
    });
    return () => controls.stop();
  }, [run, reduced, stat.value, delay, duration, format, final]);

  return <span className={styles.value}>
    <span className={styles.srOnly}>{stat.prefix}{final}{stat.suffix}</span>
    <span className={styles.number} aria-hidden="true">
      {stat.prefix && <span className={styles.affix}>{stat.prefix}</span>}
      <span className={styles.digits}>
        <span className={styles.sizer}>{final}</span>
        <span ref={live} className={styles.live}>{final}</span>
      </span>
      {stat.suffix && <span className={styles.affix}>{stat.suffix}</span>}
    </span>
  </span>;
}

/**
 * A band of three or four headline numbers that count up once as the band scrolls into view, in a plain or a
 * divided layout. Numbers use tabular figures and reserve their final width, and screen readers get the final value.
 */
export const StatsBand = forwardRef<HTMLElement, StatsBandProps>(function StatsBand({
  stats = exampleStats,
  layout = "plain",
  title,
  description,
  duration = 1.6,
  locale = "en-US",
  className,
}, ref) {
  const id = useId();
  const list = useRef<HTMLDListElement>(null);
  const inView = useInView(list, { once: true, amount: .5 });
  const reduced = !!useReducedMotion();
  return <section ref={ref} className={[styles.band, className].filter(Boolean).join(" ")} data-layout={layout} data-in-view={inView || reduced ? "" : undefined} aria-labelledby={title ? `${id}-title` : undefined} aria-label={title ? undefined : "Key numbers"}>
    <div className={styles.inner}>
      {(title || description) && <header className={styles.header}>
        {title && <h2 id={`${id}-title`} className={styles.title}>{title}</h2>}
        {description && <p className={styles.description}>{description}</p>}
      </header>}
      <dl ref={list} className={styles.stats} style={{ "--count": stats.length } as CSSProperties}>
        {stats.map((stat, index) => <div key={`${stat.label}-${index}`} className={styles.stat} style={{ "--i": index } as CSSProperties}>
          <dt className={styles.label}>{stat.label}</dt>
          <dd className={styles.figure}>
            <CountUp stat={stat} run={inView} delay={index * .09} duration={duration} reduced={reduced} locale={locale} />
          </dd>
          {stat.detail && <dd className={styles.detail}>{stat.detail}</dd>}
        </div>)}
      </dl>
    </div>
  </section>;
});

StatsBand.displayName = "StatsBand";

const layoutOptions = [{ value: "plain", label: "Plain" }, { value: "divided", label: "Divided" }];

/** Preview: the band in either layout. Switching layouts counts the numbers up again. */
export function StatsBandBlock() {
  const [layout, setLayout] = useState<StatsBandLayout>("divided");
  return <div className={styles.preview}>
    <SegmentedControl label="Stats layout" options={layoutOptions} value={layout} onValueChange={next => setLayout(next as StatsBandLayout)} />
    <div className={styles.frame}>
      <StatsBand key={layout} layout={layout} title="Trusted by teams who ship" description="Real numbers from the last twelve months." />
    </div>
  </div>;
}

export default StatsBandBlock;
