// app-canvas.ts
import { Component, input, Input } from "@angular/core";
import type { RocketConfig } from "@orbitq/graphql";

@Component({
  selector: "app-canvas",
  template: `
    <div style="position: absolute; top: 0; left: 0; padding: 8px; z-index: 10">
      <pre>
        Fetching: A: {{ rocketAFetching() }} B: {{ rocketBFetching() }}
      </pre
      >
      <pre>
      rocketA: {{ rocketAData()?.length }}
      rocketB: {{ rocketBData()?.length }}
    </pre
      >
    </div>
  `,
})
export class AppCanvas {
  rocketAData = input<RocketConfig | null>();
  rocketBData = input<RocketConfig | null>();

  rocketAFetching = input<boolean>();
  rocketBFetching = input<boolean>();
}
