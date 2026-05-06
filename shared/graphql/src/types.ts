export type LauncherStatus = 'ACTIVE' | 'RETIRED' | 'IN_DEVELOPMENT' | 'UNKNOWN';

export type Agency = {
  name: string;
  abbrev: string;
  countryCode: string;
};

export type LauncherFamily = {
  name: string;
};

export type LandingStats = {
  attempted: number;
  successful: number;
  failed: number;
  consecutiveSuccessful: number;
};

export type RocketConfig = {
  id: number;
  name: string;
  fullName: string;
  variant: string | null;
  status: LauncherStatus;
  description: string | null;
  imageUrl: string | null;
  manufacturer: Agency | null;
  families: LauncherFamily[];
  length: number | null;
  diameter: number | null;
  launchMass: number | null;
  toThrust: number | null;
  leoCapacity: number | null;
  gtoCapacity: number | null;
  ssoCapacity: number | null;
  reusable: boolean;
  maidenFlight: string | null;
  launchCost: number | null;
  totalLaunchCount: number;
  successfulLaunches: number;
  failedLaunches: number;
  consecutiveSuccessfulLaunches: number;
  landingStats: LandingStats | null;
};

export type RocketConfigsByIdsQuery = {
  rocketConfigsByIds: RocketConfig[];
};

export type RocketConfigsByIdsVariables = {
  ids: number[];
};
