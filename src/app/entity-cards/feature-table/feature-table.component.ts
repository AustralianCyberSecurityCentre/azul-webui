import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  WritableSignal,
  inject,
  signal,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  interval,
} from "rxjs";
import * as ops from "rxjs/operators";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { Router } from "@angular/router";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { Boundary } from "src/app/common/offset-picker/offset-picker.component";
import { components } from "src/app/core/api/openapi";
import { FeatureWithDecodedValue } from "src/app/core/api/state";
import { PivotService } from "src/app/core/pivot.service";
import { escapeValue } from "src/app/core/util";
import { BaseCard } from "../base-card.component";

const sortString = (a: string, b: string) => (b == a ? 0 : b < a ? 1 : -1);
const sortNumber = (a: number, b: number) => a - b;

type ShowFeatureShared = {
  showAll: boolean;
  max: number;
};

type FeatureValue = {
  name: string;
  value: string;
};

/**extend feature with properties for display purposes*/
export type ShowFeature = FeatureWithDecodedValue & {
  showFeatureName: boolean;
  distance: number;
  shared: ShowFeatureShared;
  // make parts read-writable as we explicitly mutate it
  parts?: components["schemas"]["FeatureValuePart"] & {
    location: (readonly number[])[];
  };
};

const FEATURE_INSTANCE_USER_TYPE = "user";

/**card showing a set of features in a table*/
@Component({
  selector: "azec-feature-table",
  templateUrl: "./feature-table.component.html",
  styleUrls: ["./feature-table.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeatureTableComponent extends BaseCard implements OnDestroy {
  private router = inject(Router);
  private dialogService = inject(Dialog);
  private pivotService = inject(PivotService);

  @ViewChild("ftable", { read: ElementRef }) ftable: ElementRef;

  help = `
Displays feature values extracted from the entity.

Columns in table:
Feature - A key for which a plugin produces values that vary based on the specific binary.
Binaries - Number of binaries with this specific feature value (including current binary).
Value - A value produced by a plugin for a binary, otherwise known as a 'feature value'.
Label - Any additional notes that the plugin felt was relevant for the feature value.
Tags - Specific feature values can be tagged by users, these will be shown here.

Click the gear button to enable additional columns:
Author - The plugins that produced the feature value.
Loc. - Number of locations in the binary file that the feature value was found.
Location - The first occurance of the feature value in the binary file.

Use the filter to hide features and values that do not match.
Use the leftmost arrow to expand a detailed view of the feature value.
In this detailed view you may view and pivot over parts of uris and filepaths, and see a full list of authors.
  `;
  dbg = (...d) => console.debug("FeatureTableComponent:", ...d);
  err = (...d) => console.error("FeatureTableComponent:", ...d);

  protected faPlus = faPlus;

  currentSelectedFeatures: WritableSignal<Array<FeatureValue>> =
    signal(Array<FeatureValue>());

  protected escapeValue = escapeValue;

  @Input() tablename: string = "default";

  _features$: Observable<ShowFeature[]>;
  get unboundedFeatures$() {
    return this._features$;
  }
  @Input() set features$(d$: Observable<ShowFeature[]>) {
    this._features$ = d$;
    this.filterFeaturesByBoundary();
    this.sortAndFilter();
    this.countPluginsFeature();
  }

  private dialog: DialogRef;

  protected featureDetailShow(tpl, row: ShowFeature) {
    this.currentRowDetail = row;
    this.dialogClose();
    this.dialog = this.dialogService.open(tpl);
  }

  protected dialogClose() {
    if (this.dialog) {
      this.dialog.close();
    }
    this.dialog = null;
  }

  currentRowDetail: ShowFeature = null;
  showDetail: WritableSignal<ShowFeature> = signal(null);
  filterFormControl: FormControl<string>;
  filterSub: Subscription;
  currentFilter$: BehaviorSubject<string> = new BehaviorSubject<string>("");
  currentPluginFilter$: BehaviorSubject<string[]> = new BehaviorSubject<
    string[]
  >([]);
  caseSensitivity$ = new BehaviorSubject<boolean>(false);

  protected boundedFeatures$: Observable<ShowFeature[]>;
  protected visibleExtent$: BehaviorSubject<Boundary> = new BehaviorSubject({
    x1: -1,
    x2: -1,
  });
  private extentSub: Subscription;

  last_length = 0;
  /** feature values that have been filtered and sorted */
  displayFeatures$: Observable<ShowFeature[]>;
  /** reduced set of features for rendering table rows */
  reduceFeatures$: Observable<ShowFeature[]>;
  rereduceFeatures$ = new BehaviorSubject<boolean>(true);
  featureRowCounts$: Observable<Map<string, number>>;

  /** number of rows currently displayed */
  currently_displayed = 0;

  @Input() forceShowLocation: boolean = false;

  pluginFVCounts: WritableSignal<Map<string, number>> = signal(
    new Map<string, number>(),
  );

  constructor() {
    super();
    const router = this.router;

    this.router = router;
    this.initFilterForm("");
  }

  initFilterForm(initalValue: string): void {
    this.filterFormControl = new FormControl(initalValue);
    this.filterSub?.unsubscribe();
    this.filterSub = this.filterFormControl.valueChanges
      .pipe(ops.debounceTime(200))
      .subscribe((newVal: string) => {
        this.currentFilter$.next(newVal);
      });
    // Update plugin counts when a new boundary was selected
    this.extentSub?.unsubscribe();
    this.extentSub = this.visibleExtent$.subscribe((_) => {
      if (this.boundedFeatures$) {
        this.countPluginsFeature();
      }
    });
  }

  ngOnDestroy() {
    this.dialogClose();
    this.filterSub?.unsubscribe();
    this.extentSub?.unsubscribe();
  }

  /**
   * Filter events by a boundary, and configure an Observable for use by
   * other filters further down the pipeline.
   */
  private filterFeaturesByBoundary() {
    this.boundedFeatures$ = combineLatest([
      this.unboundedFeatures$,
      this.visibleExtent$,
    ]).pipe(
      ops.map(([features, boundary]) => {
        // filter events by range
        if (boundary.x1 >= 0 && boundary.x2 >= 0) {
          console.log("Filtering by boundary!");
          const found = [];
          for (const row of features) {
            const matchingLocations =
              row.parts?.location?.filter(
                (location) =>
                  boundary.x1 <= location[1] && boundary.x2 >= location[0],
              ) ?? [];

            if (matchingLocations.length > 0) {
              // Deep copy to avoid mutating the original features
              const newRow = structuredClone(row);
              newRow.parts.location = matchingLocations;
              found.push(newRow);
            }
          }

          return found;
        } else {
          return features;
        }
      }),
    );
  }

  private countPluginsFeature() {
    this.boundedFeatures$
      .pipe(
        ops.first(),
        ops.map((feats) => {
          const tempPluginFVCounts = new Map<string, number>();
          feats.forEach((f) => {
            f.instances.forEach((plugin) => {
              const [_leadingId, authorType, authorName, _eventType] =
                plugin.split(".");
              if (authorType === FEATURE_INSTANCE_USER_TYPE) {
                // Add all user data to custom grouping
                if (tempPluginFVCounts.has(authorType)) {
                  tempPluginFVCounts.set(
                    authorType,
                    tempPluginFVCounts.get(authorType) + 1,
                  );
                } else {
                  tempPluginFVCounts.set(authorType, 1);
                }
              } else if (tempPluginFVCounts.has(authorName)) {
                tempPluginFVCounts.set(
                  authorName,
                  tempPluginFVCounts.get(authorName) + 1,
                );
              } else {
                tempPluginFVCounts.set(authorName, 1);
              }
            });
          });
          return tempPluginFVCounts;
        }),
      )
      .subscribe((tempPluginFVCounts) => {
        this.pluginFVCounts.set(tempPluginFVCounts);
        // Reset plugin toggles if this has been updated just to avoid the user
        // filtering on a plugin which they can't see
        this.toggleAllPlugins(true);
      });
  }

  toggleButton(button: string) {
    this.dbg("Toggling:", button);
    if (this.currentPluginFilter$.value.includes(button)) {
      this.currentPluginFilter$.next(
        this.currentPluginFilter$.value.filter((x) => x != button),
      );
    } else {
      this.currentPluginFilter$.next([
        ...this.currentPluginFilter$.value,
        button,
      ]);
    }
  }

  toggleAllPlugins(forcedOn: boolean = false) {
    if (this.currentPluginFilter$.value.length == 0 || forcedOn) {
      this.currentPluginFilter$.next(Array.from(this.pluginFVCounts().keys()));
    } else {
      this.currentPluginFilter$.next([]);
    }
  }

  private sortAndFilter() {
    const temp = combineLatest([
      this.boundedFeatures$,
      this.currentFilter$,
      this.currentPluginFilter$,
      this.caseSensitivity$,
    ]).pipe(
      ops.debounceTime(200),
      ops.map(([fs, filter, pFilter, caseSensitivity]) => {
        // filter data as requested by user
        const realFeats = [];

        const lowerFilter = filter.toLowerCase();

        for (const f of fs) {
          if (filter.length > 0) {
            if (
              (caseSensitivity &&
                !(
                  f.name.includes(filter) ||
                  f.value.toString().includes(filter) ||
                  f.type.includes(filter) ||
                  f.instances.join(",").includes(filter)
                )) ||
              (!caseSensitivity &&
                !(
                  f.name.toLowerCase().includes(lowerFilter) ||
                  f.value.toString().toLowerCase().includes(lowerFilter) ||
                  f.type.toLowerCase().includes(lowerFilter) ||
                  f.instances.join(",").toLowerCase().includes(lowerFilter)
                ))
            ) {
              continue;
            }
          }

          if (
            !f.instances.some((iVal) => {
              // Check if any of the feature's plugins are set to be viewed.
              const [_leadingId, authorType, authorName, _eventType] =
                iVal.split(".");
              // if plugin filter is same as author type, display all features for that author
              if (pFilter.includes(authorType)) {
                return true;
              }
              return pFilter.includes(authorName);
            })
          ) {
            continue;
          }
          realFeats.push(f);
        }
        this.dbg("feature changes processed", realFeats.length);
        return realFeats;
      }),
      ops.shareReplay(1),
    );

    this.displayFeatures$ = combineLatest([temp]).pipe(
      ops.map(([feats]) => {
        // sort features by entity count and name
        let sortedFeats = [...feats];
        // sort by value when we don't have a binary count yet
        sortedFeats = sortedFeats.sort((f1, f2) =>
          sortString(f1.value, f2.value),
        );
        // sort by binary count for each value within each feature
        sortedFeats = sortedFeats.sort((f1, f2) =>
          sortNumber(f1.XBinaries, f2.XBinaries),
        );
        // sort by feature name
        sortedFeats = sortedFeats.sort((f1, f2) =>
          sortString(f1.name, f2.name),
        );
        return sortedFeats;
      }),
      ops.map((d) => {
        // only show the feature name if this is the first in a block of same values for a feature
        const tmp = <ShowFeature[]>d;
        let last = "";
        let distance = 0;
        let shared = undefined;
        for (const row of tmp) {
          const newGroup = row.name != last;
          // increment if not start of new feature
          distance = newGroup ? 0 : distance + 1;

          shared = newGroup ? { showAll: false, max: 0 } : shared;
          // if current shared exists, keep, so that updates don't close something opened
          shared.showAll =
            row.shared && distance === 0 ? row.shared.showAll : shared.showAll;
          shared.max += 1;
          row.distance = distance;
          row.shared = shared;

          row.showFeatureName = newGroup;
          last = newGroup ? row.name : last;
        }
        return tmp;
      }),
      // cache across subscribers
      ops.shareReplay(1),
    );

    this.reduceFeatures$ = combineLatest([
      this.rereduceFeatures$,
      this.displayFeatures$,
    ]).pipe(
      // filter out invisible features, as otherwise the virtual viewport will fail
      ops.map(([_, d]) =>
        d.filter(
          (f) => f.distance <= 5 || f.shared.max <= 10 || f.shared.showAll,
        ),
      ),
      // gradually display features so we don't overload the dom
      // FUTURE this doesn't apply when expanding a specific feature with many values
      ops.switchMap((d) => {
        const per = 5;
        const delay = 10;
        return interval(delay).pipe(
          ops.take(d.length / per + 1),
          ops.map(() => {
            this.currently_displayed += per;
            return d.slice(0, this.currently_displayed);
          }),
        );
      }),
    );
  }

  /** expand a set of compressed entries for a given feature in the table */
  doExpandRow(row: ShowFeature) {
    row.shared.showAll = !row.shared.showAll;
    this.rereduceFeatures$.next(true);
  }

  trackBy(idx: number, feat: ShowFeature) {
    return idx.toString() + feat.name + feat.value + feat.type;
  }

  protected toggleCaseSensitivity() {
    this.caseSensitivity$.next(!this.caseSensitivity$.value);
  }

  newTagAddedToFeature($event: components["schemas"]["FeatureValueTag"]) {
    this.entity.featureAddedTags$.next($event);
  }

  /*Execute a compound search for all the selected features. */
  searchForSelectedFeatures() {
    const termParams = Array<string>();
    this.currentSelectedFeatures().forEach((fv: FeatureValue) => {
      termParams.push(`features_map.${fv.name}:${escapeValue(fv.value)}`);
    });
    // The actual term query are space seperated values.
    const termQuery = termParams.join(" ");
    this.router.navigate(["/pages/binaries/explore"], {
      queryParams: { term: termQuery },
    });
  }

  /*Track what feature values are ticked/unticked on the feature table so they can be searched.*/
  updateSelectedFeatures(
    event: Event,
    featureName: string,
    featureValue: string,
  ) {
    // If Feature name and value are invalid return
    if (!featureName || !featureValue) {
      return;
    }

    const isChecked = (event.target as HTMLInputElement)?.checked
      ? true
      : false;
    // If we just unchecked the checkbox remove the feature.
    if (!isChecked) {
      // Remove from pivot as well
      this.pivotService.removeSelected({
        feature_name: featureName,
        feature_value: featureValue,
      });

      this.currentSelectedFeatures.update((val: FeatureValue[]) => {
        return [
          ...val.filter(
            (v) => v.name != featureName || v.value != featureValue,
          ),
        ];
      });
      return;
    }

    // Add to pivot as well
    this.pivotService.setSelected({
      feature_name: featureName,
      feature_value: featureValue,
    });

    // Add the feature to the list of features
    this.currentSelectedFeatures.update((val: FeatureValue[]) => {
      return [...val, { name: featureName, value: featureValue }];
    });
  }

  isAlreadyTicked(featureName: string, featureValue: string): boolean {
    return this.currentSelectedFeatures().some(
      (fv) => fv.name === featureName && fv.value === featureValue,
    );
  }

  /**
   * Encodes a feature part to a searchable term.
   */
  protected encodePartToTerm(part: ShowFeature["XPartsBinaries"][0]): string {
    // Some part names are actually OpenSearch analyzers and aren't actual values:
    const PART_ANALYZERS = {
      filepath_unix: "filepath.tree",
      filepath_unixr: "filepath.tree_reversed",
    };

    const partName = PART_ANALYZERS[part.part] || part.part;

    return "features.enriched." + partName + ":" + escapeValue(part.value);
  }
}
