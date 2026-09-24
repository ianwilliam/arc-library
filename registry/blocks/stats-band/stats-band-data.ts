export interface Stat {
  /** The final number. The band counts up to it. */
  value: number;
  /** Text before the number, such as "$". */
  prefix?: string;
  /** Text after the number, such as "%", "ms", or "+". */
  suffix?: string;
  /** Digits after the decimal point. Defaults to 0. */
  decimals?: number;
  label: string;
  /** One short supporting line under the label. */
  detail?: string;
}

export const stats: Stat[] = [
  { value: 12400, suffix: "+", label: "Teams shipping every week", detail: "From two person studios to public companies" },
  { value: 99.99, decimals: 2, suffix: "%", label: "Uptime over the last year", detail: "Across every region we run in" },
  { value: 38, suffix: "ms", label: "Median response time", detail: "Measured at the edge, worldwide" },
  { value: 4.9, decimals: 1, suffix: "/5", label: "Average rating", detail: "From 2,100 verified reviews" },
];
