import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { CommonModule } from "@angular/common";
import { EntityWrap } from "src/app/core/entity.service";
import { AzEntityCardsModule } from "src/app/entity-cards/entity-cards.module";

const enum TabKey {
  SimilarFeatures = 0,
  SimilarSsdeep = 1,
  SimilarTLSH = 2,
  SimilarEntropy = 3,
  Parents = 4,
  Children = 5,
  Sources = 6,
}

@Component({
  selector: "azco-relations-tab",
  templateUrl: "./relations-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AzEntityCardsModule],
})
export class RelationsTabComponent {
  protected tabs = [
    {
      key: TabKey.Sources,
      name: "Sources",
    },
    {
      key: TabKey.Parents,
      name: "Parents",
    },
    {
      key: TabKey.Children,
      name: "Children",
    },
    {
      key: TabKey.SimilarFeatures,
      name: "Similar Features",
    },
    {
      key: TabKey.SimilarSsdeep,
      name: "Similar ssdeep",
    },
    {
      key: TabKey.SimilarTLSH,
      name: "Similar TLSH",
    },
    {
      key: TabKey.SimilarEntropy,
      name: "Similar Entropy",
    },
  ];
  protected activeTab$ = new BehaviorSubject<TabKey>(TabKey.Sources);

  @Input()
  entity: EntityWrap;
}
