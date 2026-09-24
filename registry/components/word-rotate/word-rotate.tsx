"use client";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import styles from "./word-rotate.module.css";

/**
 * A sentence with one slot that cycles through words, such as "Build interfaces that feel precise". The next word rises in letter by letter while the slot's width follows
 * on a spring, so the rest of the line glides rather than jumps. Rotation pauses on hover and focus, offscreen, in a hidden tab, and while `paused` is set; with reduced motion
 * the first word stays. Assistive technology reads one stable sentence that lists every word. `prefix` is followed by a space and may contain `\n` for a deliberate
 * line break before the slot, which keeps the break stable as words change width; `suffix` gets a leading space unless it starts with punctuation.
 */
export interface WordRotateProps { words: string[]; /** Milliseconds each word stays in place. Defaults to 2600. */ interval?: number; as?: "span" | "p" | "h1" | "h2" | "h3"; className?: string; id?: string; prefix?: string; suffix?: string; paused?: boolean }

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const subscribeVisibility = (notify: () => void) => { document.addEventListener("visibilitychange", notify); return () => document.removeEventListener("visibilitychange", notify); };
const pageShown = () => document.visibilityState !== "hidden";
const enter = [...motionTokens.ease.enter] as [number, number, number, number];
const standard = [...motionTokens.ease.standard] as [number, number, number, number];
const inOut = [...motionTokens.ease.inOut] as [number, number, number, number];
/** Lets the leaving word clear most of the slot before the first new letter starts to rise. The leaving word fades a little faster than it travels, so the two words overlap only briefly, without a blank beat. */
const HANDOFF = .06;
const measure = (element: HTMLElement) => parseFloat(getComputedStyle(element).width);

export function WordRotate({ words, interval = 2600, as = "h2", className, id, prefix, suffix, paused = false }: WordRotateProps) {
  const Tag = as;
  const sentence = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const width = useRef(0);
  const sizing = useRef<AnimationPlaybackControls | null>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const shown = useSyncExternalStore(subscribeVisibility, pageShown, clientSnapshot);
  const prefersReduced = useReducedMotion();
  const reduced = hydrated && Boolean(prefersReduced);
  const inView = useInView(sentence, { amount: .5 });
  const count = words.length;
  const current = reduced || !count ? 0 : index % count;
  const word = words[current] ?? "";
  const running = hydrated && !reduced && !paused && !hovered && !focused && inView && shown && count > 1;
  const tail = suffix ? (/^[\s.,!?;:)\]]/.test(suffix) ? suffix : ` ${suffix}`) : "";
  const label = `${prefix ? `${prefix.replace(/\n/g, " ")} ` : ""}${words.join(", ")}${tail}`;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % count), interval);
    return () => window.clearTimeout(timer);
  }, [running, index, interval, count]);
  // The slot holds an explicit width; a new word springs it to the track's width so the rest of the line glides.
  useLayoutEffect(() => {
    const frameElement = frame.current, trackElement = track.current;
    if (!frameElement || !trackElement) return;
    const next = measure(trackElement);
    if (!Number.isFinite(next)) return;
    if (width.current && Math.abs(next - width.current) > .5 && !reduced) sizing.current = animate(frameElement, { width: next }, motionTokens.spring.morph);
    else { sizing.current?.stop(); frameElement.style.width = `${next}px`; }
    width.current = next;
  }, [word, reduced]);
  // Font loading and responsive type change the width without a new word: follow immediately.
  useEffect(() => {
    const frameElement = frame.current, trackElement = track.current;
    if (!frameElement || !trackElement || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = measure(trackElement);
      if (!Number.isFinite(next) || Math.abs(next - width.current) < .5) return;
      sizing.current?.stop(); frameElement.style.width = `${next}px`; width.current = next;
    });
    observer.observe(trackElement);
    return () => observer.disconnect();
  }, []);
  const leave = (event: FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); };

  return <Tag id={id} className={[styles.rotate, className].filter(Boolean).join(" ")} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={leave}>
    <span className={styles.srOnly}>{label}</span>
    <span ref={sentence} aria-hidden="true">{prefix ? <>{prefix.split("\n").map((part, partIndex) => <Fragment key={partIndex}>{partIndex ? <br /> : null}{part}</Fragment>)} </> : null}<span ref={frame} className={styles.frame}><span ref={track} className={styles.track}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={`${current}-${word}`} className={styles.word} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.45em", filter: `blur(${motionTokens.blur.soft}px)`, transition: { duration: motionTokens.duration.exit, ease: inOut, opacity: { duration: motionTokens.duration.fast, ease: standard } } }}>
          {Array.from(word).map((char, charIndex) => {
            const delay = HANDOFF + charIndex * motionTokens.stagger.char;
            return <motion.span key={charIndex} className={styles.char} initial={reduced ? false : { opacity: 0, y: "0.5em", filter: `blur(${motionTokens.blur.text}px)` }} animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }} transition={reduced ? { duration: 0 } : { y: { duration: .62, ease: enter, delay }, filter: { duration: .44, ease: enter, delay }, opacity: { duration: .3, ease: standard, delay } }}>{char === " " ? "\u00a0" : char}</motion.span>;
          })}
        </motion.span>
      </AnimatePresence>
    </span></span>{tail}</span>
  </Tag>;
}

export default WordRotate;
