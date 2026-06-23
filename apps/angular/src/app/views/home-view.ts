// home-view.ts
import { Component, inject, signal, effect } from "@angular/core";
import { RocketDataService } from "../services/rocket-data";

import { RocketSelector } from "../components/rocket-selector";
import { AppCanvas } from "../components/app-canvas";

import type { RocketBasic } from "@orbitq/graphql";
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
      [rocketAData]="rocketA()"
      [rocketBData]="rocketB()"
    ></app-canvas>
  `,
})
export class HomeView {
  protected readonly rocketData = inject(RocketDataService);
  // Component behavior is defined in here
  rocketA = signal<RocketBasic | null>(null);
  rocketB = signal<RocketBasic | null>(null);

  rocketAData = signal<RocketBasic | null>(null);
  rocketBData = signal<RocketBasic | null>(null);

  constructor() {
    effect(() => {
      const rocketAId = this.rocketA()?.id.toString() ?? null;
      const rocketBId = this.rocketB()?.id.toString() ?? null;
      this.rocketData.fetchRocketData(rocketAId, rocketBId);
    });
  }
}
