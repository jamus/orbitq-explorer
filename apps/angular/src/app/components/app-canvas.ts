// app-canvas.ts
import { Component, input, Input } from "@angular/core";
import type { RocketBasic } from "@orbitq/graphql";

@Component({
  selector: "app-canvas",
  template: `
    <div style="position: absolute; top: 0; left: 0; padding: 8px; z-index: 10">
      <pre>
      rocketA: {{ rocketAData()?.fullName }}
      rocketB: {{ rocketBData()?.fullName }}
    </pre
      >
    </div>
  `,
})
export class AppCanvas {
  rocketAData = input<RocketBasic | null>();
  rocketBData = input<RocketBasic | null>();
}
