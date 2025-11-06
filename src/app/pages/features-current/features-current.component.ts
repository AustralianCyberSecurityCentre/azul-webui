import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  faBackwardStep,
  faForwardStep,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { BehaviorSubject, Observable, ReplaySubject, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import {
  FeatureValuesWithNumBinaries,
  FeatureValueWithNumBinaries,
} from "src/app/core/api/state";
import { Feature, Security } from "src/app/core/services";
import { escapeValue } from "src/app/core/util";
import { ButtonType } from "src/lib/flow/button/button.component";
export type SortOption = {
  title: string;
  sort_asc: boolean;
};

export type CountOption = {
  title: string;
  count: number;
};

const DEFAULT_VALUE_COUNT = 50;

/**page for displaying values for current feature*/
@Component({
  selector: "app-features-current",
  templateUrl: "./features-current.component.html",
  styleUrls: ["./features-current.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeaturesCurrentComponent implements OnInit, OnDestroy {
  securityService = inject(Security);
  featureService = inject(Feature);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected faMagnifyingGlass = faMagnifyingGlass;
  protected faBackwardStep = faBackwardStep;
  protected faForwardStep = faForwardStep;
  protected ButtonType = ButtonType;
  protected escapeValue = escapeValue;

  featureId$: Observable<string>;
  featureValues$: Observable<FeatureValuesWithNumBinaries>;
  XNumValues$: Observable<string>;

  triggerLoadNewData$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  triggerLoadPreviousPage$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  term: string;
  currentUrl: string = "";
  isDoneLoadingSignal: WritableSignal<boolean> = signal(false);
  isDoneLoading$: Observable<boolean> = toObservable(this.isDoneLoadingSignal);
  isSortAscending: WritableSignal<boolean> = signal(true);
  isSearchComplete: WritableSignal<boolean> = signal(false);
  isTotalCountAnApproximation: WritableSignal<boolean> = signal(false);
  valueCount: WritableSignal<number> = signal(DEFAULT_VALUE_COUNT);
  nextPageAfterValue: WritableSignal<string> = signal("");

  currentPageSignal: WritableSignal<number> = signal(1);
  highestPageNumber: WritableSignal<number> = signal(-1);

  totalNumberOfFeatureValuesApprox: WritableSignal<number> = signal(0);
  totalNumberOfFeatureValuesActual: Signal<number> = computed(() => {
    if (this.totalNumberOfFeatureValuesApprox() === 0) {
      return 0;
    }
    // Check how many values are loaded so far.
    if (
      this.numberOfFeatureValuesSoFar() >=
      this.totalNumberOfFeatureValuesApprox()
    ) {
      if (this.isSearchComplete()) {
        // Search is complete so the sum of all the values so far is the total
        return this.numberOfFeatureValuesSoFar();
      } else {
        // Search isn't complete so there is at least one more value.
        return this.numberOfFeatureValuesSoFar() + 1;
      }
    }
    // Keep using the approximation until there are more values found then what was approximated.
    return this.totalNumberOfFeatureValuesApprox();
  });
  numberOfFeatureValuesSoFar: WritableSignal<number> = signal(0);
  totalNumberOfPages: Signal<number> = computed(() => {
    if (this.totalNumberOfFeatureValuesActual() == 0) {
      return 0;
    }
    return Math.ceil(
      this.totalNumberOfFeatureValuesActual() / this.valueCount(),
    );
  });

  allPageFeatureInfo: FeatureValuesWithNumBinaries[] =
    new Array<FeatureValuesWithNumBinaries>();

  author: string;
  author_version: string;

  sortOptions: SortOption[] = [
    { title: "ascending", sort_asc: true },
    { title: "descending", sort_asc: false },
  ];

  valueCountOptions: CountOption[] = [
    { title: "50", count: 50 },
    { title: "100", count: 100 },
    { title: "500", count: 500 },
  ];

  // Subscriptions
  featuresCountValuesSub: Subscription;
  featureValuesCountBinariesSub: Subscription;

  ngOnDestroy(): void {
    this.featuresCountValuesSub?.unsubscribe();
    this.featureValuesCountBinariesSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.featureId$ = this.route.params.pipe(
      ops.map((p) => p.feature),
      ops.shareReplay(1),
    );

    this.XNumValues$ = this.featureId$.pipe(
      ops.mergeMap((p) => {
        const data = { name: p, cb: new ReplaySubject<number>(1) };
        this.featuresCountValuesSub?.unsubscribe();
        this.featuresCountValuesSub = this.featureService.featuresCountValues$([
          data,
        ]);
        return data.cb;
      }),
      ops.map((d) => d.toString()),
      ops.shareReplay(1),
    );
    this.router.setUpLocationChangeListener();
    this.featureValues$ = this.route.queryParamMap
      .pipe(
        ops.debounceTime(200),
        ops.tap((d) => (this.term = d.get("term") || "")),
        ops.tap((d) => (this.author = d.get("author") || "")),
        ops.tap((d) => (this.author_version = d.get("author_version") || "")),
        ops.tap((d) =>
          this.isSortAscending.set(
            d.get("isSortAscending") === "true" ||
              d.get("isSortAscending") == undefined,
          ),
        ),
        ops.tap((d) => {
          let paramValueCount = Number(d.get("valueCount"));
          // If the provided value is not in the list of available choices use the default
          if (
            !this.valueCountOptions.some(
              (option) => option.count === paramValueCount,
            )
          ) {
            paramValueCount = DEFAULT_VALUE_COUNT;
          }
          this.valueCount.set(paramValueCount);
        }),
      )
      .pipe(
        ops.switchMap(() => this.featureId$),
        // Clear paginate on route changes, to go back to page one (this triggers if featureId changes or any of the route params).
        ops.tap((_d) => this.clearPaginate()),
        ops.combineLatestWith(this.triggerLoadNewData$),
        ops.tap(([_d, _triggerValue]) => {
          this.isDoneLoadingSignal.set(false);
        }),
        ops.switchMap(([d, _triggerValue]) => {
          return this.featureService.featureRead(
            d,
            this.term,
            this.isSortAscending(),
            this.author,
            this.author_version,
            this.valueCount(),
            this.nextPageAfterValue(),
          );
        }),
        ops.combineLatestWith(this.triggerLoadPreviousPage$),
        ops.tap(([_d_raw, _triggerValue]) => {
          this.isDoneLoadingSignal.set(false);
        }),
        ops.map(([d_raw, _triggerValue]) => {
          const d = d_raw as FeatureValuesWithNumBinaries;
          if (d.is_search_complete) {
            this.isSearchComplete.set(true);
          }
          // Set after value for queries that increase the page number.
          if (this.currentPageSignal() > this.highestPageNumber()) {
            this.nextPageAfterValue.set(d.after);
            this.highestPageNumber.set(this.currentPageSignal());
          } else {
            this.isDoneLoadingSignal.set(true);
            return this.allPageFeatureInfo[this.currentPageSignal() - 1];
          }
          // Set the total if it's available in the response
          if (d.total !== null && d.total !== undefined) {
            this.totalNumberOfFeatureValuesApprox.set(d.total);
            this.isTotalCountAnApproximation.set(d.is_total_approx);
          }

          for (const row of d.values) {
            row.XNumBinaries$ = new ReplaySubject<number>(1);
          }
          const data = d.values.map((r: FeatureValueWithNumBinaries) => {
            return { name: d.name, value: r.value, cb: r.XNumBinaries$ };
          });
          this.featureValuesCountBinariesSub?.unsubscribe();
          this.featureValuesCountBinariesSub =
            this.featureService.featureValuesCountBinaries$(data, "", "");
          this.allPageFeatureInfo.push(d);
          this.numberOfFeatureValuesSoFar.update(
            (value) => value + d.values.length,
          );
          this.isDoneLoadingSignal.set(true);
          return this.allPageFeatureInfo[this.currentPageSignal() - 1];
        }),
        ops.shareReplay(1),
      );
  }

  valueCountSelectionChanged(event: Event): void {
    const target = event.target as HTMLSelectElement;
    let paramValueCount = Number(target.value);
    if (Number.isNaN(paramValueCount)) {
      paramValueCount = DEFAULT_VALUE_COUNT;
    }
    this.router.navigate([], {
      queryParams: {
        term: this.term,
        isSortAscending: this.isSortAscending(),
        valueCount: paramValueCount,
      },
    });
  }

  isSortAscendingSelectionChanged(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.router.navigate([], {
      queryParams: {
        term: this.term,
        isSortAscending: target.value,
        valueCount: this.valueCount(),
      },
    });
  }

  searchChange() {
    this.router.navigate([], {
      queryParams: {
        term: this.term,
        isSortAscending: this.isSortAscending(),
        valueCount: this.valueCount(),
      },
    });
  }

  incrementPage() {
    this.currentPageSignal.update((value) => value + 1);
    if (this.currentPageSignal() > this.highestPageNumber()) {
      this.triggerLoadNewData$.next(!this.triggerLoadNewData$.value);
    } else {
      this.triggerLoadPreviousPage$.next(!this.triggerLoadPreviousPage$.value);
    }
  }
  decrementPage() {
    this.currentPageSignal.update((value) => value - 1);
    this.triggerLoadPreviousPage$.next(!this.triggerLoadPreviousPage$.value);
  }

  clearPaginate() {
    /* Clears all the paginate related signals, ensure you don't update values that would trigger an update as that would cause an infinite loop.*/
    this.isDoneLoadingSignal.set(false);
    this.nextPageAfterValue.set("");
    this.currentPageSignal.set(1);
    this.highestPageNumber.set(-1);
    this.totalNumberOfFeatureValuesApprox.set(0);
    this.numberOfFeatureValuesSoFar.set(0);
    this.isSearchComplete.set(false);
    this.isTotalCountAnApproximation.set(false);
    this.allPageFeatureInfo = [];
  }
}
