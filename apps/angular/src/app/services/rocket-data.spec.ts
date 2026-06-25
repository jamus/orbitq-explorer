import { TestBed } from "@angular/core/testing";
import { Apollo } from "apollo-angular";
import { Subject } from "rxjs";

import type { RocketConfig, RocketConfigsByIdsQuery } from "@orbitq/graphql";
import { ROCKET_CONFIGS_BY_IDS } from "@orbitq/graphql";
import { RocketDataService } from "./rocket-data";

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

function queryResult(rockets: RocketConfig[]) {
  return {
    data: {
      rocketConfigsByIds: rockets,
    } satisfies RocketConfigsByIdsQuery,
  };
}

describe("RocketDataService", () => {
  let query: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    query = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        RocketDataService,
        {
          provide: Apollo,
          useValue: { query },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("queries selected rockets with sorted numeric IDs", () => {
    const response = new Subject<ReturnType<typeof queryResult>>();
    query.mockReturnValue(response.asObservable());
    const service = TestBed.inject(RocketDataService);

    service.setSelectedRockets("527", "205");

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({
      query: ROCKET_CONFIGS_BY_IDS,
      variables: { ids: [205, 527] },
    });
  });

  it("does not refetch for equivalent reversed selections", () => {
    const response = new Subject<ReturnType<typeof queryResult>>();
    query.mockReturnValue(response.asObservable());
    const service = TestBed.inject(RocketDataService);

    service.setSelectedRockets("527", "205");
    service.setSelectedRockets("205", "527");

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("resets state and avoids a query when both selections are cleared", () => {
    const response = new Subject<ReturnType<typeof queryResult>>();
    query.mockReturnValue(response.asObservable());
    const service = TestBed.inject(RocketDataService);

    service.setSelectedRockets("527", null);
    response.next(queryResult([rocketConfig(527)]));
    expect(service.rockets()).toEqual([rocketConfig(527)]);

    service.setSelectedRockets(null, null);

    expect(service.rockets()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("ignores stale responses after a newer selection starts", () => {
    const staleResponse = new Subject<ReturnType<typeof queryResult>>();
    const latestResponse = new Subject<ReturnType<typeof queryResult>>();
    query
      .mockReturnValueOnce(staleResponse.asObservable())
      .mockReturnValueOnce(latestResponse.asObservable());
    const service = TestBed.inject(RocketDataService);

    service.setSelectedRockets("527", null);
    service.setSelectedRockets("205", null);

    staleResponse.next(queryResult([rocketConfig(527)]));
    expect(service.rockets()).toEqual([]);

    const latestRocket = rocketConfig(205);
    latestResponse.next(queryResult([latestRocket]));

    expect(service.rockets()).toEqual([latestRocket]);
  });
});
