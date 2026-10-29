import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { form } from "@angular/forms/signals";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "@app/core/api/api.service";
import { components, paths } from "@app/core/api/openapi";
import { FeatureWithDecodedValue } from "@app/core/api/state";
import { Entity, EntityWrap, Nav, Security } from "@app/core/services";
import {
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faSpinner,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
type FeatureData = {
  features: string[];
  values: Map<string, string[]>;
  entities: Map<string, Set<string>>;
};

type CommonStringSearchSizes = {
  max_bytes_to_read: number;
  take_n_strings: number;
};

const MaxByteToReadFactor = 10 * 1024 * 1024; // 10MiB
const MaxStringsFactor = 1000;
const searchSizes: Map<string, CommonStringSearchSizes> = new Map<
  string,
  CommonStringSearchSizes
>([
  [
    "default",
    {
      max_bytes_to_read: MaxByteToReadFactor,
      take_n_strings: MaxStringsFactor,
    },
  ],
  [
    "medium",
    {
      max_bytes_to_read: MaxByteToReadFactor * 2,
      take_n_strings: MaxStringsFactor * 5,
    },
  ],
  [
    "large",
    {
      max_bytes_to_read: MaxByteToReadFactor * 5,
      take_n_strings: MaxStringsFactor * 10,
    },
  ],
  [
    "max",
    {
      max_bytes_to_read: null,
      take_n_strings: MaxStringsFactor * 50,
    },
  ],
]);

enum CommonStringSearchType {
  IgnoreCase = "ignore case",
  CaseSensitive = "case sensitive",
}

interface StringFilter {
  filterValue: string;
  searchFilterType: CommonStringSearchType;
}

interface StringSearchSize {
  searchSize: string;
}

interface CommonFeatureFilter {
  enabled: boolean;
  numberOfEntitiesWithFeatures: string;
}

interface FeatData {
  values: Map<string, Set<string>>;
  entities: Map<string, Set<string>>;
}

@Component({
  selector: "app-entities-compare",
  templateUrl: "./entities-compare.component.html",
  styleUrls: ["./entities-compare.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesCompareComponent implements OnInit {
  private api = inject(ApiService);

  entityService = inject(Entity);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  securityService = inject(Security);
  private nav = inject(Nav);

  protected faTrashCan = faTrashCan;
  protected faCheck = faCheck;
  protected faSpinner = faSpinner;
  protected faCircleExclamation = faCircleExclamation;
  protected faCircleCheck = faCircleCheck;

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  protected searchSizes = searchSizes;
  protected CommonStringSearchType = CommonStringSearchType;

  protected stringFormSignal = signal<StringFilter>({
    filterValue: "",
    searchFilterType: CommonStringSearchType.IgnoreCase,
  });

  protected stringSearchSizeFormSignal = signal<StringSearchSize>({
    searchSize: "default",
  });

  protected stringFilterForm = form(this.stringFormSignal);
  protected stringSearchSizeForm = form(this.stringSearchSizeFormSignal);

  protected commonFeatureFilterSignal = signal<CommonFeatureFilter>({
    enabled: false,
    // Note this is changed to the total number of entities when the entities are loaded
    numberOfEntitiesWithFeatures: "1",
  });
  protected commonFeatureFilterForm = form(this.commonFeatureFilterSignal);
  protected commonFeatureFilter$: Observable<CommonFeatureFilter>;

  protected stringFilterObservable$ = toObservable(this.stringFormSignal);
  protected stringSearchSizeObservable$ = toObservable(
    this.stringSearchSizeFormSignal,
  );

  entities$: Observable<EntityWrap[]>;
  maxBytes$: Observable<number>;

  featureData$: Observable<FeatureData>;

  rawBinaries: WritableSignal<string[]> = signal([]);
  rawBinaries$: Observable<string[]>;
  // Only get common strings when there is exactly 2 binaries being compared.
  numberOfBinariesForCommonStrings: number = 2;
  commonStrings$: Observable<components["schemas"]["CommonBinaryStrings"]>;
  loadingCommonStringsSignal: WritableSignal<boolean> = signal(true);

  constructor() {
    this.commonFeatureFilter$ = toObservable(this.commonFeatureFilterSignal);
  }

  ngOnInit(): void {
    this.rawBinaries$ = this.route.queryParamMap.pipe(
      ops.map((d) => {
        this.rawBinaries.set(d.getAll("entity"));
        return this.rawBinaries();
      }),
      ops.shareReplay(1),
    );

    this.entities$ = this.rawBinaries$.pipe(
      // deduplicate and sort
      ops.map((sha256List) => Array.from(new Set(sha256List)).sort()),
      ops.map((d) => {
        const ret = [];
        for (const entityId of d) {
          if (!entityId) {
            console.error(
              "Entity is not set during comparison skipping binary",
            );
            return null;
          }
          ret.push(this.entityService.entity(entityId));
        }
        return ret;
      }),
      // redraw entropy graphs
      ops.tap((curEntities) => {
        setTimeout(() => this.nav.windowSizeChange$.next(null), 200);
        // Set the number of entities when filtering features to the max value initially
        this.commonFeatureFilterSignal.update((v) => {
          return {
            ...v,
            numberOfEntitiesWithFeatures: curEntities.length.toString(),
          };
        });
      }),
      ops.shareReplay(1),
    );

    this.maxBytes$ = this.entities$.pipe(
      ops.mergeAll(),
      ops.mergeMap((d) => d.entropy$),
      ops.filter((d) => !!d),
      ops.map((d) => d.block_count * d.block_size),
      ops.max((x, y) => (x > y ? x : y)),
      ops.shareReplay(1),
    );

    this.featureData$ = this.entities$.pipe(
      ops.mergeAll(),
      ops.mergeMap((d) =>
        d.rawFeatures$.pipe(ops.map((f) => [f, d.sha256] as const)),
      ),
      ops.scan<readonly [FeatureWithDecodedValue[], string], FeatData>(
        (acc, [features, id]) => {
          for (const row of features) {
            if (!acc.values.has(row.name)) {
              acc.values.set(row.name, new Set());
            }
            acc.values.get(row.name).add(String(row.value));

            const fv = `${row.name}${row.value}`;
            if (!acc.entities.has(fv)) {
              acc.entities.set(fv, new Set());
            }
            acc.entities.get(fv).add(id);
          }
          return acc;
        },
        {
          // A Map where the key is feature_name and the value is the set of feature_value's within the feature_name
          values: new Map<string, Set<string>>(),
          // A Map where the key is feature_name.feature_value and the value is a set of entities that match it.
          entities: new Map<string, Set<string>>(),
        },
      ),
      ops.combineLatestWith(this.commonFeatureFilter$),
      ops.map(([{ values, entities }, commonFeatures]) => {
        const sortedVals = new Map(
          [...values].map(([k, v]) => [k, [...v].sort()]),
        );

        // Filter out features and values that don't have enough common matches and are no longer needed.
        if (commonFeatures.enabled) {
          const numberOfEntitiesRequired = parseInt(
            commonFeatures.numberOfEntitiesWithFeatures,
            10,
          );
          // If int parsing fails return an unfiltered list.
          if (Number.isNaN(numberOfEntitiesRequired)) {
            console.error(
              "Number of entities that must be common to feature is un-expectedly NaN",
            );
            return {
              features: [...sortedVals.keys()].sort(),
              values: sortedVals,
              entities: entities,
            };
          }
          for (const featKey of sortedVals.keys()) {
            const newVals: string[] = [];
            for (const featVal of sortedVals.get(featKey)) {
              const setOfEntities = entities.get(`${featKey}${featVal}`);
              if (
                setOfEntities !== undefined &&
                setOfEntities.size >= numberOfEntitiesRequired
              ) {
                newVals.push(featVal);
              }
            }

            // Assign remaining values or remove feature all together if there is none left after filtering
            if (newVals.length === 0) {
              sortedVals.delete(featKey);
            } else {
              sortedVals.set(featKey, newVals);
            }
          }
        }
        return {
          features: [...sortedVals.keys()].sort(),
          values: sortedVals,
          entities: entities,
        };
      }),
      ops.shareReplay(1),
    );

    this.commonStrings$ = this.rawBinaries$.pipe(
      ops.filter((rb) => rb.length === this.numberOfBinariesForCommonStrings),
      ops.combineLatestWith(this.stringSearchSizeObservable$),
      ops.switchMap(([sha256s, sizeParams]) => {
        this.loadingCommonStringsSignal.set(true);
        const sp = this.searchSizes.get(sizeParams.searchSize);
        if (sp === undefined) {
          console.warn(
            "Common string search size could not be found using default.",
          );
          return this.api.getCommonStrings(sha256s[0], sha256s[1], {});
        }
        const params: paths["/api/v0/binaries/{sha256A}/{sha256B}/strings"]["get"]["parameters"]["query"] =
          {
            max_bytes_to_read: sp.max_bytes_to_read,
            take_n_strings: sp.take_n_strings,
          };
        return this.api.getCommonStrings(sha256s[0], sha256s[1], params);
      }),
      ops.tap(() => {
        this.loadingCommonStringsSignal.set(false);
      }),
      ops.filter((strings) => strings !== undefined),
      ops.combineLatestWith(this.stringFilterObservable$),
      ops.debounceTime(200),
      // Filter strings locally.
      ops.map(([strings, filtering]) => {
        if (filtering === undefined || filtering.filterValue.length === 0) {
          return strings;
        }
        let filteredStrings: string[];
        if (
          filtering.searchFilterType === CommonStringSearchType.CaseSensitive
        ) {
          filteredStrings = strings.strings.filter((v) =>
            v.includes(filtering.filterValue),
          );
        } else if (
          filtering.searchFilterType === CommonStringSearchType.IgnoreCase
        ) {
          filteredStrings = strings.strings.filter((v) =>
            v.toLowerCase().includes(filtering.filterValue.toLowerCase()),
          );
        } else {
          console.warn(
            `Failing to filter strings due to unrecognized filterType ${filtering.searchFilterType}`,
          );
          return strings;
        }
        const stringsResult: components["schemas"]["CommonBinaryStrings"] = {
          strings: filteredStrings,
          incomplete: strings.incomplete,
        };
        return stringsResult;
      }),
      ops.shareReplay(1),
    );
  }

  removeEntity(id: string) {
    const nexts = this.rawBinaries().filter((x) => x != id);
    this.router.navigate([], { queryParams: { entity: nexts } });
  }
}
