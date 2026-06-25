// home-view.ts
import { Component, inject, signal, effect, computed } from "@angular/core";
import { RocketDataService } from "../services/rocket-data";

import { RocketSelector } from "../components/rocket-selector";
import { AppCanvas } from "../components/app-canvas";

import type { RocketBasic, RocketConfig } from "@orbitq/graphql";
import { RocketListService } from "../services/rocket-list";
import {
  findSelectedRocketData,
  isRocketFetching,
  pickDefaultRocketA,
} from "../services/rocket-data-utils";

@Component({
  selector: "home-view",
  imports: [RocketSelector, AppCanvas],
  template: `
    <rocket-selector
      [(rocketA)]="rocketA"
      [(rocketB)]="rocketB"
    ></rocket-selector>
    <app-canvas
      [rocketAData]="rocketAData()"
      [rocketBData]="rocketBData()"
      [rocketAFetching]="rocketAFetching()"
      [rocketBFetching]="rocketBFetching()"
    ></app-canvas>
  `,
})
export class HomeView {
  protected readonly rocketList = inject(RocketListService);
  protected readonly rocketData = inject(RocketDataService);
  // Component behavior is defined in here
  rocketA = signal<RocketBasic | null>(null);
  rocketB = signal<RocketBasic | null>(null);

  rocketAData = computed<RocketConfig | null>(() => {
    return findSelectedRocketData(this.rocketA(), this.rocketData.rockets());
  });
  rocketBData = computed<RocketConfig | null>(() => {
    return findSelectedRocketData(this.rocketB(), this.rocketData.rockets());
  });

  rocketAFetching = computed(() =>
    isRocketFetching(this.rocketA(), this.rocketAData()),
  );
  rocketBFetching = computed(() =>
    isRocketFetching(this.rocketB(), this.rocketBData()),
  );

  constructor() {
    effect(() => {
      const currentRocketA = this.rocketA();
      const defaultRocket = pickDefaultRocketA(
        this.rocketList.rockets(),
        currentRocketA,
      );
      if (currentRocketA === null && defaultRocket) {
        this.rocketA.set(defaultRocket);
      }
    });
    effect(() => {
      const rocketAId = this.rocketA()?.id.toString() ?? null;
      const rocketBId = this.rocketB()?.id.toString() ?? null;
      this.rocketData.setSelectedRockets(rocketAId, rocketBId);
    });
  }
}
