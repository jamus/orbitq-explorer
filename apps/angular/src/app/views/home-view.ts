// home-view.ts
import { Component } from "@angular/core";
import { RocketSelector } from "../components/rocket-selector";

@Component({
  selector: "home-view",
  imports: [RocketSelector],
  template: `
    <h1>Home View</h1>
    <rocket-selector></rocket-selector>
  `,
})
export class HomeView {
  // Component behavior is defined in here
}
