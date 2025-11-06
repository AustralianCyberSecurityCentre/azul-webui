import { Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable } from "rxjs";

import * as ops from "rxjs/operators";

import { Security } from "src/app/core/services";
import { ButtonType } from "src/lib/flow/button/button.component";
import { config } from "../../settings";

@Component({
  selector: "app-unauthorized",
  templateUrl: "unauthorized.component.html",
  standalone: false,
})
export class UnauthorizedComponent {
  protected security = inject(Security);

  protected error$: Observable<string | undefined>;
  protected help: string;
  readonly ButtonType = ButtonType;

  constructor() {
    const route = inject(ActivatedRoute);

    this.error$ = route.paramMap.pipe(
      ops.map((_x) => window.history.state.exception),
    );

    this.help = config.unauthorized_help;
  }
}
