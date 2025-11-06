import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";

import { HttpErrorResponse } from "@angular/common/http";
import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from "@angular/core";
import {
  AbstractControl,
  UntypedFormBuilder,
  UntypedFormGroup,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { BehaviorSubject, Subscription, of } from "rxjs";
import * as ops from "rxjs/operators";
import { Entity } from "src/app/core/services";
import { hexValidator } from "src/app/core/validation";
import { BaseCard } from "src/app/entity-cards/base-card.component";
import { ContinuousScroll } from "../continuous-scroll/continuous-scroll.class";
import { paths } from "src/app/core/api/openapi";
import { MultiPageResults } from "src/app/core/api/state";

@Component({
  selector: "az-content-search",
  templateUrl: "./entity-content-search.component.html",
  styleUrls: ["./entity-content-search.component.css"],
  standalone: false,
})
export class EntityContentSearchComponent
  extends BaseCard
  implements OnInit, OnDestroy
{
  private fb = inject(UntypedFormBuilder);
  private entityService = inject(Entity);

  // This shouldn't be seen by a user:
  help = "Enables searching of a file.";

  private TAKE_N_HITS = 1000;

  /** Handler for if a row entry has been clicked. */
  @Output()
  rowSelected = new EventEmitter<[number, number]>();

  searchForm: UntypedFormGroup;

  results$ = new BehaviorSubject<MultiPageResults>(undefined);
  sha256: string;

  @ViewChild(CdkVirtualScrollViewport)
  private viewport: CdkVirtualScrollViewport;
  @ViewChild("resultsDiv")
  private resultsDiv: ElementRef<HTMLDivElement>;

  /** If an update to the search table has been requested */
  protected isLoading$ = new BehaviorSubject(false);
  protected hideResults$ = new BehaviorSubject(false);

  cs: ContinuousScroll;

  private lastRequest: Subscription | undefined = undefined;
  private entitySubscription: Subscription | undefined = undefined;
  private lastQueryParams:
    | paths["/api/v0/binaries/{sha256}/search/hex"]["get"]["parameters"]["query"]
    | undefined;

  ngOnInit(): void {
    this.searchForm = this.fb.group({
      searchType: this.fb.control("hex"),
      searchQuery: this.fb.control("").addValidators(Validators.required),
    });
    this.searchForm.addValidators(
      (control: AbstractControl): ValidationErrors | null => {
        const type = control.value.searchType;
        const query = control.value.searchQuery ?? "";

        const errors = {};
        let hasErrors = false;

        if (type === "hex") {
          const strippedQuery = query.replace(" ", "");
          if (strippedQuery.length % 2 != 0) {
            hasErrors = true;
            errors["invalid-hex"] =
              "Hex string is not of a valid length (groups of 2)";
          } else if (strippedQuery.length == 0) {
            hasErrors = true;
            errors["invalid-hex"] = "Missing hex string to search for";
          }
        }

        if (hasErrors) {
          return errors;
        }
        return null;
      },
    );
  }

  protected override onEntityChange() {
    this.updateData();
  }

  /** Validates the search query is valid. */
  protected queryValidator(event: Event) {
    if (this.searchForm.value.searchType == "hex") {
      hexValidator(event);
    }
  }

  /** Initiates a new search operation. */
  protected doSearch() {
    if (!this.searchForm.valid) {
      // Don't submit bad data
      return;
    }

    this.hideResults$.next(false);

    if (this.searchForm.value.searchType == "hex") {
      this.cs.offset = 0;
      this.update();
    }
  }

  ngOnDestroy() {
    this.entitySubscription?.unsubscribe();
  }

  /** Updates the search component with a new entity */
  private updateData() {
    this.entitySubscription?.unsubscribe();
    this.entitySubscription = this.entity.summary$.subscribe((obs) => {
      if (obs.sha256 != this.sha256) {
        this.sha256 = obs.sha256;

        this.cs = new ContinuousScroll();
        //override functions that need local context
        this.cs.update = () => {
          this.update();
        };
        this.cs.getDataLength = () => {
          return this.viewport.getDataLength();
        };

        //get first set of data
        this.cs.update();
      }
    });
  }

  /** Event handler for when an address is clicked. */
  protected clickAddress(address: number, length: number) {
    this.hideResults$.next(true);
    this.rowSelected.next([address, length]);
  }

  /** get next values */
  update() {
    const filter = (this.searchForm?.value.searchQuery ?? "").trim();

    if (filter == "") {
      return;
    }

    if (this.cs.offset === 0) {
      if (filter == this.lastQueryParams?.filter) {
        // User resubmitted the same query. Skip.
        return;
      }
      // If we are loading the first set of entries, display a loading indicator
      this.isLoading$.next(true);
    }

    // If there is a pending request, make sure we don't get results
    // from it
    this.lastRequest?.unsubscribe();

    // Compose the cachable part of the query for comparison later
    const searchQuery = {
      take_n_hits: this.TAKE_N_HITS,
      min_length: 4,
      filter,
    };

    this.lastRequest = this.entityService
      .searchHex(this.sha256, {
        offset: this.cs.offset,
        ...searchQuery,
      })
      .pipe(
        ops.first(),
        ops.catchError((e) => {
          if (e instanceof HttpErrorResponse) {
            return of(null);
          }
          throw e;
        }),
      )
      .subscribe((d) => {
        const s = d as MultiPageResults;
        // Add previous string entries for pagination to the current set of strings
        // if previous entries exist
        // If the search query parameters have changed, clear it out as previous hits
        // may not match
        if (
          this.results$?.value != undefined &&
          JSON.stringify(searchQuery) === JSON.stringify(this.lastQueryParams)
        ) {
          s.strings = [...this.results$.value.strings, ...s.strings];
        }
        this.results$.next(s);
        // can now ask for more again
        if (s) {
          this.cs.reset(false, s.next_offset, s.has_more);
        }

        this.lastQueryParams = searchQuery;

        this.isLoading$.next(false);

        setTimeout(() => {
          // Focus the results div to allow blur functionality
          this.resultsDiv.nativeElement.focus();
        });
      });
  }
}
