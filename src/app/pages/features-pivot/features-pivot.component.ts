import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Observable, of } from "rxjs";
import * as ops from "rxjs/operators";

import { components } from "src/app/core/api/openapi";
import { Api } from "src/app/core/services";

import { toObservable } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { PivotService } from "src/app/core/pivot.service";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";
import { escapeValue } from "../../core/util";

/**page for displaying all features*/
@Component({
  selector: "app-features-pivot",
  templateUrl: "./features-pivot.component.html",
  styleUrls: ["./features-pivot.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeaturesPivotComponent {
  api = inject(Api);
  router = inject(Router);
  pivotService = inject(PivotService);

  /** number of rows currently displayed */
  protected currently_displayed = 0;
  protected escapeValue = escapeValue;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faSpinner = faSpinner;
  protected faCheck = faCheck;
  // Subscriptions
  protected pivotFeatures$: Observable<
    components["schemas"]["FeaturePivotResponse"] & { values_count: number }
  >;

  protected ongoingRequest = signal(false)

  constructor() {
    this.pivotFeatures$ = toObservable(
      this.pivotService.SelectedFeatureSignal,
    ).pipe(
      ops.debounceTime(1000),
      ops.tap(() =>  {
        this.ongoingRequest.set(true)
      }),
      ops.switchMap((selectedFeats) => {
        return this.api.featurePivotValues({
          feature_values: selectedFeats,
        });
      }),
      ops.catchError(() => {
        return of({reason: "Unable to find features, are any filters selected?", incomplete_query: false, feature_value_counts: []})
    }),
      ops.map((pv) => {
        let values_count = 0;
        pv.feature_value_counts.forEach((val) =>{
          values_count += val.values_and_counts.length
        })
        return {
          reason: pv.reason,
          incomplete_query: pv.incomplete_query,
          feature_value_counts: pv.feature_value_counts,
          values_count: values_count,
        };
      }),
      ops.tap(() =>  {
        this.ongoingRequest.set(false)
      }),
      ops.shareReplay(1),
    );
  }

  trackBy(i: number, feat_name: string): string {
    return `${i}${feat_name}`;
  }

  trackHeaderBy(i: number, feat_name: string, feat_val: string): string {
    return `${i}${feat_name}${feat_val}`;
  }

  selectFeatureValue(
    featureToSelect: components["schemas"]["FeaturePivotRequest"],
  ) {
    this.pivotService.setSelected(featureToSelect);
  }

  isAlreadyTicked(feat_name: string, feat_value: string): boolean {
    return this.pivotService.isSelected({
      feature_name: feat_name,
      feature_value: feat_value,
    });
  }

  updateSelectedFeatures(event: Event, feat_name: string, feat_value: string) {
    if (
      this.pivotService.isSelected({
        feature_name: feat_name,
        feature_value: feat_value,
      })
    ) {
      this.pivotService.removeSelected({
        feature_name: feat_name,
        feature_value: feat_value,
      });
    } else {
      this.pivotService.setSelected({
        feature_name: feat_name,
        feature_value: feat_value,
      });
    }
  }

  // Search for the currently selected feature values.
  searchForSelectedFeatures() {
    const termParams = Array<string>();
    this.pivotService.SelectedFeatureSignal().forEach((fv) => {
      termParams.push(`features_map.${fv.feature_name}:${escapeValue(fv.feature_value)}`);
    });
    // The actual term query are space seperated values.
    const termQuery = termParams.join(" ");
    this.router.navigate(["/pages/binaries/explore"], {
      queryParams: { term: termQuery },
    });
  }

  clearFeatures(){
    this.pivotService.clearPivot()
  }
}

// TODO - start using a cdk-virtual-scroll-viewport to limit viewed content.
// May have to flatten the 2D list to 1D so it can scroll through the list, or provide a function that does it for it.
