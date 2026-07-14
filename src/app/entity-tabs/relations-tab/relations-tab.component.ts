import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";

import { CommonModule } from "@angular/common";
import { EntityWrap } from "@app/core/entity.service";
import { AzEntityCardsModule } from "@app/entity-cards/entity-cards.module";
import {
  EntityNavService,
  RelationsTabs,
} from "@app/entity-cards/entity-nav.services";

@Component({
  selector: "azco-relations-tab",
  templateUrl: "./relations-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AzEntityCardsModule],
})
export class RelationsTabComponent {
  protected entityNavService = inject(EntityNavService);

  protected RelationsTabs = RelationsTabs;
  // Order of this list determines order of the tabs.
  protected tabs = [
    RelationsTabs.Sources,
    RelationsTabs.Parents,
    RelationsTabs.Children,
    RelationsTabs.SimilarFeatures,
    RelationsTabs.SimilarSsdeep,
    RelationsTabs.SimilarTLSH,
    RelationsTabs.SimilarEntropy,
  ];
  entity = input<EntityWrap>();
}
