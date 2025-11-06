import { Component, inject } from "@angular/core";

import { Feature } from "src/app/core/services";
import { getStatusColour } from "src/app/core/util";
import { ButtonSize } from "src/lib/flow/button/button.component";

@Component({
  selector: "app-features-tags-explore",
  templateUrl: "./features-tags-explore.component.html",
  standalone: false,
})
export class FeaturesTagsExploreComponent {
  featureService = inject(Feature);

  getColour = getStatusColour;
  protected ButtonSize = ButtonSize;
}
