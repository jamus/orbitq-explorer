// home-view.ts
import { Component, signal } from "@angular/core";
import { RocketSelector } from "../components/rocket-selector";
import { AppCanvas } from "../components/app-canvas";

type Rocket = {
  id: number;
  fullName: string;
  manufacturer: { name: string } | null;
};

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
  rocketA = signal<Rocket | null>(null);
  rocketB = signal<Rocket | null>(null);
}
