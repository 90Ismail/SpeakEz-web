export type ReactionType = "heard_you" | "same" | "strength" | "helped";

export type Reaction = {
  type: ReactionType;
  label: string;
};

export const REACTIONS: Reaction[] = [
  { type: "heard_you", label: "You're not alone" },
  { type: "same", label: "I felt this too" },
  { type: "strength", label: "Sending warmth" },
  { type: "helped", label: "Rest tonight" },
];
