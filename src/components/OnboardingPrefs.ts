export type LocationChoice = "granted" | "denied" | "skipped";

let locationChoice: LocationChoice | null = null;

export function setLocationChoice(choice: LocationChoice): void {
  locationChoice = choice;
}

export function getLocationChoice(): LocationChoice | null {
  return locationChoice;
}
