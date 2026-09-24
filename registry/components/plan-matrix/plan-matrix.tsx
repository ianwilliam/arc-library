"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { motionTokens } from "@/lib/motion-tokens";
import styles from "./plan-matrix.module.css";

export type PlanMatrixValue = boolean | string;

export interface PlanMatrixPlan {
  id: string;
  name: string;
  /** Price line under the name, e.g. "$99 per year". */
  price?: ReactNode;
  /** Mark one plan as recommended. Its column carries the accent. */
  featured?: boolean;
  /** Optional call to action rendered in the sticky header. */
  action?: ReactNode;
}

export interface PlanMatrixRow {
  label: string;
  /** Short clarification shown under the label. */
  hint?: string;
  /** Value per plan id. `true` renders a check, `false` a dash, a string renders as text. */
  values: Record<string, PlanMatrixValue>;
}

export interface PlanMatrixGroup {
  id: string;
  label: string;
  rows: PlanMatrixRow[];
  /** Groups start open unless set to false. */
  defaultOpen?: boolean;
}

export interface PlanMatrixProps {
  plans: PlanMatrixPlan[];
  groups: PlanMatrixGroup[];
  /** Accessible name for the table. */
  label?: string;
  /** Distance from the top of the viewport where the plan header sticks, e.g. 64 for a fixed site header. */
  stickyTop?: number;
  /** Show the "Only differences" switch. */
  differencesToggle?: boolean;
  /** Plan shown first on narrow widths, where one plan column is visible at a time. Defaults to the featured plan. */
  defaultPlan?: string;
  /** Width in px below which the matrix shows one plan at a time. */
  narrowBelow?: number;
  className?: string;
}

const { spring, duration, ease } = motionTokens;
const CHECK = "M5 12.5 L9.5 17 L19 7.5";
const DASH = "M7 12 L12 12 L17 12";

function same(row: PlanMatrixRow, plans: PlanMatrixPlan[]) {
  const values = plans.map(plan => String(row.values[plan.id] ?? false));
  return values.every(value => value === values[0]);
}

/** A check that morphs into a dash (and back) when the value under it changes. */
function Mark({ on, reduced }: { on: boolean; reduced: boolean }) {
  return (
    <svg className={styles.mark} data-on={on || undefined} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <motion.path
        initial={false}
        animate={{ d: on ? CHECK : DASH }}
        transition={reduced ? { duration: 0 } : spring.snappy}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cell({ value, reduced }: { value: PlanMatrixValue | undefined; reduced: boolean }) {
  if (typeof value === "string") {
    return (
      <span className={styles.text}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, transition: { duration: duration.fast } }} transition={{ duration: duration.standard, ease: [...ease.enter] }}>
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }
  const on = value === true;
  return <><Mark on={on} reduced={reduced} /><span className={styles.srOnly}>{on ? "Included" : "Not included"}</span></>;
}

/**
 * An interactive plan comparison. The plan header sticks while you scroll, the column under the
 * pointer lights up, categories collapse, and "Only differences" folds away the rows every plan
 * shares. On narrow widths it shows one plan at a time and its checks morph as you switch.
 */
export function PlanMatrix({ plans, groups, label = "Compare plans", stickyTop = 0, differencesToggle = true, defaultPlan, narrowBelow = 560, className }: PlanMatrixProps) {
  const reduced = !!useReducedMotion();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [narrow, setNarrow] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map(group => [group.id, group.defaultOpen !== false])));
  const featured = plans.find(plan => plan.featured)?.id;
  const [focusPlan, setFocusPlan] = useState(defaultPlan ?? featured ?? plans[0]?.id);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < narrowBelow));
    observer.observe(node);
    return () => observer.disconnect();
  }, [narrowBelow]);

  const visiblePlans = narrow ? plans.filter(plan => plan.id === focusPlan) : plans;
  const style = { "--plan-count": visiblePlans.length, "--sticky-top": `${stickyTop}px` } as CSSProperties;
  const smooth = reduced ? { duration: 0 } : spring.smooth;

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + plans.length) % plans.length;
    setFocusPlan(plans[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div ref={root} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-narrow={narrow || undefined} onPointerLeave={() => setHovered(null)}>
      {(differencesToggle || narrow) ? (
        <div className={styles.toolbar}>
          {narrow ? (
            <LayoutGroup id={`${id}-tabs`}>
              <div className={styles.tabs} role="tablist" aria-label="Plan to show">
                {plans.map((plan, index) => (
                  <button
                    key={plan.id}
                    ref={node => { tabs.current[index] = node; }}
                    type="button"
                    role="tab"
                    aria-selected={plan.id === focusPlan}
                    tabIndex={plan.id === focusPlan ? 0 : -1}
                    className={styles.tab}
                    data-featured={plan.featured || undefined}
                    onClick={() => setFocusPlan(plan.id)}
                    onKeyDown={event => onTabKey(event, index)}
                  >
                    {plan.id === focusPlan ? <motion.span layoutId="plan-matrix-tab" className={styles.tabThumb} transition={reduced ? { duration: 0 } : spring.snappy} /> : null}
                    <span className={styles.tabLabel}>{plan.name}</span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
          ) : <span />}
          {differencesToggle ? (
            <button type="button" className={styles.switch} role="switch" aria-checked={onlyDiff} onClick={() => setOnlyDiff(value => !value)}>
              <span className={styles.switchTrack} data-on={onlyDiff || undefined}><span className={styles.switchThumb} /></span>
              Only differences
            </button>
          ) : null}
        </div>
      ) : null}

      <div role="table" aria-label={label} className={styles.table}>
        <div role="rowgroup" className={styles.head}>
          <div role="row" className={styles.row}>
            <div role="columnheader" className={styles.corner}><span className={styles.srOnly}>Feature</span></div>
            {visiblePlans.map(plan => (
              <div
                key={plan.id}
                role="columnheader"
                className={styles.planHead}
                data-featured={plan.featured || undefined}
                data-hover={hovered === plan.id || undefined}
                onPointerEnter={() => setHovered(plan.id)}
              >
                <span className={styles.planName}>{plan.name}</span>
                {plan.price ? <span className={styles.planPrice}>{plan.price}</span> : null}
                {plan.action ? <span className={styles.planAction}>{plan.action}</span> : null}
              </div>
            ))}
          </div>
        </div>

        {groups.map(group => {
          const rows = onlyDiff ? group.rows.filter(row => !same(row, plans)) : group.rows;
          const expanded = open[group.id] !== false;
          const panelId = `${id}-${group.id}`;
          return (
            <div role="rowgroup" key={group.id} className={styles.group}>
              <div role="row" className={styles.groupRow}>
                <div role="rowheader" className={styles.groupCell}>
                  <button type="button" className={styles.groupButton} aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(state => ({ ...state, [group.id]: !expanded }))}>
                    <motion.span className={styles.chevron} animate={{ rotate: expanded ? 0 : -90 }} transition={reduced ? { duration: 0 } : spring.snappy}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></motion.span>
                    <span>{group.label}</span>
                    <span className={styles.groupCount}>{rows.length}</span>
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    key="rows"
                    id={panelId}
                    className={styles.rows}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={reduced ? { duration: 0 } : { height: smooth, opacity: { duration: duration.standard } }}
                  >
                    <AnimatePresence initial={false}>
                      {rows.map(row => (
                        <motion.div
                          key={row.label}
                          role="row"
                          className={styles.row}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={reduced ? { duration: 0 } : { height: smooth, opacity: { duration: duration.fast } }}
                        >
                          <div role="rowheader" className={styles.feature}>
                            <span>{row.label}</span>
                            {row.hint ? <span className={styles.hint}>{row.hint}</span> : null}
                          </div>
                          {visiblePlans.map(plan => (
                            <div
                              key={narrow ? "focus" : plan.id}
                              role="cell"
                              className={styles.cell}
                              data-featured={plan.featured || undefined}
                              data-hover={hovered === plan.id || undefined}
                              data-on={row.values[plan.id] === true || undefined}
                              onPointerEnter={() => setHovered(plan.id)}
                            >
                              <Cell value={row.values[plan.id]} reduced={reduced} />
                            </div>
                          ))}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {rows.length === 0 ? <p className={styles.empty}>Every plan includes these.</p> : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlanMatrix;
