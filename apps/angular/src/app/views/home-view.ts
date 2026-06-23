// home-view.ts
import { Component, inject, signal } from "@angular/core";
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
    this.rocketData.fetchRocketData("527", "2"); // Example IDs for rocket A and B
  }
}
