import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from "@angular/core";
import { combineLatest, Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";

import { EntityWrap } from "src/app/core/services";
import { formatLink, FormattedLink } from "src/app/core/user-url";
import { getStatusColour } from "src/app/core/util";
import { config } from "src/app/settings";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

/** Displays a summary of an entity's information in a table format. */
@Component({
  selector: "azco-entity-summary",
  templateUrl: "./entity-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntitySummaryComponent implements OnChanges {
  protected getStatusColour = getStatusColour;

  @Input()
  entity: EntityWrap;

  protected entityLinks$: Observable<FormattedLink[]>;
  protected featureTags$: Observable<
    components["schemas"]["FeatureValueTag"][]
  >;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  ngOnChanges() {
    this.entityLinks$ = combineLatest([
      this.entity.summary$,
      this.entity.rawFeatures$,
    ]).pipe(
      ops.map(([summary, features]) => {
        const context = {
          summary: summary,
          features: features,
        };

        const links = config?.binary_external_links ?? [];

        return links
          .map((entry) => formatLink(context, entry))
          .filter((x) => x !== undefined);
      }),
    );

    this.featureTags$ = this.entity.features$.pipe(
      ops.map((sources) =>
        sources
          .filter((feature) => feature.tags)
          .map((feature) => feature.tags)
          .flat(),
      ),
    );
  }
}
