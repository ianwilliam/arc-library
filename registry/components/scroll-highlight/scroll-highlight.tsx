"use client";
import { Fragment, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { MotionValue, UseScrollOptions } from "motion/react";
import styles from "./scroll-highlight.module.css";
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Opacity of words the reader has not reached yet, and how many words the soft reading edge spans. */
const unread = .2;
const edge = 5;
const defaultOffset: UseScrollOptions["offset"] = ["start 0.9", "end 0.55"];

function Word({ progress, range, reduced, children }: { progress: MotionValue<number>; range: [number, number]; reduced: boolean; children: string }) {
  const opacity = useTransform(progress, range, [unread, 1]);
  return <motion.span className={styles.word} style={reduced ? undefined : { opacity }}>{children}</motion.span>;
}

/**
 * A reading reveal for a key paragraph or statement: words brighten from dim to full as the text scrolls through the viewport.
 * Use it once or twice per page for copy worth slowing down for, not for body text. Screen readers get the full text once.
 * Pass `container` when the text scrolls inside an element instead of the page; that element needs a non static position.
 */
export interface ScrollHighlightProps {
  text: string;
  as?: "p" | "h2" | "h3";
  className?: string;
  id?: string;
  /** The scrolling element, when it is not the page. */
  container?: RefObject<HTMLElement | null>;
  /** Where the reveal starts and ends, as Motion scroll offsets. Defaults to ["start 0.9", "end 0.55"]. */
  offset?: UseScrollOptions["offset"];
}
export function ScrollHighlight({ text, as = "p", className, id, container, offset = defaultOffset }: ScrollHighlightProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReduced = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const reduced = Boolean(hydrated && prefersReduced);
  const { scrollYProgress } = useScroll({ target: ref, container, offset });
  const words = text.trim().split(/\s+/);
  // Each word brightens across a window a few words wide, so the reading edge is a soft gradient rather than a hard line.
  const span = words.length > 1 ? Math.min(.5, edge / words.length) : 1;
  const step = words.length > 1 ? (1 - span) / (words.length - 1) : 0;
  const Tag = as;
  return <Tag id={id} className={[styles.highlight, className].filter(Boolean).join(" ")}>
    <span className={styles.srOnly}>{text}</span>
    <span ref={ref} className={styles.words} aria-hidden="true">
      {words.map((word, index) => <Fragment key={index}><Word progress={scrollYProgress} range={[index * step, index * step + span]} reduced={reduced}>{word}</Word>{index < words.length - 1 ? " " : null}</Fragment>)}
    </span>
  </Tag>;
}

export default ScrollHighlight;
