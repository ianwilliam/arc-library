"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";
import { Activity, ArrowRight, BookOpen, Check, Copy, CornerDownLeft, House, LifeBuoy, LoaderCircle, Mail, RotateCw, Search } from "lucide-react";
import { motionTokens } from "@/lib/motion-tokens";
import styles from "./error-pages.module.css";

export type ErrorPageVariant = "404" | "500" | "maintenance";

export interface ErrorPageLink {
  label: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
}

export interface ErrorPageSearchItem {
  label: string;
  /** Where the page lives, shown at the end of the row. */
  group?: string;
  href?: string;
}

/**
 * Calm error states in one block: page not found with search and a way back, a server error with retry and a copyable
 * error id, and planned maintenance with a live countdown and a notify form. The Arc mark draws itself in and carries
 * one small, meaningful motion per state. Pass `variant` to pin a state, or leave it out to show a switcher.
 */
export interface ErrorPagesProps {
  variant?: ErrorPageVariant;
  defaultVariant?: ErrorPageVariant;
  onVariantChange?: (variant: ErrorPageVariant) => void;
  /** Shows the state switcher. Defaults to true when `variant` is not controlled. */
  switcher?: boolean;
  /** The path that was not found. */
  path?: string;
  searchItems?: ErrorPageSearchItem[];
  links?: Partial<Record<ErrorPageVariant, ErrorPageLink[]>>;
  onNavigate?: (destination: { label: string; href?: string }) => void;
  /** Resolves true when the retry succeeded. Defaults to a simulation that fails once, then recovers. */
  onRetry?: () => Promise<boolean>;
  errorId?: string;
  /** When maintenance ends, as a timestamp in ms. Defaults to 12 minutes after mount. */
  backAt?: number;
  /** Resolves when the address is saved; reject to show an error. */
  onNotify?: (email: string) => Promise<void>;
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = 2 * Math.PI / (visualDuration * 1.2);
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 };
};
const HEIGHT = physical(.46, 0), SLIDE = physical(.42, .08), PILL = physical(.32, .12);
const ORDER: ErrorPageVariant[] = ["404", "500", "maintenance"];
const NAMES: Record<ErrorPageVariant, string> = { "404": "Not found", "500": "Server error", maintenance: "Maintenance" };
const MAINTENANCE_MS = 12 * 60 * 1000;
const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const DEFAULT_SEARCH: ErrorPageSearchItem[] = [
  { label: "Billing", group: "Settings" },
  { label: "Team members", group: "Settings" },
  { label: "API keys", group: "Developers" },
  { label: "Webhooks", group: "Developers" },
  { label: "Integrations", group: "Workspace" },
  { label: "Changelog", group: "Resources" },
  { label: "Getting started", group: "Docs" },
  { label: "Status", group: "Resources" },
];
const DEFAULT_LINKS: Record<ErrorPageVariant, ErrorPageLink[]> = {
  "404": [
    { label: "Go home", description: "Your workspace overview", icon: <House {...icon} /> },
    { label: "Documentation", description: "Guides and API reference", icon: <BookOpen {...icon} /> },
    { label: "Contact support", description: "Replies in about 2 hours", icon: <LifeBuoy {...icon} /> },
  ],
  "500": [
    { label: "System status", description: "Live uptime for every service", icon: <Activity {...icon} /> },
    { label: "Contact support", description: "Include the error id below", icon: <LifeBuoy {...icon} /> },
  ],
  maintenance: [
    { label: "System status", description: "Follow the upgrade live", icon: <Activity {...icon} /> },
  ],
};

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/* The Arc mark. It draws in on every state change; each state adds one quiet detail. */
const OUTER = "M9 48V29C9 15 19 7 32 7s23 8 23 22v19", INNER = "M20 48V31c0-8 5-13 12-13s12 5 12 13v17", STEM = "M32 38v10";
function Mark({ variant, recovered, reduced }: { variant: ErrorPageVariant; recovered: boolean; reduced: boolean }) {
  const draw = (delay: number): Transition => reduced ? { duration: 0 } : { pathLength: { duration: .7, ease: enter, delay }, opacity: { duration: .2, delay } };
  // A server error leaves a gap in the outer arc that closes once a retry succeeds.
  const outerLength = variant === "500" && !recovered ? .82 : 1;
  return <span className={styles.mark} data-variant={variant} aria-hidden="true">
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
      <motion.path key={`outer-${variant}`} d={OUTER} initial={reduced ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: outerLength, opacity: 1 }}
        transition={recovered && !reduced ? { pathLength: physical(.6, 0), opacity: { duration: 0 } } : draw(.05)} />
      <motion.path key={`inner-${variant}`} d={INNER} initial={reduced ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={draw(.18)} />
      <motion.g className={variant === "404" && !reduced ? styles.drift : undefined}>
        <motion.path key={`stem-${variant}`} d={STEM} initial={reduced ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={draw(.34)} />
      </motion.g>
      {/* Maintenance: a short highlight travels along the outer arc, like work in progress. */}
      {variant === "maintenance" && !reduced && <path className={styles.sweep} d={OUTER} pathLength={100} />}
    </svg>
  </span>;
}

/** Follows its content's height exactly, and springs when `morphKey` changes, so switching states never jumps the page. */
function AutoHeight({ children, reduced, morphKey }: { children: ReactNode; reduced: boolean; morphKey: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const height = useMotionValue(0);
  const [measured, setMeasured] = useState(false);
  const morphing = useRef(false);
  const lastKey = useRef(morphKey);
  useLayoutEffect(() => {
    if (lastKey.current !== morphKey) { lastKey.current = morphKey; morphing.current = true; }
  }, [morphKey]);
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      if (morphing.current && !reduced) { morphing.current = false; animate(height, next, HEIGHT); return; }
      if (height.isAnimating()) { animate(height, next, HEIGHT); return; }
      height.jump(next);
      setMeasured(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, reduced]);
  return <motion.div className={styles.autoHeight} style={{ height: measured ? height : "auto" }}><div ref={inner} className={styles.autoInner}>{children}</div></motion.div>;
}

const faceVariants: Variants = {
  hidden: (dir: number) => ({ opacity: 0, x: dir * 28, filter: `blur(${motionTokens.blur.soft}px)` }),
  shown: { opacity: 1, x: 0, filter: "blur(0px)", transition: { x: SLIDE, opacity: { duration: .24, ease: enter, delay: .04 }, filter: { duration: .24, ease: enter, delay: .04 } } },
  gone: (dir: number) => ({ opacity: 0, x: dir * -20, filter: `blur(${motionTokens.blur.soft}px)`, transition: { x: SLIDE, opacity: { duration: .14, ease: standard }, filter: { duration: .14, ease: standard } } }),
};
const fadeVariants: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: .14 } }, gone: { opacity: 0, transition: { duration: .1 } } };

function Links({ links, onGo }: { links: ErrorPageLink[]; onGo: (link: ErrorPageLink) => void }) {
  return <ul className={styles.links}>
    {links.map(link => <li key={link.label}>
      {link.href
        ? <a className={styles.link} href={link.href} onClick={() => onGo(link)}><LinkBody link={link} /></a>
        : <button type="button" className={styles.link} onClick={() => onGo(link)}><LinkBody link={link} /></button>}
    </li>)}
  </ul>;
}
function LinkBody({ link }: { link: ErrorPageLink }) {
  return <>
    {link.icon && <span className={styles.linkIcon}>{link.icon}</span>}
    <span className={styles.linkText}><span className={styles.linkLabel}>{link.label}</span>{link.description && <span className={styles.linkDescription}>{link.description}</span>}</span>
    <ArrowRight className={styles.linkArrow} size={15} strokeWidth={1.75} aria-hidden="true" />
  </>;
}

function NotFound({ path, items, onGo }: { path: string; items: ErrorPageSearchItem[]; onGo: (destination: { label: string; href?: string }) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return items.filter(item => `${item.label} ${item.group ?? ""}`.toLowerCase().includes(needle)).slice(0, 4);
  }, [items, query]);
  const current = Math.min(active, Math.max(0, results.length - 1));
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) { event.preventDefault(); setActive((current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length); }
    if (event.key === "Enter" && results[current]) { event.preventDefault(); onGo(results[current]); }
    if (event.key === "Escape" && query) { event.preventDefault(); setQuery(""); }
  };
  return <>
    <p className={styles.lede}>The link may be out of date, or the page has moved. Search for it, or pick up from one of these.</p>
    <code className={styles.path}>{path}</code>
    <div className={styles.search}>
      <label className={styles.field}>
        <Search className={styles.fieldIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
        <input className={styles.input} type="search" placeholder="Search pages" value={query} autoComplete="off" spellCheck={false}
          role="combobox" aria-label="Search pages" aria-expanded={results.length > 0} aria-controls={`${uid}-results`} aria-autocomplete="list"
          aria-activedescendant={results.length ? `${uid}-result-${current}` : undefined}
          onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} />
      </label>
      <ul id={`${uid}-results`} role="listbox" aria-label="Pages" className={styles.results}>
        <AnimatePresence initial={false}>
          {results.map((item, index) => <motion.li key={item.label} id={`${uid}-result-${index}`} role="option" aria-selected={index === current} className={styles.result}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 40 }} exit={{ opacity: 0, height: 0 }} transition={{ height: HEIGHT, opacity: { duration: .16, ease: enter } }}
            onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => onGo(item)}>
            <span className={styles.resultLabel}>{item.label}</span>
            {item.group && <span className={styles.resultGroup}>{item.group}</span>}
            <CornerDownLeft className={styles.resultEnter} size={14} strokeWidth={1.75} aria-hidden="true" />
          </motion.li>)}
        </AnimatePresence>
      </ul>
      {query.trim() && !results.length && <p className={styles.hint} role="status">No pages match “{query.trim()}”.</p>}
    </div>
  </>;
}

type RetryState = "idle" | "retrying" | "failed" | "recovered";
const simulatedRetry = (() => {
  let attempts = 0;
  return () => new Promise<boolean>(resolve => window.setTimeout(() => resolve(++attempts % 2 === 0), 1100));
})();

function ServerError({ errorId, retry, onRetry, reduced }: { errorId: string; retry: RetryState; onRetry: () => void; reduced: boolean }) {
  const [copied, setCopied] = useState<"idle" | "done" | "error">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    window.clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(errorId); setCopied("done"); }
    catch { setCopied("error"); }
    timer.current = window.setTimeout(() => setCopied("idle"), 1600);
  };
  const label = { idle: "Try again", retrying: "Retrying", failed: "Try again", recovered: "Reload page" }[retry];
  const note = { idle: "Your work is saved. Nothing was lost.", retrying: "Checking the connection…", failed: "Still not loading. Our team has been notified.", recovered: "Service is back. Reload to continue." }[retry];
  const swap = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 6, filter: "blur(2px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -6, filter: "blur(2px)" } };
  return <>
    <p className={styles.lede}>We hit an error loading this page. It is on our side, and your data is safe.</p>
    <div className={styles.row}>
      <button type="button" className={styles.primary} data-state={retry} disabled={retry === "retrying"} onClick={onRetry}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={label} className={styles.primaryLabel} {...swap} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
            {retry === "retrying" ? <LoaderCircle className={styles.spin} {...icon} /> : retry === "recovered" ? <Check {...icon} /> : <RotateCw {...icon} />}{label}
          </motion.span>
        </AnimatePresence>
      </button>
      <div className={styles.errorId}>
        <span className={styles.errorIdLabel}>Error id</span>
        <code className={styles.errorIdValue}>{errorId}</code>
        <button type="button" className={styles.copy} aria-label={copied === "done" ? "Copied" : copied === "error" ? "Copy failed" : "Copy error id"} data-state={copied} onClick={copy}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={copied} className={styles.copyIcon} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .6 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
              {copied === "done" ? <Check size={14} strokeWidth={2} /> : copied === "error" ? <span className={styles.copyFail}>!</span> : <Copy size={14} strokeWidth={1.75} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </div>
    <p className={styles.status} data-state={retry} role="status">{note}</p>
  </>;
}

function Maintenance({ backAt, onNotify, reduced }: { backAt: number; onNotify: (email: string) => Promise<void>; reduced: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [now, setNow] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "invalid" | "error">("idle");
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = now === null ? MAINTENANCE_MS : Math.max(0, backAt - now);
  const minutes = Math.floor(left / 60000), seconds = Math.floor(left / 1000) % 60;
  const progress = 1 - left / MAINTENANCE_MS;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setState("invalid"); return; }
    setState("saving");
    try { await onNotify(email.trim()); setState("saved"); }
    catch { setState("error"); }
  };
  const message = { idle: "One email when we are back. Nothing else.", saving: "Saving…", saved: `We will email ${email.trim()} when we are back.`, invalid: "Enter a valid email address.", error: "Could not save that. Try again in a moment." }[state];
  return <>
    <p className={styles.lede}>We are upgrading the database so search is faster. Your work is saved and nothing needs doing on your end.</p>
    <div className={styles.eta}>
      <div className={styles.etaRow}>
        <span className={styles.etaLabel}>{left > 0 ? "Back in about" : "Finishing up"}</span>
        <span className={styles.etaValue} aria-live="off">{left > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : "0:00"}</span>
      </div>
      <div className={styles.track} role="progressbar" aria-label="Maintenance progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(.04, progress) * 100)}>
        <motion.span className={styles.fill} initial={false} animate={{ scaleX: Math.max(.04, Math.min(1, progress)) }} transition={reduced ? { duration: 0 } : { duration: 1, ease: "linear" }} />
      </div>
    </div>
    <form className={styles.notify} onSubmit={submit} noValidate>
      <label className={styles.field} data-invalid={state === "invalid" || undefined}>
        <Mail className={styles.fieldIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
        <input className={styles.input} type="email" placeholder="you@example.com" value={email} aria-label="Email address" aria-invalid={state === "invalid"} aria-describedby={`${uid}-notify`}
          disabled={state === "saved"} onChange={event => { setEmail(event.target.value); if (state === "invalid" || state === "error") setState("idle"); }} />
      </label>
      <button type="submit" className={styles.primary} data-state={state === "saved" ? "recovered" : undefined} disabled={state === "saving" || state === "saved"}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={state === "saved" ? "saved" : "idle"} className={styles.primaryLabel} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
            {state === "saved" ? <><Check {...icon} />Subscribed</> : "Notify me"}
          </motion.span>
        </AnimatePresence>
      </button>
    </form>
    <p id={`${uid}-notify`} className={styles.status} data-state={state === "invalid" || state === "error" ? "failed" : state === "saved" ? "recovered" : undefined} role="status">{message}</p>
  </>;
}

const HEADINGS: Record<ErrorPageVariant, string> = { "404": "Page not found", "500": "Something went wrong", maintenance: "Back shortly" };

export function ErrorPages({
  variant, defaultVariant = "404", onVariantChange, switcher, path = "/settings/billing-legacy", searchItems = DEFAULT_SEARCH, links,
  onNavigate, onRetry = simulatedRetry, errorId = "7F3A-92C1-E08B", backAt, onNotify = () => new Promise(resolve => window.setTimeout(resolve, 700)),
}: ErrorPagesProps) {
  const reduced = useReducedFlag();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [internal, setInternal] = useState<ErrorPageVariant>(defaultVariant);
  const current = variant ?? internal;
  const [direction, setDirection] = useState(0);
  const [retry, setRetry] = useState<RetryState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [end] = useState(() => backAt ?? Date.now() + MAINTENANCE_MS);
  const showSwitcher = switcher ?? variant === undefined;

  const choose = (next: ErrorPageVariant) => {
    if (next === current) return;
    setDirection(Math.sign(ORDER.indexOf(next) - ORDER.indexOf(current)));
    setNotice(null);
    if (next !== "500") setRetry("idle");
    if (variant === undefined) setInternal(next);
    onVariantChange?.(next);
  };

  const go = (destination: { label: string; href?: string }) => {
    onNavigate?.(destination);
    if (!destination.href) setNotice(`Opening ${destination.label} (demo)`);
  };

  const runRetry = async () => {
    if (retry === "recovered") { setRetry("idle"); setNotice("Page reloaded (demo)"); return; }
    setRetry("retrying");
    try { setRetry(await onRetry() ? "recovered" : "failed"); }
    catch { setRetry("failed"); }
  };

  const onTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = ORDER[(index + step + ORDER.length) % ORDER.length];
    choose(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return <section className={styles.root} aria-labelledby={`${uid}-heading`}>
    {showSwitcher && <div className={styles.switcher} role="tablist" aria-label="Error state">
      {ORDER.map((entry, index) => <button key={entry} id={`${uid}-tab-${entry}`} type="button" role="tab" aria-selected={entry === current} tabIndex={entry === current ? 0 : -1}
        className={styles.tab} onClick={() => choose(entry)} onKeyDown={event => onTabKey(event, index)}>
        {entry === current && <motion.span layoutId={`${uid}-pill`} className={styles.pill} transition={reduced ? { duration: 0 } : PILL} />}
        <span className={styles.tabLabel}>{NAMES[entry]}</span>
      </button>)}
    </div>}

    <div className={styles.stage}>
      <Mark variant={current} recovered={retry === "recovered"} reduced={reduced} />
      <AutoHeight reduced={reduced} morphKey={current}>
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div key={current} className={styles.face} custom={direction} variants={reduced ? fadeVariants : faceVariants} initial="hidden" animate="shown" exit="gone">
            <h2 id={`${uid}-heading`} className={styles.heading}>{HEADINGS[current]}</h2>
            {current === "404" && <NotFound path={path} items={searchItems} onGo={go} />}
            {current === "500" && <ServerError errorId={errorId} retry={retry} onRetry={runRetry} reduced={reduced} />}
            {current === "maintenance" && <Maintenance backAt={end} onNotify={onNotify} reduced={reduced} />}
            <Links links={links?.[current] ?? DEFAULT_LINKS[current]} onGo={go} />
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
      <p className={styles.notice} role="status">{notice}</p>
    </div>
  </section>;
}

export default ErrorPages;
