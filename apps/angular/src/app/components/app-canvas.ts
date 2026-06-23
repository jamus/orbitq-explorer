// app-canvas.ts
import { Component, input, Input } from "@angular/core";

type Rocket = {
  id: number;
  fullName: string;
  manufacturer: { name: string } | null;
};

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
  rocketAData = input<Rocket | null>();
  rocketBData = input<Rocket | null>();
}
