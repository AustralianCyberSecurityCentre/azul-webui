import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";
import { Entity } from "src/app/core/services";
import { escapeValue, getStatusColour } from "src/app/core/util";
import { ButtonSize } from "src/lib/flow/button/button.component";
import { ApiService } from "../../core/api/api.service";

/**page for exploring entity tags*/
@Component({
  selector: "app-entities-tags-explore",
  templateUrl: "./entities-tags-explore.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesTagsExploreComponent {
  entityService = inject(Entity);
  private api = inject(ApiService);

  protected getColour = getStatusColour;
  protected escapeValue = escapeValue;
  protected ButtonSize = ButtonSize;

  tags$: Observable<components["schemas"]["ReadTags"] | undefined>;

  constructor() {
    this.tags$ = this.api.entityReadAllTags().pipe(ops.shareReplay(1));
  }
}
