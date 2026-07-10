import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  WritableSignal,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable } from "rxjs";

import * as ops from "rxjs/operators";

import { Security } from "@app/core/services";
import { ButtonType } from "@lib/flow/button/button.component";
import { config } from "../../settings";

@Component({
  selector: "app-unauthorized",
  templateUrl: "unauthorized.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class UnauthorizedComponent {
  protected security = inject(Security);

  protected error$: Observable<string | undefined>;
  protected help: WritableSignal<string> = signal("");
  helpOverride = input<string | undefined>(undefined);
  readonly ButtonType = ButtonType;

  constructor() {
    const route = inject(ActivatedRoute);

    this.error$ = route.paramMap.pipe(
      ops.map((_x) => window.history.state.exception),
    );
    if (config?.unauthorized_help) {
      this.help.set(config.unauthorized_help);
    }
  }
}
