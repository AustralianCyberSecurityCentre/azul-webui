import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  WritableSignal,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ButtonType } from "@lib/flow/button/button.component";
import { config } from "../../settings";

@Component({
  selector: "app-unavailable",
  templateUrl: "./unavailable.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class UnavailableComponent {
  readonly ButtonType = ButtonType;
  protected help: WritableSignal<string | undefined> = signal(undefined);

  constructor() {
    const route = inject(ActivatedRoute);
    if (config?.unavailable_help) {
      this.help.set(config.unavailable_help);
    }
  }
}
