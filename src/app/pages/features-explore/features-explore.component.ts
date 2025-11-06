import { Location } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Observable, ReplaySubject, Subscription, interval, of } from "rxjs";
import * as ops from "rxjs/operators";

import { Api, Feature } from "src/app/core/services";
import { escapeValue } from "../../core/util";
import { components } from "src/app/core/api/openapi";
import { FeatureWithParsedProperties } from "src/app/core/api/state";

type SearchFilter = {
  term?: string;
  author?: string;
  author_version?: string;
};

/** Static options for a search query. */
interface SearchFilterQueryOptions {
  features?: string;
}

/**
 * Parameters for an explore search query.
 *
 * Distinct from SearchFilter as this is used to populate query params.
 */
interface SearchFilterQuery extends SearchFilterQueryOptions {
  author_version?: string;
  author?: string;
}

/**page for displaying all features*/
@Component({
  selector: "app-features-explore",
  templateUrl: "./features-explore.component.html",
  styleUrls: ["./features-explore.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeaturesExploreComponent implements OnInit, OnDestroy {
  featureService = inject(Feature);
  private router = inject(Router);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  api = inject(Api);

  protected faMagnifyingGlass = faMagnifyingGlass;

  protected escapeValue = escapeValue;
  protected features$: Observable<FeatureWithParsedProperties[]>;
  protected filteredFeatures$: Observable<FeatureWithParsedProperties[]>;
  protected plugins$: Observable<
    readonly components["schemas"]["LatestPluginWithVersions"][]
  >;
  protected authors$: Observable<string[]>;
  protected author_versions$: Observable<readonly string[]>;

  protected term = new FormControl("");
  protected author = new FormControl("");
  protected authorVersion = new FormControl("");

  /** number of rows currently displayed */
  protected currently_displayed = 0;

  private noCountUpdate: boolean = false;

  // Subscriptions
  private routeParamsSub: Subscription;
  private binaryCountSub: Subscription;
  private valueCountSub: Subscription;

  ngOnInit(): void {
    this.plugins$ = this.api.pluginGetAll();
    this.authors$ = this.plugins$.pipe(
      ops.map((d) => {
        return d
          .map((x) => x.newest_version.name)
          .filter((x, i, s) => s.indexOf(x) === i);
      }),
    );

    // Load all current features.
    this.features$ = this.featureService.getAllFeatures$().pipe(
      ops.map((fs_raw) => {
        const fs = fs_raw as FeatureWithParsedProperties[] | undefined;

        if (fs === undefined) {
          return [];
        }

        for (const feat of fs) {
          feat.XDescriptions = this.getDescriptions(feat.descriptions);
          feat.XAuthors = this.getAuthors(feat.descriptions);
          feat.XTags = feat.tags?.join(" | ");
          feat.XNumBinaries$ = new ReplaySubject<number>(1);
          feat.XNumValues$ = new ReplaySubject<number>(1);
        }

        return fs;
      }),
      ops.shareReplay(1),
    );

    // On loading component take route parameters.
    this.routeParamsSub = this.route.queryParamMap.subscribe(
      (routeParams: ParamMap) => {
        this.term.setValue(routeParams.get("term") || "");
        this.author.setValue(routeParams.get("author") || "");
        this.authorVersion.setValue(routeParams.get("author_version") || "");

        // Following two observables must be setup after the route params are known
        this.author_versions$ = this.plugins$.pipe(
          ops.combineLatestWith(
            this.author.valueChanges.pipe(ops.startWith(this.author.value)),
          ),
          ops.map(
            ([versions, author]: [
              readonly components["schemas"]["LatestPluginWithVersions"][],
              string,
            ]) => {
              return versions.find((x) => x.newest_version.name == author)
                ?.versions;
            },
          ),
          // When the authorVersions dropdown is created, it creates a new subscription to this pipe due to `| async`
          // (author.value is also stale when this dropdown is created)
          // using shareReplay, we can share the result from the first pipeline run to the newly spawned subscription
          ops.shareReplay(1),
        );

        this.filterFeatures(
          this.term.value,
          this.author.value,
          this.authorVersion.value,
        );
      },
    );
  }

  ngOnDestroy(): void {
    this.binaryCountSub?.unsubscribe();
    this.valueCountSub?.unsubscribe();
    this.routeParamsSub?.unsubscribe();
  }

  private filterFeatures(
    initialTerm: string,
    initialAuthor: string,
    initialAuthorVersion: string,
  ) {
    this.filteredFeatures$ = this.features$.pipe(
      // Emmit an array containing the latest values for features, author, authorVersion, term
      ops.combineLatestWith(
        this.author.valueChanges.pipe(ops.startWith(initialAuthor)),
        this.authorVersion.valueChanges.pipe(
          ops.startWith(initialAuthorVersion),
        ),
        this.term.valueChanges.pipe(ops.startWith(initialTerm)),
      ),
      ops.map(([feats, author, authorVersion, term]) => {
        const searchQuery: SearchFilter = {};
        if (author) {
          searchQuery["author"] = author;
          if (authorVersion) {
            searchQuery["author_version"] = authorVersion;
          }
        }
        if (term) {
          searchQuery["term"] = term;
        }

        return [feats, searchQuery];
      }),
      ops.debounceTime(500),
      ops.tap(
        ([_feats, filter]: [FeatureWithParsedProperties[], SearchFilter]) => {
          // Save URL history
          const newUrl = this.router
            .createUrlTree([], { relativeTo: this.route, queryParams: filter })
            .toString();
          this.location.go(newUrl);
        },
      ),
      ops.map(([feats, filter]) => {
        if (feats === null) {
          return null;
        }
        if (feats.length === 0) {
          return [];
        }
        if (filter.term) {
          feats = feats.filter((f) => {
            return (
              f.name.includes(filter.term) ||
              f?.descriptions?.filter((d) => {
                return d?.desc.includes(filter.term);
              }).length > 0 ||
              //filter authors by how text is displayed
              this.getAuthors(f?.descriptions).filter((s) =>
                s.includes(filter.term),
              ).length > 0
            );
          });
        }
        // Filter out the features with a valid author, if the author_version filter is set apply it as well.
        if (filter.author && filter.author?.length > 0) {
          feats = feats.filter((f) =>
            f?.descriptions?.some(
              (d) =>
                d.author_name === filter.author &&
                (!filter.author_version?.length ||
                  filter.author_version?.length === 0 ||
                  d.author_version === filter.author_version),
            ),
          );
        }
        // Update counts
        if (!this.noCountUpdate) {
          const entData = feats.map((r) => {
            return { name: r.name, cb: r.XNumBinaries$ };
          });
          const valData = feats.map((r) => {
            return { name: r.name, cb: r.XNumValues$ };
          });
          this.binaryCountSub?.unsubscribe();
          this.valueCountSub?.unsubscribe();
          if (entData.length > 0) {
            this.binaryCountSub = this.featureService.featuresCountBinaries$(
              entData,
              filter.author,
              filter.author_version,
            );
          }
          if (valData.length > 0) {
            this.valueCountSub = this.featureService.featuresCountValues$(
              valData,
              filter.author,
              filter.author_version,
            );
          }
        }
        this.noCountUpdate = false;
        return feats;
      }),
      // gradually display features so we don't overload the dom
      ops.switchMap((d) => {
        const per = 50;
        const delay = 200;
        if (d == null) {
          return of(null);
        }
        // Reset display counter
        this.currently_displayed = 0;

        return interval(delay).pipe(
          ops.take(d.length / per + 1),
          ops.map(() => {
            this.currently_displayed += per;
            return d.slice(0, this.currently_displayed);
          }),
        );
      }),
      ops.shareReplay(1),
    );
  }

  private getDescriptions(
    descs: readonly components["schemas"]["FeatureDescription"][],
  ): string[] {
    const ret = [];
    for (const desc of descs || []) {
      if (ret.indexOf(desc.desc) >= 0) {
        continue;
      }
      ret.push(desc.desc);
    }
    ret.sort();
    return ret;
  }

  private getAuthors(
    descs: readonly components["schemas"]["FeatureDescription"][],
  ): string[] {
    const ret = [];
    for (const desc of descs || []) {
      let uniq = "";
      if (desc.author_type != "plugin") {
        uniq = `${desc.author_type}_${desc.author_name}`;
      } else {
        uniq = `${desc.author_name}`;
      }
      if (ret.indexOf(uniq) >= 0) {
        continue;
      }
      ret.push(uniq);
    }
    ret.sort();
    return ret;
  }

  trackBy(_i, feat: FeatureWithParsedProperties) {
    return feat.name;
  }

  addAuthorFilter(params: SearchFilterQueryOptions): SearchFilterQuery {
    return {
      ...params,
      ...(this.author.value && { author: this.author.value }),
      ...(this.authorVersion.value && {
        author_version: this.authorVersion.value,
      }),
    };
  }
}
