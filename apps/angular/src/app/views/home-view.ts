// home-view.ts
import { Component, signal } from "@angular/core";
import { RocketSelector } from "../components/rocket-selector";
import { AppCanvas } from "../components/app-canvas";
import type { RocketBasic } from "@orbitq/graphql";

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
  // Component behavior is defined in here
  rocketA = signal<RocketBasic | null>(null);
  rocketB = signal<RocketBasic | null>(null);
}
