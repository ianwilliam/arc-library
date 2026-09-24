"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import styles from "./segmented-control.module.css";

export interface Segment { value: string; label: string; }
export interface SegmentedControlProps { options: Segment[]; value: string; onValueChange: (value: string) => void; label?: string; }

export default function SegmentedControl({ options, value, onValueChange, label }: SegmentedControlProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);

  // When the options are wider than the container, the track scrolls inside itself. Edges fade only on the side with more to see.
  useLayoutEffect(() => {
    const node = track.current;
    if (!node) return;
    const edges = () => {
      const rest = node.scrollWidth - node.clientWidth - node.scrollLeft;
      node.toggleAttribute("data-fade-start", node.scrollLeft > 1);
      node.toggleAttribute("data-fade-end", rest > 1);
    };
    edges();
    node.addEventListener("scroll", edges, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(edges);
    observer?.observe(node);
    return () => { node.removeEventListener("scroll", edges); observer?.disconnect(); };
  }, [options.length]);

  // The selected option is always scrolled fully into view, with a little room so it clears the fade.
  const first = useRef(true);
  useEffect(() => {
    const node = track.current;
    const button = node?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!node || !button || node.scrollWidth <= node.clientWidth) { first.current = false; return; }
    const room = 20, start = button.offsetLeft - room, end = button.offsetLeft + button.offsetWidth + room - node.clientWidth;
    const left = node.scrollLeft > start ? start : node.scrollLeft < end ? end : node.scrollLeft;
    if (left !== node.scrollLeft) node.scrollTo({ left: Math.max(0, left), behavior: first.current || reduced ? "auto" : "smooth" });
    first.current = false;
  }, [value, reduced]);

  return <div className={styles.root} role="group" aria-label={label}>
    <LayoutGroup id={id}><motion.div ref={track} layoutScroll className={styles.track}>
      {options.map(option => <button key={option.value} id={`${id}-${option.value}`} className={styles.button} type="button" aria-pressed={value === option.value} onClick={() => onValueChange(option.value)}>
        {value === option.value && <motion.span className={styles.selection} layoutId="selection" layoutDependency={value} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
        <span className={styles.label}>{option.label}</span>
      </button>)}
    </motion.div></LayoutGroup>
  </div>;
}
