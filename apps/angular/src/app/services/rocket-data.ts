import { inject, Injectable, signal } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { finalize, map } from "rxjs";

import {
  ROCKET_CONFIGS,
  type RocketConfigsQuery,
  type RocketBasic,
} from "@orbitq/graphql";

@Injectable({ providedIn: "root" })
export class RocketDataService {
  private readonly apollo = inject(Apollo);

  private readonly rocketData = signal<RocketBasic[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal(false);

  // expose the signals as readonly to prevent external modification
  readonly rockets = this.rocketData.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  // ...
  fetchRocketConfigs() {
    this.loadingState.set(true);
    this.errorState.set(false);

    this.apollo
      .query<RocketConfigsQuery>({
        query: ROCKET_CONFIGS,
      })
      .pipe(
        map((result) => result?.data?.rocketConfigs ?? []),
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
