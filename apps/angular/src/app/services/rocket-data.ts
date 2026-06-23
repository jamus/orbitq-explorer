import { inject, Injectable, signal } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { finalize, map } from "rxjs";

import {
  ROCKET_CONFIGS_BY_IDS,
  type RocketConfig,
  type RocketConfigsByIdsQuery,
  type RocketConfigsByIdsVariables,
} from "@orbitq/graphql";

@Injectable({ providedIn: "root" })
export class RocketDataService {
  private readonly apollo = inject(Apollo);

  private readonly rocketData = signal<RocketConfig[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal(false);

  // expose the signals as readonly to prevent external modification
  readonly rockets = this.rocketData.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  // ...
  fetchRocketData(rocketAId: string | null, rocketBId: string | null) {
    console.log(`Fetching rocket data for IDs: ${rocketAId}, ${rocketBId}`);

    const ids = [rocketAId, rocketBId]
      .filter((id): id is string => id !== null)
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b);

    if (ids.length === 0) {
      this.rocketData.set([]);
      return;
    }

    this.loadingState.set(true);
    this.errorState.set(false);

    this.apollo
      .query<RocketConfigsByIdsQuery, RocketConfigsByIdsVariables>({
        query: ROCKET_CONFIGS_BY_IDS,
        variables: { ids },
      })
      .pipe(
        map((result) => result?.data?.rocketConfigsByIds ?? []),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (data) => {
          this.rocketData.set(data);
        },
        error: (err) => {
          console.error("Error fetching rocket configs:", err);
          this.errorState.set(true);
        },
      });
  }
}
