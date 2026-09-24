"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import styles from "./stat-card.module.css";

export type StatCardTone = "neutral" | "success" | "warning" | "danger";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  detail?: string;
  change?: string;
  changeLabel?: string;
  trend?: "up" | "down" | "flat";
  tone?: StatCardTone;
  icon?: ReactNode;
  className?: string;
}

/** Copy that holds a number enters from the side it moved toward: a larger value rises from below, a smaller one drops from above. */
const rise: Variants = { hidden: (direction: number) => ({ opacity: 0, y: `${.3 * direction}em`, filter: `blur(${motionTokens.blur.soft}px)` }), shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } }, gone: (direction: number) => ({ opacity: 0, y: `${-.3 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }) };
const fade: Variants = { hidden: { opacity: 0, y: 0, filter: "blur(0px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } }, gone: { opacity: 0, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } } };
const amountIn = (text: string) => Number(text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
const reveal = { ...motionTokens.spring.smooth, visualDuration: motionTokens.duration.considered };
const rotation = { up: -45, down: 45, flat: 0 };

/** New copy rises in while the old copy leaves; `morph` springs the wrapper to the new text's width instead of letting it snap. */
function Swap({ text, morph = false }: { text: string; morph?: boolean }) {
  const reduceMotion = !!useReducedMotion();
  const sizer = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const [shown, setShown] = useState({ text, direction: 1 });
  if (shown.text !== text) setShown({ text, direction: amountIn(text) < amountIn(shown.text) ? -1 : 1 });
  useEffect(() => {
    const node = sizer.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured: string | null = null;
    // Layout size, not the transformed rect, so a scaling parent never leaves the text clipped. Only a new text springs; font loads jump.
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth;
      if (next && measured !== null && measured !== node.textContent && !reduceMotion) animate(width, next, motionTokens.spring.morph);
      else width.jump(next || "auto");
      measured = next ? node.textContent : null;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [morph, reduceMotion, width]);
  return <motion.span className={styles.swap} style={morph ? { width } : undefined}>
    {morph && <span ref={sizer} className={styles.sizer} aria-hidden="true">{text}</span>}
    <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}><motion.span key={text} className={styles.text} custom={shown.direction} variants={reduceMotion ? fade : rise} initial="hidden" animate="shown" exit="gone">{text}</motion.span></AnimatePresence>
  </motion.span>;
}

/** Split "$4,200" or "18.6%" into a number that can count and the text around it. */
function parseValue(value: ReactNode) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(\D*)$/);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;
  return { prefix, suffix, amount: Number(raw.replace(/,/g, "")), format: new Intl.NumberFormat("en-US", { minimumFractionDigits: raw.split(".")[1]?.length ?? 0, maximumFractionDigits: raw.split(".")[1]?.length ?? 0, useGrouping: raw.includes(",") }) };
}

/** Counts up to the value the first time the card is seen, then springs between values. The final text reserves the width. */
function CountValue({ parsed, inView }: { parsed: NonNullable<ReturnType<typeof parseValue>>; inView: boolean }) {
  const reduceMotion = !!useReducedMotion();
  const { prefix, suffix, amount, format } = parsed;
  const count = useMotionValue(0);
  const revealed = useRef(false);
  const text = useTransform(count, current => `${prefix}${format.format(current)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) count.jump(amount);
    else animate(count, amount, revealed.current ? motionTokens.spring.smooth : reveal);
    revealed.current = true;
  }, [amount, count, inView, reduceMotion]);
  return <span className={styles.count}><span className={styles.reserve} aria-hidden="true">{prefix}{format.format(amount)}{suffix}</span><motion.span aria-hidden="true">{text}</motion.span></span>;
}

/** A compact metric surface for dashboards and overview pages. */
export function StatCard({ label, value, detail, change, changeLabel, trend = "flat", tone = "neutral", icon, className }: StatCardProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .5 });
  const reduceMotion = !!useReducedMotion();
  const parsed = parseValue(value);
  return <article ref={ref} className={[styles.card, className].filter(Boolean).join(" ")}>
    <div className={styles.header}>
      <span className={styles.label}><Swap text={label} /></span>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
    </div>
    <div className={styles.value} aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : label}`}>
      {parsed ? <CountValue parsed={parsed} inView={inView} /> : typeof value === "string" ? <Swap text={value} /> : value}
    </div>
    <div className={styles.footer}>
      {detail ? <span className={styles.detail}><Swap text={detail} /></span> : <span />}
      <AnimatePresence initial={false}>{change ? <motion.span key="change" className={[styles.change, styles[tone], styles[trend]].join(" ")} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96, transition: { duration: reduceMotion ? 0 : motionTokens.duration.fast } }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}><motion.span className={styles.trend} aria-hidden="true" initial={false} animate={{ rotate: rotation[trend] }} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}><ArrowRight size={12} strokeWidth={2.25} /></motion.span><Swap text={change} morph />{changeLabel ? <span className={styles.changeLabel}><Swap text={changeLabel} morph /></span> : null}</motion.span> : null}</AnimatePresence>
    </div>
  </article>;
}

export const KpiCard = StatCard;
export default StatCard;
