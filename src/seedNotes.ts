export type SeedNote = {
  id: string;
  title: string;
  landmarkId: string;
  durationSec: number;
  dayLabel: string;
  seeded: boolean;
  body: string[];
  heardByMany: boolean;
};

export const SEED_NOTES: SeedNote[] = [
  {
    id: "tired-at-walter",
    title: "I don't think anyone knows how tired I am",
    landmarkId: "walter-library",
    durationSec: 134,
    dayLabel: "this evening",
    seeded: true,
    heardByMany: true,
    body: [
      "I didn't really know where else to say this, so I'm saying it here — on the steps outside Walter, where I've basically lived for the last three weeks.",
      "Everyone keeps telling me I'm doing great. My advisor, my friends, my parents on the phone on Sundays. And I nod, and I say thanks, and then I come back here and sit with my laptop until the lights upstairs flicker off.",
      "It's not that anything terrible happened. It's more like everything is quietly asking for a little more than I have left.",
      "I think I just wanted one person to know. Not to fix it. Just to know that someone was sitting here tonight, tired, and still trying.",
      "If you're hearing this nearby — I hope your night is gentler than mine was.",
    ],
  },
  {
    id: "failing-first-semester",
    title: "I think I'm failing my first semester",
    landmarkId: "northrop-mall",
    durationSec: 98,
    dayLabel: "last night",
    seeded: true,
    heardByMany: false,
    body: [
      "I got my first exam back today and it was worse than I let anyone believe.",
      "I keep telling myself it's just one class, but it's the way everyone nods when I say it that gets to me.",
    ],
  },
  {
    id: "strangely-peaceful",
    title: "Tonight felt strangely peaceful",
    landmarkId: "the-knoll",
    durationSec: 76,
    dayLabel: "this evening",
    seeded: true,
    heardByMany: true,
    body: [
      "I walked up here after my shift and the whole hill was quiet.",
      "For once I wasn't thinking about everything due tomorrow. I just watched the lights come on across the river.",
    ],
  },
  {
    id: "roommate",
    title: "I don't know how to tell my roommate",
    landmarkId: "coffman-union",
    durationSec: 152,
    dayLabel: "yesterday",
    seeded: true,
    heardByMany: false,
    body: [
      "Something happened over winter break and I haven't told anyone here yet.",
      "She's my best friend. That's exactly why I can't figure out how to say it.",
    ],
  },
  {
    id: "nowhere-else",
    title: "I didn't know where else to say this",
    landmarkId: "wilson-library",
    durationSec: 111,
    dayLabel: "this evening",
    seeded: true,
    heardByMany: false,
    body: [
      "I come to the west bank to study because nobody looks for me here.",
      "Some things you can't put in a group chat. So here it is instead.",
    ],
  },
  {
    id: "cant-sleep",
    title: "I walk here when I can't sleep",
    landmarkId: "pillsbury-hall",
    durationSec: 87,
    dayLabel: "last night",
    seeded: true,
    heardByMany: true,
    body: [
      "It was 2 a.m. and the whole mall was empty.",
      "I walked past Pillsbury Hall three times before I realized I wasn't going back to bed.",
    ],
  },
  {
    id: "figured-out",
    title: "Everyone here seems to have it figured out",
    landmarkId: "carlson-school",
    durationSec: 124,
    dayLabel: "this afternoon",
    seeded: true,
    heardByMany: false,
    body: [
      "Group projects are the worst for this. Everyone has a plan and a spreadsheet and a fall internship already.",
      "I just keep nodding and hoping nobody notices I'm guessing.",
    ],
  },
  {
    id: "organic-chem",
    title: "My first A in organic chemistry",
    landmarkId: "blegen-hall",
    durationSec: 95,
    dayLabel: "this morning",
    seeded: true,
    heardByMany: false,
    body: [
      "I studied for this exam at every bus stop I've ever missed a bus at.",
      "It's one grade. But it's the first time this year I felt like I belong here.",
    ],
  },
];

export function seedNoteById(id: string): SeedNote | undefined {
  return SEED_NOTES.find((note) => note.id === id);
}
