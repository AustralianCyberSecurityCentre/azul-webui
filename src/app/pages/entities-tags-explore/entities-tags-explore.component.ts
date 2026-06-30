import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { components } from "@app/core/api/openapi";
import { Entity } from "@app/core/services";
import { escapeValue, getStatusColour } from "@app/core/util";
import { ButtonSize } from "@lib/flow/button/button.component";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
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
