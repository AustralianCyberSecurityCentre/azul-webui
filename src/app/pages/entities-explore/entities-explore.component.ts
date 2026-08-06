import {
  ChangeDetectionStrategy,
  Component,
  inject,
  model,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from "@angular/core";
import { form, validate } from "@angular/forms/signals";
import { ActivatedRoute } from "@angular/router";
import {
  EntitySearchComponent,
  SearchFormInterface,
} from "@app/common/entity-search/entity-search.component";
import { EntityService } from "@app/core/entity.service";
import { ButtonType } from "@lib/flow/button/button.component";
import { Subscription } from "rxjs";

interface EntityExploreSearchForm {
  sort: string;
  count: string;
  forceEmptySearch: boolean;
}

export type SortOption = {
  title: string;
  sort: string;
  sort_asc: string;
};

/**page for allowing search over all entities*/
@Component({
  selector: "app-entities-explore",
  templateUrl: "./entities-explore.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesExploreComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private entityService = inject(EntityService);

  dbg = (...d) => console.info("BinariesExploreComponent:", ...d);
  err = (...d) => console.error("BinariesExploreComponent:", ...d);

  @ViewChild("entitySearch", { read: EntitySearchComponent })
  protected entitySearch: EntitySearchComponent;

  protected exploreSearchFormSignal = signal<EntityExploreSearchForm>({
    sort: "newest_sourced",
    count: "50",
    forceEmptySearch: true,
  });

  protected exploreSearchForm = form(this.exploreSearchFormSignal, (f) => {
    validate(f.count, ({ value }) => {
      if (this.countOptions.includes(value())) {
        return null;
      }
      return {
        kind: "InvalidCount",
        message: `Count must be one of the allowable values '${this.countOptions}'`,
      };
    });
  });

  protected termModel = model<SearchFormInterface>({ term: "" });

  protected ButtonType = ButtonType;
  /**params we can send to api to find entities*/
  private paramsSub: Subscription;

  sortOptions: { [short: string]: SortOption } = {
    newest_sourced: {
      title: "Newest",
      sort: "source.timestamp",
      sort_asc: "false",
    },
    relevance: { title: "Relevance", sort: "_score", sort_asc: "false" },
  };

  countOptions = ["50", "500", "1000", "all"];

  // Match md5, sha1, sha256, sha512
  private match_hashes =
    /^(?:[^0-9a-f]|^)([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/;

  ngOnInit(): void {
    this.paramsSub = this.route.queryParamMap.subscribe((map) => {
      const preParamForm = this.exploreSearchFormSignal();
      // update the pages form for parameters in url
      const term = map.get("term");
      if (term) {
        this.termModel.set({ term: term });
      }
      const sort = map.get("sort");
      if (sort) {
        preParamForm.sort = sort;
      }
      const count = map.get("count");
      if (count && this.countOptions.includes(count)) {
        preParamForm.count = count;
      }
      this.exploreSearchFormSignal.set(preParamForm);
      this.entityService.entityTriggerSearch();
    });
  }

  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();
  }

  protected onSubmit() {
    this.entitySearch.hideSuggestions();
    this.entityService.entityTriggerSearch();
  }
}
