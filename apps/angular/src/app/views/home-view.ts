// home-view.ts
import {
  Component,
  inject,
  signal,
  effect,
  computed,
  Signal,
} from "@angular/core";
import { RocketDataService } from "../services/rocket-data";

import { RocketSelector } from "../components/rocket-selector";
import { AppCanvas } from "../components/app-canvas";

import type { RocketBasic, RocketConfig } from "@orbitq/graphql";

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
  protected readonly rocketData = inject(RocketDataService);
  // Component behavior is defined in here
  rocketA = signal<RocketBasic | null>(null);
  rocketB = signal<RocketBasic | null>(null);

  rocketAData = computed(() => {
    if (!this.rocketA()) return null;
    return (
      this.rocketData.rockets().find((r) => r.id === this.rocketA()!.id) ?? null
    );
  });
  rocketBData = computed(() => {
    if (!this.rocketB()) return null;
    return (
      this.rocketData.rockets().find((r) => r.id === this.rocketB()!.id) ?? null
    );
  });

  constructor() {
    effect(() => {
      const rocketAId = this.rocketA()?.id.toString() ?? null;
      const rocketBId = this.rocketB()?.id.toString() ?? null;
      this.rocketData.fetchRocketData(rocketAId, rocketBId);
    });
  }
}
