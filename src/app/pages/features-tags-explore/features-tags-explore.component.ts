import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { Feature } from "@app/core/services";
import { getStatusColour } from "@app/core/util";
import { ButtonSize } from "@lib/flow/button/button.component";

@Component({
  selector: "app-features-tags-explore",
  templateUrl: "./features-tags-explore.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeaturesTagsExploreComponent {
  featureService = inject(Feature);

  getColour = getStatusColour;
  protected ButtonSize = ButtonSize;
}
