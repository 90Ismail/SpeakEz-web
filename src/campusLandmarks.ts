import type { LatLng } from "./geo";

export type Bank = "east" | "west";
export type LandmarkCategory = "building" | "landmark" | "green" | "walk" | "bridge";

export type CampusLandmark = {
  id: string;
  name: string;
  coordinate: LatLng;
  bank: Bank;
  category: LandmarkCategory;
};

export const CAMPUS_LANDMARKS: CampusLandmark[] = [
  { id: "walter-library", name: "Walter Library", coordinate: { latitude: 44.97536, longitude: -93.2363 }, bank: "east", category: "building" },
  { id: "northrop-mall", name: "Northrop Mall", coordinate: { latitude: 44.97479, longitude: -93.23531 }, bank: "east", category: "landmark" },
  { id: "coffman-union", name: "Coffman Union", coordinate: { latitude: 44.97282, longitude: -93.23535 }, bank: "east", category: "building" },
  { id: "pillsbury-hall", name: "Pillsbury Hall", coordinate: { latitude: 44.9769, longitude: -93.23444 }, bank: "east", category: "building" },
  { id: "the-knoll", name: "The Knoll", coordinate: { latitude: 44.97862, longitude: -93.2365 }, bank: "east", category: "green" },
  { id: "superblock", name: "Superblock", coordinate: { latitude: 44.9749, longitude: -93.2325 }, bank: "east", category: "landmark" },
  { id: "scholars-walk", name: "Scholars Walk", coordinate: { latitude: 44.97437, longitude: -93.23694 }, bank: "east", category: "walk" },
  { id: "washington-ave-bridge", name: "Washington Ave Bridge", coordinate: { latitude: 44.97306, longitude: -93.23991 }, bank: "east", category: "bridge" },
  { id: "wilson-library", name: "Wilson Library", coordinate: { latitude: 44.97095, longitude: -93.24359 }, bank: "west", category: "building" },
  { id: "carlson-school", name: "Carlson School", coordinate: { latitude: 44.97046, longitude: -93.24477 }, bank: "west", category: "building" },
  { id: "rarig-center", name: "Rarig Center", coordinate: { latitude: 44.97046, longitude: -93.24246 }, bank: "west", category: "building" },
  { id: "blegen-hall", name: "Blegen Hall", coordinate: { latitude: 44.97184, longitude: -93.24334 }, bank: "west", category: "building" },
];

export function landmarkById(id: string): CampusLandmark | undefined {
  return CAMPUS_LANDMARKS.find((landmark) => landmark.id === id);
}
