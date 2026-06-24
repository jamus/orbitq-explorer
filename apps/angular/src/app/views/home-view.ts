// home-view.ts
import { Component, inject, signal, effect, computed } from "@angular/core";
import { RocketDataService } from "../services/rocket-data";

import { RocketSelector } from "../components/rocket-selector";
import { AppCanvas } from "../components/app-canvas";

import type { RocketBasic, RocketConfig } from "@orbitq/graphql";
import { RocketListService } from "../services/rocket-list";

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
    if (!this.rocketA()) return null;
    return (
      this.rocketData.rockets().find((r) => r.id === this.rocketA()!.id) ?? null
    );
  });
  rocketBData = computed<RocketConfig | null>(() => {
    if (!this.rocketB()) return null;
    return (
      this.rocketData.rockets().find((r) => r.id === this.rocketB()!.id) ?? null
    );
  });

  constructor() {
    effect(() => {
      if (this.rocketA() !== null) return;
      const defaultRocket =
        this.rocketList.rockets().find((rocket) => rocket.id === 527) ?? null;
      if (defaultRocket) {
        this.rocketA.set(defaultRocket);
      }
    });
    effect(() => {
      const rocketAId = this.rocketA()?.id.toString() ?? null;
      const rocketBId = this.rocketB()?.id.toString() ?? null;
      this.rocketData.fetchRocketData(rocketAId, rocketBId);
    });
  }
}
