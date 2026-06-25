import { inject, Injectable, signal } from "@angular/core";
import { Apollo } from "apollo-angular";
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  finalize,
  map,
  of,
  switchMap,
} from "rxjs";

import {
  ROCKET_CONFIGS_BY_IDS,
  type RocketConfig,
  type RocketConfigsByIdsQuery,
  type RocketConfigsByIdsVariables,
} from "@orbitq/graphql";
import {
  haveSameIds,
  toRocketIds,
  type RocketSelection,
} from "./rocket-data-utils";

@Injectable({ providedIn: "root" })
export class RocketDataService {
  private readonly apollo = inject(Apollo);

  // Only this service may update the private signals.
  private readonly rocketData = signal<RocketConfig[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal(false);

  // Public, read-only state for components
  readonly rockets = this.rocketData.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  // A BehaviorSubject stores the latest selection and emits whenever it changes.
  private readonly selectedRocketIds = new BehaviorSubject<RocketSelection>([
    null,
    null,
  ]);

  constructor() {
    this.selectedRocketIds
      .pipe(
        // Normalize first so equivalent UI selections share the same cache key.
        map(toRocketIds),
        // Do not refetch when the normalized selection has not changed.
        distinctUntilChanged(haveSameIds),
        // `switchMap` is "latest request wins": a new selection unsubscribes
        // from the in-flight request
        switchMap((ids) => this.fetchRockets(ids)),
      )
      // Keep the signal in sync with successful responses (or the empty fallback).
      .subscribe((data) => this.rocketData.set(data));
  }

  // Called by the view when either selector changes; the stream above handles
  // deduplication, request cancellation, and state updates.
  setSelectedRockets(rocketAId: string | null, rocketBId: string | null): void {
    this.selectedRocketIds.next([rocketAId, rocketBId]);
  }

  private fetchRockets(ids: number[]) {
    if (ids.length === 0) {
      // `EMPTY` completes without emitting because resetData already updated state.
      this.resetData();
      return EMPTY;
    }

    this.loadingState.set(true);
    this.errorState.set(false);

    return this.apollo
      .query<RocketConfigsByIdsQuery, RocketConfigsByIdsVariables>({
        query: ROCKET_CONFIGS_BY_IDS,
        variables: { ids },
      })
      .pipe(
        map((result) => result.data?.rocketConfigsByIds ?? []),
        catchError((error) => {
          console.error("Error fetching rocket configs:", error);
          this.errorState.set(true);
          // Emit a safe value so one failed request does not terminate the
          // selection stream; later selection changes can still trigger requests.
          return of([]);
        }),
        // Runs for success, error, and cancellation by switchMap.
        finalize(() => this.loadingState.set(false)),
      );
  }

  // Restore the same state as if no rockets were selected. This is called when the selection is empty.
  private resetData(): void {
    this.rocketData.set([]);
    this.loadingState.set(false);
    this.errorState.set(false);
  }
}
