import { gql } from '@apollo/client';

// Used by the canvas — fetch the two selected rockets in full
export const ROCKET_CONFIGS_BY_IDS = gql`
  query RocketConfigsByIds($ids: [Int!]!) {
    rocketConfigsByIds(ids: $ids) {
      id
      name
      fullName
      variant
      status
      description
      imageUrl
      manufacturer { name abbrev countryCode }
      families { name }
      length
      diameter
      launchMass
      toThrust
      leoCapacity
      gtoCapacity
      ssoCapacity
      reusable
      maidenFlight
      launchCost
      totalLaunchCount
      successfulLaunches
      failedLaunches
      consecutiveSuccessfulLaunches
      landingStats { attempted successful failed consecutiveSuccessful }
    }
  }
`;
