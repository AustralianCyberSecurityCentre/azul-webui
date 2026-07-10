import {
  ChangeDetectionStrategy,
  Component,
  signal,
  WritableSignal,
} from "@angular/core";

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
    if (config?.unavailable_help) {
      this.help.set(config.unavailable_help);
    } else {
      this.help.set("Azul is down");
    }
  }
}
