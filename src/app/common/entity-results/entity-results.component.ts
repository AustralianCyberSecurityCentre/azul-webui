import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  signal,
  SimpleChanges,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { Router } from "@angular/router";
import {
  faBackwardStep,
  faForwardStep,
} from "@fortawesome/free-solid-svg-icons";
import { AxiosError } from "axios";
import { Observable, of, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import { EntitySearchComponent } from "src/app/common/entity-search/entity-search.component";

import { components } from "src/app/core/api/openapi";
import { EntityFindWithPurgeExtras } from "src/app/core/api/state";
import { Entity } from "src/app/core/services";
import { ButtonType } from "src/lib/flow/button/button.component";

export type SortOption = { title: string; sort: string; sort_asc: string };
interface HashEntry {
  sha256: string;
  track_link: string;
  author_name: string;
  author_category: string;
  timestamp: string;
}

/**page for allowing search over all entities*/
@Component({
  selector: "azco-entity-results",
  templateUrl: "./entity-results.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntityResultsComponent implements OnInit, OnChanges, OnDestroy {
  private router = inject(Router);
  private entityService = inject(Entity);

  dbg = (...d) => console.info("EntityResultsComponent:", ...d);
  err = (...d) => console.error("EntityResultsComponent:", ...d);

  private cd = inject(ChangeDetectorRef);

  protected faBackwardStep = faBackwardStep;
  protected faForwardStep = faForwardStep;

  @ViewChild("entitySearch", { read: EntitySearchComponent })
  protected entitySearch: EntitySearchComponent;
  protected ButtonType = ButtonType;
  /**all found entities*/
  protected find$: Observable<EntityFindWithPurgeExtras>;

  sortOptions: { [short: string]: SortOption } = {
    newest_sourced: {
      title: "Newest",
      sort: "source.timestamp",
      sort_asc: "false",
    },
    relevance: { title: "Relevance", sort: "_score", sort_asc: "false" },
  };

  countOptions = ["50", "500", "1000", "all"];

  private forceEmptySearch: boolean = false;
  private entitySearchSub!: Subscription;
  noSearch: boolean = false;

  // pagination variables
  protected pageCurrentPageSignal: WritableSignal<number> = signal(0);
  protected pageCurrentBinariesSignal: WritableSignal<number> = signal(0);
  protected pageAllHashes: { [key: number]: HashEntry } = {}; // all hashes collected so far
  protected pageDisplayBinariesSignal: WritableSignal<number> = signal(50); // how many binaries to render in binary table
  protected pageNextKeySignal: WritableSignal<string> = signal(""); // 'after' key to send for next page
  protected pageEstimateBinariesSignal: WritableSignal<number> = signal(0); // number of binaries
  protected pageLoadingSignal: WritableSignal<boolean> = signal(false); // currently fulfilling a pagination request
  protected pageMaxSignal: WritableSignal<number | null> = signal(null); // only know actual max page when reached
  protected paginationActiveSignal: WritableSignal<boolean> = signal(false);

  // Match md5, sha1, sha256, sha512
  private match_hashes =
    /^(?:[^0-9a-f]|^)([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/;

  // used to indicate a search for parents/children of an entity is required
  @Input() familyFind?: boolean = false;
  // indicates whether we are searching for parents or children of a given entity
  @Input() isParent?: boolean = false;
  // sha256 of a calling entity used for comparing binaries
  // with the caller or using the caller in a search for parents/children
  @Input() originalSha256?: string | undefined;
  @Input() eType?: "parents" | "children" | undefined;
  @Input() sortOption: string | "newest_sourced";
  @Input() countOption: string | "50";
  @Input() termOption: string | "";
  @Input() forceEmptySearchOption: boolean | true;

  ngOnInit(): void {
    this.entitySearchSub = this.entityService
      .onEntitySearchTriggered()
      .subscribe(() => {
        this.doSearch();
        this.cd.detectChanges();
      });

    this.clearPagination();
    this.doSearch();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      (changes["sortOption"] && this.sortOption) ||
      (changes["countOption"] && this.countOption)
    ) {
      this.doSearch();
    }
  }

  ngOnDestroy(): void {
    this.clearPagination();
    if (this.entitySearchSub) {
      this.entitySearchSub.unsubscribe();
    }
  }

  protected clearPagination() {
    this.pageCurrentPageSignal.set(0);
    this.pageCurrentBinariesSignal.set(0);
    this.pageAllHashes = {}; // all hashes collected so far
    this.pageDisplayBinariesSignal.set(50); // how many binaries to render in binary table
    this.pageNextKeySignal.set(""); // 'after' key to send for next page
    this.pageEstimateBinariesSignal.set(0); // number of binaries
    this.pageLoadingSignal.set(false);
    this.pageMaxSignal.set(null);
    this.find$ = of({ items_count: 0, items: [] });
    this.noSearch = true;
  }

  private getNonDefault(d: { [key: string]: unknown }): {
    [key: string]: unknown;
  } {
    const p: { [key: string]: unknown } = {};

    if (d.term) {
      p.term = d.term;
    }
    if (d.sort) {
      p.sort = d.sort;
    }
    if (d.count) {
      p.count = d.count;
    }

    if ((d.source_depth as number) >= 0) {
      p.source_depth = d.source_depth;
    }

    this.dbg("non default", d, p);
    return p;
  }

  protected onSubmit() {
    this.entitySearch.hideSuggestions();
    this.forceEmptySearch = true;
    const tmp = this.getNonDefault({
      sort: this.sortOption,
      term: this.termOption,
      count: this.countOption,
    });
    this.dbg("navigating with", tmp);
    this.router.navigate([], { queryParams: tmp });
    this.doSearch();
  }

  private doSearch() {
    this.clearPagination();
    // turn query params into params we can send via api
    const c: { [key: string]: unknown } = {};
    c.max_entities = 50;
    const sortOption =
      this.sortOptions[this.sortOption] || this.sortOptions["newest_sourced"];
    c.sort = sortOption.sort;
    c.sort_asc = sortOption.sort_asc;
    c.max_entities = this.countOption;
    this.forceEmptySearch = this.forceEmptySearchOption;
    const trimmedQuery = this.termOption;
    const paramsAdded = trimmedQuery !== "";
    this.dbg("incoming query params", c);

    this.dbg(
      `forceEmpty ${this.forceEmptySearch}, term: ${c?.term}, params added: ${paramsAdded}`,
    );
    // Don't search if the search field is empty and no query params are set, unless user clicks submit without an override.
    if (!this.forceEmptySearch && !paramsAdded && trimmedQuery.length === 0) {
      this.noSearch = true;
      return c;
    }
    this.noSearch = false;
    if (c.max_entities == "all") {
      this.paginationActiveSignal.set(true);
      this.switchPage(0);
      return;
    }
    this.find$ = this.getFind$(c, trimmedQuery, []);
  }

  private getFind$(
    c: { [key: string]: unknown },
    trimmedQuery: string,
    hashes: {
      sha256: string;
      track_link?: string;
      author_name?: string;
      timestamp?: string;
    }[],
  ) {
    let query_body: string[] | undefined = undefined;

    // update results observable with new api call
    if (hashes.length > 0) {
      c.term = trimmedQuery;
      query_body = hashes.map((h) => h.sha256);
    } else if (this.match_hashes.test(trimmedQuery)) {
      // terms query is actually just a hash of some sort
      query_body = [trimmedQuery];
    } else {
      c.count_entities = "true";
      c.term = trimmedQuery;
    }
    return this.entityService.find(c, query_body).pipe(
      ops.map((res: components["schemas"]["EntityFind"]) => {
        const enrichedItems = res.items.map((item) => {
          // Find by sha256 or key if there is no sha256 because the item doesn't exist
          const itemFindKey = item.sha256 ? item.sha256 : item.key;
          const extra:
            | {
                track_link?: string;
                author_name?: string;
                author_category?: string;
                timestamp?: string;
              }
            | undefined = hashes.find((h) => h.sha256 === itemFindKey);
          return {
            ...item,
            track_link: extra?.track_link,
            author_name: extra?.author_name,
            author_category: extra?.author_category,
            timestamp: extra?.timestamp,
          };
        });

        return { ...res, items: enrichedItems } as EntityFindWithPurgeExtras;
      }),
      ops.catchError((err: AxiosError) => {
        if (err?.response?.status === 422) {
          return of<components["schemas"]["EntityFind"]>({
            items: [],
            items_count: 0,
          });
        }
        throw err;
      }),
    ) as Observable<EntityFindWithPurgeExtras>;
  }

  protected switchPage(page_number: number) {
    const supported_pages =
      Object.keys(this.pageAllHashes).length / this.pageDisplayBinariesSignal();

    if (this.pageLoadingSignal()) {
      console.error("not possible to render page", page_number);
      return;
    }

    if (
      this.pageNextKeySignal() !== undefined &&
      supported_pages < page_number + 1
    ) {
      const c: { [key: string]: unknown } = { term: this.termOption };

      c.num_binaries = this.pageDisplayBinariesSignal();
      c.family_find = this.familyFind;
      c.family_sha256 = this.originalSha256;
      c.parent = this.isParent;

      const b: { [key: string]: unknown } = { after: this.pageNextKeySignal() };

      this.dbg(
        "must retrieve next pagination from server",
        this.pageNextKeySignal(),
      );
      this.pageLoadingSignal.set(true);

      const endpoint = this.familyFind
        ? this.isParent
          ? this.entityService.findPageableParents
          : this.entityService.findPageableChildren
        : this.entityService.findPageable;

      const fallback = this.familyFind
        ? ({
            items: [],
            after: "",
            total: 0,
          } as components["schemas"]["EntityFindSimpleFamily"])
        : ({
            items: [],
            after: "",
            total: 0,
          } as components["schemas"]["EntityFindSimple"]);

      this.find$ = endpoint.call(this.entityService, c, b).pipe(
        ops.catchError((err: AxiosError) => {
          if (err?.response?.status === 422) {
            return of(fallback);
          }
          throw err;
        }),
        ops.withLatestFrom(of(page_number)),
        ops.mergeMap(([d, page]) => {
          this.pageNextKeySignal.set(d.after);
          this.dbg(
            "retrieved next page from server",
            this.pageNextKeySignal(),
            page,
          );
          if (d.total > 0) {
            this.pageEstimateBinariesSignal.set(d.total);
          }

          this.dbg("retrieved pagination for items", d.items.length);

          if (d.items.length < this.pageDisplayBinariesSignal()) {
            this.dbg("finished pagination");
            this.pageNextKeySignal.set(null);
            this.pageMaxSignal.set(page_number);
          }

          let start_index = this.pageDisplayBinariesSignal() * page;

          for (const item of d.items) {
            this.pageAllHashes[start_index] = {
              sha256: item.sha256,
              track_link: item.track_link ?? "",
              author_name: item.author_name ?? "",
              author_category: item.author_category ?? "",
              timestamp: item.timestamp ?? "",
            };
            start_index += 1;
          }

          return this.renderPage(page_number);
        }),
        ops.tap(() => {
          this.pageLoadingSignal.set(false);
        }),
      );
      return;
    }

    this.dbg("render page", page_number);
    this.find$ = this.renderPage(page_number);
  }

  protected renderPage(page_number: number) {
    // render with current known hashes for the page
    const start = this.pageDisplayBinariesSignal() * page_number;
    const end = this.pageDisplayBinariesSignal() * (page_number + 1);

    const hashes: {
      sha256: string;
      track_link?: string;
      author_name?: string;
      author_category?: string;
      timestamp?: string;
    }[] = [];

    for (let i = start; i < end; i++) {
      const entry = this.pageAllHashes[i];
      if (entry) {
        hashes.push({
          sha256: entry.sha256,
          track_link: entry.track_link,
          author_name: entry.author_name,
          author_category: entry.author_category,
          timestamp: entry.timestamp,
        });
      }
    }
    this.pageCurrentBinariesSignal.set(hashes.length);
    if (hashes.length == 0) {
      return of({ items_count: 0, items: [] });
    }
    this.pageCurrentPageSignal.set(page_number);
    this.dbg(
      "switch to next page",
      this.pageCurrentPageSignal(),
      this.pageNextKeySignal(),
    );

    return this.getFind$(
      { max_entities: this.pageDisplayBinariesSignal() },
      this.termOption,
      hashes,
    );
  }
}
