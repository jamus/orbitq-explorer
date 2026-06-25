import type { RocketBasic, RocketConfig } from "@orbitq/graphql";

export type RocketSelection = [string | null, string | null];

export const DEFAULT_ROCKET_ID = 527;

export function toRocketIds(selection: RocketSelection): number[] {
  return selection
    .filter((id): id is string => id !== null)
    .map(Number)
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}

export function haveSameIds(previous: number[], current: number[]): boolean {
  return (
    previous.length === current.length &&
    previous.every((id, index) => id === current[index])
  );
}

export function pickDefaultRocketA(
  rockets: RocketBasic[],
  currentRocketA: RocketBasic | null,
): RocketBasic | null {
  if (currentRocketA !== null) return currentRocketA;
  return rockets.find((rocket) => rocket.id === DEFAULT_ROCKET_ID) ?? null;
}

export function findSelectedRocketData(
  selectedRocket: RocketBasic | null,
  rockets: RocketConfig[],
): RocketConfig | null {
  if (selectedRocket === null) return null;
  return rockets.find((rocket) => rocket.id === selectedRocket.id) ?? null;
}

export function isRocketFetching(
  selectedRocket: RocketBasic | null,
  selectedRocketData: RocketConfig | null,
): boolean {
  return selectedRocket !== null && selectedRocketData === null;
}
