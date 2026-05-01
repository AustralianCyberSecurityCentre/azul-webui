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
import {
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faSpinner,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { ApiService } from "src/app/core/api/api.service";
import { components, paths } from "src/app/core/api/openapi";
import { Entity, EntityWrap, Nav, Security } from "src/app/core/services";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";
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
            return;
          }
          ret.push(this.entityService.entity(entityId));
        }
        return ret;
      }),
      // redraw entropy graphs
      ops.tap(() =>
        setTimeout(() => this.nav.windowSizeChange$.next(null), 200),
      ),
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

    let features: Set<string>;
    let values: Map<string, Set<string>>;
    let entities: Map<string, Set<string>>;
    this.featureData$ = this.entities$.pipe(
      ops.tap(() => {
        features = new Set<string>();
        values = new Map<string, Set<string>>();
        entities = new Map<string, Set<string>>();
      }),
      ops.mergeAll(),
      // as const fixes tuple
      ops.mergeMap((d) =>
        d.rawFeatures$.pipe(ops.map((f) => [f, d.sha256] as const)),
      ),
      ops.tap(([f, id]) => {
        for (const row of f) {
          features.add(row.name);
          if (!values.has(row.name)) {
            values.set(row.name, new Set());
          }
          values.get(row.name).add(row.value.toString());
          const fv = row.name + row.value;
          if (!entities.has(fv)) {
            entities.set(fv, new Set());
          }
          entities.get(fv).add(id);
        }
      }),
      ops.map((_d) => {
        const tValues = new Map<string, string[]>();
        for (const [k, v] of values) {
          tValues.set(k, Array.from(v).sort());
        }
        return {
          features: Array.from(features).sort(),
          values: tValues,
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
