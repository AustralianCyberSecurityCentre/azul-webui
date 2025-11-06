import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewChild,
  inject,
  OnDestroy,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { EntitySearchComponent } from "src/app/common/entity-search/entity-search.component";
import { EntityService } from "src/app/core/entity.service";
import { components } from "src/app/core/api/openapi";
import { ButtonType } from "src/lib/flow/button/button.component";

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

  protected termControl = new FormControl("");
  protected sortControl = new FormControl("newest_sourced");
  protected countControl = new FormControl("50");
  @Input() set countControlInput(control: FormControl) {
    this.countControl = control ?? new FormControl("");
  }

  protected searchParams: {
    term: string;
    count: string;
    sort: string;
    forceEmptySearch: boolean;
  } = {
    term: "",
    count: "",
    sort: "",
    forceEmptySearch: true,
  };
  protected ButtonType = ButtonType;
  /**params we can send to api to find entities*/
  private paramsSub: Subscription;
  /**all found entities*/
  protected find$: Observable<components["schemas"]["EntityFind"]>;

  protected termValid$ = new BehaviorSubject<boolean>(true);

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
  noSearch: boolean = false;

  // Match md5, sha1, sha256, sha512
  private match_hashes =
    /^(?:[^0-9a-f]|^)([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/;

  @Input() familyFind?: boolean;
  @Input() isParent?: boolean;
  @Input() entitySha256?: string;

  ngOnInit(): void {
    this.clearForm();
    this.paramsSub = this.route.queryParamMap.subscribe((map) => {
      // update the pages form for parameters in url
      const term = map.get("term");
      if (term) {
        this.termControl.setValue(term);
      }

      const sort = map.get("sort");
      if (sort) {
        this.sortControl.setValue(sort);
      }

      const count = map.get("count");
      if (count) {
        this.countControl.setValue(count);
      }
    });
  }

  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();
  }

  private clearForm() {
    this.termControl.setValue("");
    this.sortControl.setValue("newest_sourced");
    this.countControl.setValue("50");
  }

  protected onSubmit() {
    if (this.termControl.value) {
      this.searchParams.term = this.termControl.value;
    } else {
      this.searchParams.term = "";
    }
    this.searchParams.count = this.countControl.value;
    this.searchParams.sort = this.sortControl.value;
    this.searchParams.forceEmptySearch = true;
    this.entitySearch.hideSuggestions();
    this.forceEmptySearch = true;
    this.entityService.entityTriggerSearch();
  }
}
