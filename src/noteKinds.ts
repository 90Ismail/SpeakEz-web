import type { Ionicons } from "@expo/vector-icons";

/**
 * The three places a recording can end up. One source for the names, copy and
 * glyphs so the record flow (06 Choose Place) and the Journal tab always say the same thing.
 */
export type NoteKind = "public" | "journal" | "draft";

type NoteKindInfo = {
  name: string;
  /** Section title on the Journal tab. */
  section: string;
  /** One line under the name in lists and section heads. */
  summary: string;
  /** Full sentence for the record flow, where the user is choosing. */
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const NOTE_KINDS: Record<NoteKind, NoteKindInfo> = {
  public: {
    name: "Public post",
    section: "Public posts",
    summary: "On the map · anonymous",
    description: "Leave it at a place on the map. Nobody can see who posted it.",
    icon: "radio-outline",
  },
  journal: {
    name: "Voice journal",
    section: "Voice journal",
    summary: "Private · only you",
    description: "Keep it for yourself. It never goes on the map.",
    icon: "lock-closed-outline",
  },
  draft: {
    name: "Draft",
    section: "Drafts",
    summary: "Not finished · only you",
    description: "Save it for now and decide later.",
    icon: "ellipse-outline",
  },
};

/** Display order everywhere: the public choice first, private ones after. */
export const NOTE_KIND_ORDER: NoteKind[] = ["public", "journal", "draft"];
