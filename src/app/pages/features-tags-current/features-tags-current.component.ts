import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { Observable, ReplaySubject, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import { escapeValue } from "src/app/core/util";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";
import { FeatureService } from "../../core/feature.service";
import { FeatureTagsWithNumBinaries } from "src/app/core/api/state";

@Component({
  selector: "app-features-tags-current",
  templateUrl: "./features-tags-current.component.html",
  standalone: false,
})
export class FeaturesTagsCurrentComponent implements OnInit, OnDestroy {
  featureService = inject(FeatureService);
  private route = inject(ActivatedRoute);

  protected faXmark = faXmark;

  protected escapeValue = escapeValue;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  tag$: Observable<string>;
  features$: Observable<FeatureTagsWithNumBinaries>;

  valueCountBinSub: Subscription;

  ngOnInit(): void {
    this.tag$ = this.route.params.pipe(
      ops.map((d) => {
        return d.tag;
      }),
    );
    this.features$ = this.tag$.pipe(
      ops.mergeMap((d) => this.featureService.featuresWithTag$(d)),
      ops.map((f) => {
        const d = f as FeatureTagsWithNumBinaries;
        // add count of binaries with these features
        for (const row of d.items) {
          row.XNumBinaries$ = new ReplaySubject<number>(1);
        }
        const data = d.items.map((r) => {
          return {
            name: r.feature_name,
            value: r.feature_value,
            cb: r.XNumBinaries$,
          };
        });
        this.valueCountBinSub?.unsubscribe();
        this.valueCountBinSub = this.featureService.featureValuesCountBinaries$(
          data,
          "",
          "",
        );

        return d;
      }),
    );
  }

  ngOnDestroy(): void {
    this.valueCountBinSub?.unsubscribe();
  }

  onDeleteFVTag(feature: string, value: string, tag: string) {
    const result = window.confirm(
      `Are you sure you want to remove tag "${tag}" from feature value "${feature}: ${value}"?`,
    );
    if (result) {
      this.featureService
        .deleteTag(feature, value, tag)
        .pipe(ops.first())
        .subscribe(() => {});
    }
  }
}
