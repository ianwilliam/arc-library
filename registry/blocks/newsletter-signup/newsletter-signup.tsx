"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { ArrowRight, Mail } from "lucide-react";
import SegmentedControl from "@/registry/components/segmented-control/segmented-control";
import { motionTokens } from "@/lib/motion-tokens";
import { newsletterCopy, newsletterReaders } from "./newsletter-signup-data";
import styles from "./newsletter-signup.module.css";

export type NewsletterVariant = "inline" | "card";

export interface NewsletterSignupProps {
  /** `inline` puts the copy beside the form in a page section; `card` is a self-contained card with reader faces. */
  variant?: NewsletterVariant;
  title?: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
  /** Short line under the form about frequency and privacy. */
  privacyNote?: ReactNode;
  /** Link after the privacy note. Pass null to hide it. */
  privacyLink?: { label: string; href: string } | null;
  /** Readers for the card variant's social proof. Pass null to hide it. */
  readers?: { count: number; faces: string[] } | null;
  /** Called with a valid, trimmed email. Reject to show an error; resolve to show the success state. */
  onSubscribe?: (email: string) => void | Promise<void>;
  className?: string;
}

type Phase = "idle" | "sending" | "done";
type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(value: string) {
  const email = value.trim();
  if (!email) return "Enter your email address";
  if (!EMAIL.test(email)) return "Enter an email like name@company.com";
  return null;
}

const swapIn = { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` };
const swapShown = { opacity: 1, y: 0, filter: "blur(0px)" };
const swapOut = { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: .14, ease: standard } };
const fadeIn = { opacity: 0 };
const fadeOut = { opacity: 0, transition: { duration: .1 } };

/** A line that swaps in place: the old text lifts away and the new one rises out of a soft blur. */
function Swap({ id, children, reduced, className, role, live }: { id: string; children: ReactNode; reduced: boolean; className?: string; role?: string; live?: "polite" }) {
  return <div className={className} role={role} aria-live={live}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={id} initial={reduced ? fadeIn : swapIn} animate={swapShown} exit={reduced ? fadeOut : swapOut} transition={{ duration: reduced ? .12 : .26, ease: enter }}>{children}</motion.div>
    </AnimatePresence>
  </div>;
}

/**
 * A newsletter signup whose email pill validates in place and, on success, morphs its button across the whole field
 * into a confirmation. Comes as an inline page section or a self-contained card.
 */
export const NewsletterSignup = forwardRef<HTMLElement, NewsletterSignupProps>(function NewsletterSignup({
  variant = "inline",
  title,
  description,
  placeholder = "you@company.com",
  buttonLabel = "Subscribe",
  privacyNote = newsletterCopy.privacy,
  privacyLink = newsletterCopy.privacyLink,
  readers = newsletterReaders,
  onSubscribe,
  className,
}, ref) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentTo, setSentTo] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const [pill, animatePill] = useAnimate<HTMLDivElement>();
  const copy = newsletterCopy[variant];

  useEffect(() => {
    if (phase === "idle" && refocus.current) { refocus.current = false; input.current?.focus(); }
    if (phase === "done") again.current?.focus();
  }, [phase]);

  function shake() {
    if (reduced || !pill.current) return;
    animatePill(pill.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: .38, ease: "easeOut" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (phase !== "idle") return;
    setTried(true);
    const found = validate(email);
    setError(found);
    if (found) { shake(); input.current?.focus(); return; }
    const value = email.trim();
    setPhase("sending");
    try {
      await (onSubscribe ? onSubscribe(value) : new Promise(resolve => setTimeout(resolve, 900)));
      setSentTo(value);
      setPhase("done");
    } catch {
      setPhase("idle");
      setError("We couldn't subscribe you. Check your connection and try again.");
      shake();
    }
  }

  function reset() {
    setEmail("");
    setError(null);
    setTried(false);
    refocus.current = true;
    setPhase("idle");
  }

  const done = phase === "done";
  const messageId = `${id}-message`;
  const morph = reduced ? { duration: 0 } : motionTokens.spring.morph;

  const form = <form className={styles.form} onSubmit={submit} noValidate aria-label={title ?? copy.title}>
    <motion.div ref={pill} className={styles.pill} data-invalid={error ? "" : undefined} data-done={done ? "" : undefined} style={{ borderRadius: 999 }}>
      <AnimatePresence initial={false} mode="popLayout">
        {!done && <motion.div key="field" className={styles.field} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: reduced ? "none" : `blur(${motionTokens.blur.subtle}px)`, transition: { duration: .14 } }}>
          <Mail className={styles.mailIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
          <label htmlFor={`${id}-email`} className={styles.srOnly}>Email address</label>
          <input
            ref={input}
            id={`${id}-email`}
            className={styles.input}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            placeholder={placeholder}
            value={email}
            readOnly={phase === "sending"}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            onChange={event => { setEmail(event.target.value); if (tried) setError(validate(event.target.value)); }}
          />
        </motion.div>}
      </AnimatePresence>
      <motion.button
        layout={!reduced}
        transition={morph}
        type={done ? "button" : "submit"}
        className={styles.submit}
        data-done={done ? "" : undefined}
        aria-busy={phase === "sending" || undefined}
        aria-disabled={done || undefined}
        tabIndex={done ? -1 : undefined}
        style={{ borderRadius: 999 }}
        whileTap={reduced || done ? undefined : { scale: .97 }}
      >
        <motion.span layout={reduced ? false : "position"} transition={morph} className={styles.submitInner}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={phase} className={styles.submitLabel} initial={reduced ? fadeIn : swapIn} animate={swapShown} exit={reduced ? fadeOut : swapOut} transition={{ duration: reduced ? .12 : .24, ease: enter }}>
              {phase === "idle" && <>{buttonLabel}<ArrowRight size={15} strokeWidth={2} aria-hidden="true" /></>}
              {phase === "sending" && <><span className={styles.spinner} aria-hidden="true" />Subscribing</>}
              {done && <><span className={styles.check} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .38, ease: enter, delay: .18 }} /></svg></span>You&rsquo;re subscribed</>}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </motion.button>
    </motion.div>
    <Swap id={error ? `error-${error}` : done ? "done" : "note"} reduced={reduced} className={styles.message} live="polite">
      <p id={messageId} className={styles.note} data-tone={error ? "error" : done ? "success" : undefined} role={error ? "alert" : undefined}>
        {error ?? (done
          ? <>Check {sentTo} for a confirmation link. <button ref={again} type="button" className={styles.textButton} onClick={reset}>Use a different email</button></>
          : <>{privacyNote}{privacyLink && <> <a className={styles.link} href={privacyLink.href}>{privacyLink.label}</a></>}</>)}
      </p>
    </Swap>
  </form>;

  if (variant === "card") {
    const count = readers ? new Intl.NumberFormat("en-US").format(readers.count) : "";
    return <section ref={ref} className={[styles.newsletter, className].filter(Boolean).join(" ")} data-variant="card" aria-labelledby={`${id}-title`}>
      <div className={styles.card}>
        {readers && <div className={styles.readers}>
          <span className={styles.faces} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {readers.faces.slice(0, 3).map(src => <img key={src} src={src} alt="" width={24} height={24} />)}
          </span>
          <Swap id={done ? "you" : "join"} reduced={reduced} className={styles.readerLine}>
            <span>{done ? `You and ${count} others` : `Join ${count} readers`}</span>
          </Swap>
        </div>}
        <h2 id={`${id}-title`} className={styles.cardTitle}>{title ?? copy.title}</h2>
        <p className={styles.description}>{description ?? copy.description}</p>
        {form}
      </div>
    </section>;
  }

  return <section ref={ref} className={[styles.newsletter, className].filter(Boolean).join(" ")} data-variant="inline" aria-labelledby={`${id}-title`}>
    <div className={styles.inline}>
      <div className={styles.intro}>
        <h2 id={`${id}-title`} className={styles.title}>{title ?? copy.title}</h2>
        <p className={styles.description}>{description ?? copy.description}</p>
      </div>
      {form}
    </div>
  </section>;
});

NewsletterSignup.displayName = "NewsletterSignup";

const variantOptions = [{ value: "inline", label: "Inline" }, { value: "card", label: "Card" }];

/** Preview: both layouts. Subscribing is simulated and nothing is sent. */
export function NewsletterSignupBlock() {
  const [variant, setVariant] = useState<NewsletterVariant>("inline");
  return <div className={styles.preview}>
    <SegmentedControl label="Newsletter layout" options={variantOptions} value={variant} onValueChange={next => setVariant(next as NewsletterVariant)} />
    <div className={styles.frame}>
      <NewsletterSignup key={variant} variant={variant} />
    </div>
  </div>;
}

export default NewsletterSignupBlock;
