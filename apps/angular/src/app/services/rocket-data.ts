import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { map } from "rxjs";

import {
  ROCKET_CONFIGS,
  type RocketConfigsQuery,
  type RocketBasic,
} from "@orbitq/graphql";

@Injectable({ providedIn: "root" })
export class RocketDataService {
  constructor(private readonly apollo: Apollo) {}

  // ...
  getRocketConfigs() {
    return this.apollo
      .query<RocketConfigsQuery>({
        query: ROCKET_CONFIGS,
      })
      .pipe(map((result) => result?.data?.rocketConfigs ?? []));
  }
}
