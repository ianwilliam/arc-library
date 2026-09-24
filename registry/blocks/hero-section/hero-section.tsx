"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, Share } from "lucide-react";
import { AnimatedCounter } from "@/registry/components/animated-counter/animated-counter";
import { Avatar } from "@/registry/components/avatar/avatar";
import { Button } from "@/registry/components/button/button";
import { CopyButton } from "@/registry/components/copy-button/copy-button";
import SegmentedControl from "@/registry/components/segmented-control/segmented-control";
import { Switch } from "@/registry/components/switch/switch";
import { motionTokens } from "@/lib/motion-tokens";
import { person, photo } from "@/lib/media";
import styles from "./hero-section.module.css";

export type HeroSectionVariant = "centered" | "split" | "minimal";

export interface HeroAction {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Opens in a new tab and shows an outward arrow. */
  external?: boolean;
}

export interface HeroInstallCommand {
  /** Short tab label, such as npm or pnpm. */
  label: string;
  command: string;
}

export interface HeroSectionProps {
  /** `centered` with an install command, `split` beside a product visual, or `minimal` text only. */
  variant?: HeroSectionVariant;
  /** A short link above the title for a real announcement. Pass null to hide it. */
  announcement?: HeroAction | null;
  title?: string;
  /** A phrase inside `title` drawn in the brand ink gradient. */
  highlight?: string;
  description?: string;
  primaryAction?: HeroAction | null;
  secondaryAction?: HeroAction | null;
  /** Package manager commands for the centered variant. Pass null to hide the command. */
  install?: HeroInstallCommand[] | null;
  /** Initial install tab when uncontrolled. */
  defaultInstall?: string;
  /** Selected install tab (controlled). */
  installValue?: string;
  onInstallChange?: (label: string) => void;
  /** The visual for the split variant. Defaults to a live Arc composition. */
  media?: ReactNode;
  /** Small facts under the minimal variant, such as the version and license. */
  meta?: string[];
  /** Plays the entrance once on mount. Defaults to true. */
  animateIn?: boolean;
  className?: string;
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;

const exampleInstall: HeroInstallCommand[] = [
  { label: "npm", command: "npx shadcn@latest add @uiarc/hero-section" },
  { label: "pnpm", command: "pnpm dlx shadcn@latest add @uiarc/hero-section" },
  { label: "bun", command: "bunx --bun shadcn@latest add @uiarc/hero-section" },
];

/** Children rise out of a soft blur, one after another, once. */
const group: Variants = { hidden: {}, shown: { transition: { staggerChildren: .07, delayChildren: .04 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: `blur(${motionTokens.blur.soft}px)` },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: .7, ease: enter } },
};
const fade: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: .3 } } };

function ActionLink({ action, kind }: { action: HeroAction; kind: "primary" | "secondary" | "text" }) {
  const cls = `${styles.action} ${styles[kind]}`;
  const icon = action.external ? <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" /> : kind === "text" || kind === "primary" ? <ArrowRight className={styles.arrow} size={16} strokeWidth={1.75} aria-hidden="true" /> : null;
  if (action.href) return <a className={cls} href={action.href} onClick={action.onClick} {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{action.label}{icon}</a>;
  return <button type="button" className={cls} onClick={action.onClick}>{action.label}{icon}</button>;
}

function Title({ title, highlight, id }: { title: string; highlight?: string; id: string }) {
  const at = highlight ? title.indexOf(highlight) : -1;
  if (!highlight || at < 0) return <h1 id={id} className={styles.title}>{title}</h1>;
  return <h1 id={id} className={styles.title}>{title.slice(0, at)}<span className={styles.highlight}>{highlight}</span>{title.slice(at + highlight.length)}</h1>;
}

/** A terminal line with a gliding package manager switch and a copy button whose width never changes. */
function InstallCommand({ commands, value, onChange, reduced }: { commands: HeroInstallCommand[]; value: string; onChange: (label: string) => void; reduced: boolean }) {
  const id = useId();
  const active = commands.find(item => item.label === value) ?? commands[0];
  return <div className={styles.install}>
    <LayoutGroup id={id}>
      <div className={styles.installTabs} role="group" aria-label="Package manager">
        {commands.map(item => <button key={item.label} type="button" className={styles.installTab} aria-pressed={item.label === active.label} onClick={() => onChange(item.label)}>
          {item.label === active.label && <motion.span layoutId="tab" className={styles.installHighlight} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
          <span>{item.label}</span>
        </button>)}
      </div>
    </LayoutGroup>
    <div className={styles.installLine}>
      <span className={styles.prompt} aria-hidden="true">$</span>
      <span className={styles.commandSlot}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.code key={active.label} className={styles.command}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: .12 } }}
            transition={reduced ? { duration: 0 } : { y: motionTokens.spring.snappy, opacity: { duration: .18 }, filter: { duration: .18 } }}>
            {active.command}
          </motion.code>
        </AnimatePresence>
      </span>
      <CopyButton value={active.command} label="Copy install command" iconOnly variant="plain" className={styles.copy} />
    </div>
  </div>;
}

const periods = [{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }];
const focusHours: Record<string, number> = { week: 18.5, month: 74, year: 812 };
const emma = person("emma-collins");
const office = photo("home-office");

/** The default split visual: a photo with a live card built from Arc components, so every control in it works. */
export function HeroShowcase() {
  const [available, setAvailable] = useState(true);
  const [period, setPeriod] = useState("week");
  const [shared, setShared] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <div className={styles.showcase}>
    <div className={styles.showcasePhoto}><Image src={office.src} alt={office.alt} fill sizes="(max-width: 760px) 100vw, 560px" priority={false} /></div>
    <div className={styles.showcaseCard}>
      <div className={styles.cardHead}>
        <Avatar name={emma.name} src={emma.src} size="md" status={available ? "online" : "offline"} />
        <div className={styles.cardWho}><span>{emma.name}</span><span>{available ? "Available for reviews" : "Heads down"}</span></div>
        <Switch aria-label="Available for reviews" checked={available} onCheckedChange={setAvailable} />
      </div>
      <SegmentedControl label="Period" options={periods} value={period} onValueChange={setPeriod} />
      <div className={styles.cardStat}>
        <AnimatedCounter value={focusHours[period]} decimals={period === "week" ? 1 : 0} suffix=" h" />
        <span>Focus time this {period}</span>
      </div>
      <Button variant="secondary" size="sm" onClick={() => { setShared(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setShared(false), 1800); }}>
        {shared ? <><Check size={15} strokeWidth={2.25} aria-hidden="true" />Report shared</> : <><Share size={15} strokeWidth={1.75} aria-hidden="true" />Share report</>}
      </Button>
    </div>
  </div>;
}

/**
 * A landing page hero in three layouts. Content rises in once, in reading order; the centered layout carries an install
 * command with a gliding package manager switch, the split layout sits beside a live product visual, and the minimal one
 * is type alone.
 */
export const HeroSection = forwardRef<HTMLElement, HeroSectionProps>(function HeroSection({
  variant = "centered",
  announcement = { label: "Site blocks are here: headers, footers, and heroes" },
  title = "Interfaces that move with intent",
  highlight = "move with intent",
  description = "Arc is a library of React components and blocks with motion that explains every change. Copy the source, keep full control.",
  primaryAction = { label: "Get started" },
  secondaryAction = { label: "Browse components" },
  install = exampleInstall,
  defaultInstall,
  installValue,
  onInstallChange,
  media,
  meta = ["Version 2.4", "140 components", "Light and dark"],
  animateIn = true,
  className,
}, ref) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const [innerInstall, setInnerInstall] = useState(defaultInstall ?? install?.[0]?.label ?? "");
  const currentInstall = installValue ?? innerInstall;
  const item = reduced ? fade : rise;
  const setInstall = (label: string) => { if (installValue === undefined) setInnerInstall(label); onInstallChange?.(label); };

  const announcementNode = announcement && <motion.div variants={item} className={styles.announcementRow}>
    {announcement.href
      ? <a className={styles.announcement} href={announcement.href} onClick={announcement.onClick}>{announcement.label}<ArrowRight className={styles.arrow} size={14} strokeWidth={2} aria-hidden="true" /></a>
      : <button type="button" className={styles.announcement} onClick={announcement.onClick}>{announcement.label}<ArrowRight className={styles.arrow} size={14} strokeWidth={2} aria-hidden="true" /></button>}
  </motion.div>;
  const actions = (primaryAction || secondaryAction) && <motion.div variants={item} className={styles.actions}>
    {primaryAction && <ActionLink action={primaryAction} kind={variant === "minimal" ? "text" : "primary"} />}
    {secondaryAction && <ActionLink action={secondaryAction} kind={variant === "minimal" ? "text" : "secondary"} />}
  </motion.div>;

  return <section ref={ref} className={[styles.hero, styles[variant], className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}><div className={styles.inner}>
    <motion.div className={styles.copy} variants={group} initial={animateIn ? "hidden" : false} animate="shown">
      {variant !== "minimal" && announcementNode}
      <motion.div variants={item}><Title id={`${id}-title`} title={title} highlight={variant === "minimal" ? undefined : highlight} /></motion.div>
      {description && <motion.p variants={item} className={styles.description}>{description}</motion.p>}
      {actions}
      {variant === "centered" && install && install.length > 0 && <motion.div variants={item} className={styles.installWrap}>
        <InstallCommand commands={install} value={currentInstall} onChange={setInstall} reduced={reduced} />
      </motion.div>}
      {variant === "minimal" && meta.length > 0 && <motion.ul variants={item} className={styles.meta}>{meta.map(entry => <li key={entry}>{entry}</li>)}</motion.ul>}
    </motion.div>
    {variant === "split" && <motion.div className={styles.media}
      initial={animateIn ? (reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: .985 }) : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: .3 } : { duration: .9, ease: enter, delay: .18 }}>
      {media ?? <HeroShowcase />}
    </motion.div>}
  </div></section>;
});

HeroSection.displayName = "HeroSection";

const variantOptions = [{ value: "centered", label: "Centered" }, { value: "split", label: "Split" }, { value: "minimal", label: "Minimal" }];

/** Preview: the hero with a switch between its layouts. Switching replays the entrance. */
export function HeroSectionBlock({ variant: initial = "centered" }: { variant?: HeroSectionVariant }) {
  const [variant, setVariant] = useState<HeroSectionVariant>(initial);
  const [last, setLast] = useState<string | null>(null);
  const report = (label: string) => () => setLast(label);
  return <div className={styles.preview}>
    <SegmentedControl label="Hero layout" options={variantOptions} value={variant} onValueChange={value => setVariant(value as HeroSectionVariant)} />
    <div className={styles.frame}>
      <HeroSection
        key={variant}
        variant={variant}
        announcement={{ label: "Site blocks are here: headers, footers, and heroes", onClick: report("the announcement") }}
        primaryAction={{ label: variant === "minimal" ? "Read the docs" : "Get started", onClick: report(variant === "minimal" ? "Read the docs" : "Get started") }}
        secondaryAction={variant === "minimal" ? { label: "View on GitHub", external: true, onClick: report("View on GitHub") } : { label: "Browse components", onClick: report("Browse components") }}
      />
    </div>
    <p className={styles.srOnly} aria-live="polite">{last ? `Opened ${last}` : ""}</p>
  </div>;
}

export default HeroSectionBlock;
