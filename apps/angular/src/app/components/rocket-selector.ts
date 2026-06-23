import { Component, computed, signal, OnInit, model } from "@angular/core";
import { UiCombobox, type UiComboboxOption } from "./ui/ui-combobox";
import { Apollo, gql } from "apollo-angular";

import { ROCKET_CONFIGS } from "@orbitq/graphql";

type Rocket = {
  id: number;
  fullName: string;
  manufacturer: { name: string } | null;
};

type RocketConfigsQuery = {
  rocketConfigs: Rocket[];
};

@Component({
  selector: "rocket-selector",
  imports: [UiCombobox],
  template: `
    <section class="w-full px-6 py-3">
      @if (loading()) {
        <p class="font-mono text-orbitq-600 text-sm text-center">Loading...</p>
      } @else if (error()) {
        <p class="font-mono text-status-negative text-sm text-center">
          Failed to load rockets. Please try again later.
        </p>
      } @else {
        <div class="flex w-full">
          <div class="flex-1 flex items-center justify-center px-8">
            <ui-combobox
              class="w-full max-w-xs"
              placeholder="Select rocket A"
              listLabel="Rocket A options"
              toggleLabel="Open rocket A options"
              [displayValue]="displayA()"
              [open]="openA()"
              [options]="optionsA()"
              [selectedOptionId]="rocketA()?.id ?? null"
              [disabledOptionId]="rocketB()?.id ?? null"
              (queryChange)="queryA.set($event)"
              (openChange)="openA.set($event)"
              (optionSelected)="selectA($event)"
            />
          </div>

          <div class="flex-1 flex items-center justify-center px-8">
            @if (compareMode()) {
              <div class="flex gap-2 items-center w-full max-w-xs">
                <ui-combobox
                  class="flex-1"
                  placeholder="Select rocket B"
                  listLabel="Rocket B options"
                  toggleLabel="Open rocket B options"
                  [displayValue]="displayB()"
                  [open]="openB()"
                  [options]="optionsB()"
                  [selectedOptionId]="rocketB()?.id ?? null"
                  [disabledOptionId]="rocketA()?.id ?? null"
                  (queryChange)="queryB.set($event)"
                  (openChange)="openB.set($event)"
                  (optionSelected)="selectB($event)"
                />

                <button
                  type="button"
                  class="shrink-0 text-orbitq-600 hover:text-orbitq-50 transition-colors p-1"
                  aria-label="Remove comparison"
                  (click)="removeCompare()"
                >
                  <svg
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                    />
                  </svg>
                </button>
              </div>
            } @else {
              <button
                type="button"
                class="font-mono text-sm border border-orbitq-700 text-orbitq-400 hover:text-orbitq-50 hover:border-orbitq-600 rounded-sm px-3 py-2 transition-colors whitespace-nowrap"
                (click)="compareMode.set(true)"
              >
                + Add to compare
              </button>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class RocketSelector implements OnInit {
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly rockets = signal<Rocket[]>([]);

  constructor(private readonly apollo: Apollo) {}

  protected readonly queryA = signal("");
  protected readonly queryB = signal("");
  protected readonly openA = signal(false);
  protected readonly openB = signal(false);
  protected readonly compareMode = signal(false);

  rocketA = model<Rocket | null>(null);
  rocketB = model<Rocket | null>(null);

  ngOnInit() {
    this.loading.set(true);

    this.apollo
      .query<RocketConfigsQuery>({
        query: ROCKET_CONFIGS,
      })
      .subscribe({
        next: (result) => {
          if (result && result.data && result.data.rocketConfigs) {
            this.rockets.set(result.data.rocketConfigs);
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error("Error fetching rocket configs:", err);
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  protected readonly optionsA = computed(() =>
    this.filterRockets(this.queryA()).map(toOption),
  );
  protected readonly optionsB = computed(() =>
    this.filterRockets(this.queryB()).map(toOption),
  );
  protected readonly displayA = computed(
    () => this.queryA() || this.rocketA()?.fullName || "",
  );
  protected readonly displayB = computed(
    () => this.queryB() || this.rocketB()?.fullName || "",
  );

  protected selectA(option: UiComboboxOption) {
    if (option.id === this.rocketB()?.id) return;
    this.rocketA.set(this.findRocket(option.id));
    this.queryA.set("");
    this.openA.set(false);
  }

  protected selectB(option: UiComboboxOption) {
    if (option.id === this.rocketA()?.id) return;
    this.rocketB.set(this.findRocket(option.id));
    this.queryB.set("");
    this.openB.set(false);
  }

  protected removeCompare() {
    this.compareMode.set(false);
    this.rocketB.set(null);
    this.queryB.set("");
    this.openB.set(false);
  }

  private filterRockets(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return this.rockets();
    return this.rockets().filter((rocket) =>
      rocket.fullName.toLowerCase().includes(q),
    );
  }

  private findRocket(id: number): Rocket | null {
    return this.rockets().find((rocket: Rocket) => rocket.id === id) ?? null;
  }
}

function toOption(rocket: Rocket): UiComboboxOption {
  return {
    id: rocket.id,
    label: rocket.fullName,
    description: rocket.manufacturer?.name,
  };
}
