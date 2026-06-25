import type { RocketBasic, RocketConfig } from "@orbitq/graphql";
import {
  findSelectedRocketData,
  isRocketFetching,
  pickDefaultRocketA,
  toRocketIds,
} from "./rocket-data-utils";

function rocketBasic(id: number, fullName = `Rocket ${id}`): RocketBasic {
  return {
    id,
    fullName,
    manufacturer: { name: "OrbitQ" },
  };
}

function rocketConfig(id: number, fullName = `Rocket ${id}`): RocketConfig {
  return {
    id,
    name: fullName,
    fullName,
    variant: null,
    status: "ACTIVE",
    description: null,
    imageUrl: null,
    manufacturer: { name: "OrbitQ", abbrev: "OQ", countryCode: "GB" },
    families: [],
    length: null,
    diameter: null,
    launchMass: null,
    toThrust: null,
    leoCapacity: null,
    gtoCapacity: null,
    ssoCapacity: null,
    reusable: false,
    maidenFlight: null,
    launchCost: null,
    totalLaunchCount: 0,
    successfulLaunches: 0,
    failedLaunches: 0,
    consecutiveSuccessfulLaunches: 0,
    landingStats: null,
  };
}

describe("rocket data helpers", () => {
  it("picks Starship V2 as the default Rocket A once it is loaded", () => {
    const rockets = [rocketBasic(205), rocketBasic(527, "Starship V2")];

    expect(pickDefaultRocketA(rockets, null)).toBe(rockets[1]);
  });

  it("keeps an existing Rocket A selection", () => {
    const selectedRocket = rocketBasic(205);
    const rockets = [rocketBasic(527, "Starship V2"), selectedRocket];

    expect(pickDefaultRocketA(rockets, selectedRocket)).toBe(selectedRocket);
  });

  it("returns null when the default Rocket A has not loaded", () => {
    expect(pickDefaultRocketA([rocketBasic(205)], null)).toBeNull();
  });

  it("normalizes selected string IDs into sorted query IDs", () => {
    expect(toRocketIds(["527", "205"])).toEqual([205, 527]);
    expect(toRocketIds([null, "527"])).toEqual([527]);
    expect(toRocketIds(["not-a-number", "128"])).toEqual([128]);
  });

  it("maps fetched detail records back to the selected rocket by ID", () => {
    const rocketA = rocketBasic(527);
    const rocketB = rocketBasic(205);
    const details = [rocketConfig(205), rocketConfig(527)];

    expect(findSelectedRocketData(rocketA, details)).toBe(details[1]);
    expect(findSelectedRocketData(rocketB, details)).toBe(details[0]);
    expect(findSelectedRocketData(null, details)).toBeNull();
  });

  it("reports fetching only while a selected slot lacks matching detail data", () => {
    const selectedRocket = rocketBasic(527);
    const selectedRocketData = rocketConfig(527);

    expect(isRocketFetching(selectedRocket, null)).toBe(true);
    expect(isRocketFetching(selectedRocket, selectedRocketData)).toBe(false);
    expect(isRocketFetching(null, null)).toBe(false);
  });
});
