import { avatar, type PersonId } from "@/lib/media";

export const newsletterCopy = {
  inline: {
    title: "Get the monthly product letter",
    description: "What we shipped, what we learned, and one idea worth stealing. Five minutes, once a month.",
  },
  card: {
    title: "The Friday digest",
    description: "Three links on interface craft and one short essay, every Friday morning.",
  },
  privacy: "One email a month. Unsubscribe with one click.",
  privacyLink: { label: "Privacy policy", href: "#privacy" },
};

/** Readers shown in the card variant's social proof. */
export const newsletterReaders = {
  count: 12400,
  faces: (["jasmine-brooks", "daniel-kim", "ava-mitchell"] as PersonId[]).map(id => avatar(id)),
};
