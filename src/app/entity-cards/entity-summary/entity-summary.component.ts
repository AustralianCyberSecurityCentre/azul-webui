import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnChanges,
} from "@angular/core";
import { components } from "@app/core/api/openapi";
import { combineLatest, Observable } from "rxjs";
import * as ops from "rxjs/operators";

import { EntityWrap } from "@app/core/services";
import { formatLink, FormattedLink } from "@app/core/user-url";
import { getStatusColour } from "@app/core/util";
import { config } from "@app/settings";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { EntityNavService, RelationsTabs } from "../entity-nav.services";
/** Displays a summary of an entity's information in a table format. */
@Component({
  selector: "azco-entity-summary",
  templateUrl: "./entity-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntitySummaryComponent implements OnChanges {
  protected entityNavService = inject(EntityNavService);

  protected getStatusColour = getStatusColour;
  entity = input<EntityWrap>();

  protected entityLinks$: Observable<FormattedLink[]>;
  protected featureTags$: Observable<
    components["schemas"]["FeatureValueTag"][]
  >;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faCircleExclamation = faCircleExclamation;

  ngOnChanges() {
    this.entityLinks$ = combineLatest([
      this.entity().summary$,
      this.entity().rawFeatures$,
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

    this.featureTags$ = this.entity().features$.pipe(
      ops.map((sources) =>
        sources
          .filter((feature) => feature.tags)
          .map((feature) => feature.tags)
          .flat(),
      ),
    );
  }

  linkToSsdeepPage() {
    this.entityNavService.navigateToRelationsSubTab(
      RelationsTabs.SimilarSsdeep,
    );
  }
}
