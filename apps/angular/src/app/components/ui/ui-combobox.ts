import { Component, EventEmitter, Input, Output } from "@angular/core";

export type UiComboboxOption = {
  id: number;
  label: string;
  description?: string;
};

@Component({
  selector: "ui-combobox",
  template: `
    <div class="relative w-full">
      <div class="relative">
        <input
          class="w-full border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2 pr-8 focus:outline-none focus:border-orbitq-600 transition-colors placeholder:text-orbitq-600"
          [placeholder]="placeholder"
          [value]="displayValue"
          (focus)="handleFocus()"
          (input)="handleInput($event)"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 flex items-center pr-2 text-orbitq-600 hover:text-orbitq-50 transition-colors"
          [attr.aria-label]="toggleLabel"
          (click)="openChange.emit(!open)"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      @if (open) {
        <div
          class="absolute z-10 mt-0.5 w-full bg-orbitq-850 border border-orbitq-700 rounded-sm py-1 shadow-lg max-h-60 overflow-auto focus:outline-none"
          role="listbox"
          [attr.aria-label]="listLabel"
        >
          @for (option of options; track option.id) {
            <button
              type="button"
              class="flex w-full flex-col gap-0.5 px-3 py-2 text-left"
              [class.cursor-not-allowed]="disabledOptionId === option.id"
              [class.opacity-40]="disabledOptionId === option.id"
              [class.cursor-pointer]="disabledOptionId !== option.id"
              [class.bg-orbitq-700]="selectedOptionId === option.id"
              [disabled]="disabledOptionId === option.id"
              role="option"
              [attr.aria-selected]="selectedOptionId === option.id"
              (click)="selectOption(option)"
            >
              <span
                class="font-mono text-sm text-orbitq-50"
                [class.font-semibold]="selectedOptionId === option.id"
              >
                {{ option.label }}
              </span>
              @if (option.description) {
                <span class="font-mono text-xs text-orbitq-600">
                  {{ option.description }}
                </span>
              }
            </button>
          } @empty {
            <p class="px-3 py-2 font-mono text-sm text-orbitq-600">
              No results
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class UiCombobox {
  @Input() placeholder = "";
  @Input() displayValue = "";
  @Input() listLabel = "Options";
  @Input() toggleLabel = "Open options";
  @Input() open = false;
  @Input() options: UiComboboxOption[] = [];
  @Input() selectedOptionId: number | null = null;
  @Input() disabledOptionId: number | null = null;

  @Output() queryChange = new EventEmitter<string>();
  @Output() openChange = new EventEmitter<boolean>();
  @Output() optionSelected = new EventEmitter<UiComboboxOption>();

  protected handleFocus() {
    this.queryChange.emit("");
    this.openChange.emit(true);
  }

  protected handleInput(event: Event) {
    this.queryChange.emit((event.target as HTMLInputElement).value);
    this.openChange.emit(true);
  }

  protected selectOption(option: UiComboboxOption) {
    if (this.disabledOptionId === option.id) return;
    this.optionSelected.emit(option);
  }
}
