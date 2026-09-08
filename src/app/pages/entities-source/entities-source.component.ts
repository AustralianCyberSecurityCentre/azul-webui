import {
  ChangeDetectionStrategy,
  Component,
  inject,
  model,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { SearchFormInterface } from "@app/common/entity-search/entity-search.component";
import { EntityService } from "@app/core/entity.service";
import { Api } from "@app/core/services";
import { groupedSourceRefsAsParams, sourceRefsAsParams } from "@app/core/util";
import { ButtonType } from "@lib/flow/button/button.component";
import { combineLatest, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
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
  selector: "app-source-references-entities-explore",
  templateUrl: "./entities-source.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourceReferenceBinariesExploreComponent
  implements OnInit, OnDestroy
{
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private entityService = inject(EntityService);

  dbg = (...d) => console.info("BinariesExploreComponent:", ...d);
  err = (...d) => console.error("BinariesExploreComponent:", ...d);

  protected exploreSearchFormSignal = signal<EntityExploreSearchForm>({
    sort: "newest_sourced",
    count: "all",
    forceEmptySearch: true,
  });
  protected pageTitle = signal<string>("Source Reference Set");
  protected sourceId = signal<string>("");
  protected references = signal<Map<string, string>>(new Map<string, string>());

  protected termModel = model<SearchFormInterface>({ term: "" });
  protected ButtonType = ButtonType;
  /**params that store the reference set information and query term.*/
  private paramsSub: Subscription;

  // Match md5, sha1, sha256, sha512
  private match_hashes =
    /^(?:[^0-9a-f]|^)([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/;

  ngOnInit(): void {
    this.paramsSub = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
    ]).subscribe(([paramMap, routeParamMap]) => {
      this.sourceId.set(paramMap.get("sourceId"));

      const preParamForm = this.exploreSearchFormSignal();
      // update the pages form for parameters in url
      const sourceRefParam = routeParamMap.get("source_ref");
      const sourceRefGroupParam = routeParamMap.get("source_ref_group");
      const submissionTimestampParam = routeParamMap.get("timestamp");
      if (sourceRefParam && submissionTimestampParam) {
        // ------------------------ Submission ------------------------
        this.pageTitle.set("Submission");
        this.api
          .sourceSubmissionsRead(
            this.sourceId(),
            sourceRefParam,
            submissionTimestampParam,
          )
          .pipe(ops.take(1))
          .subscribe((allSourceRefs) => {
            for (const ref of allSourceRefs) {
              if (
                ref.track_source_references === sourceRefParam &&
                submissionTimestampParam === ref.timestamp
              ) {
                this.getReferencesFromValues(ref.values);
                break;
              }
            }
          });
        // setting term value
        const submissionSearchTerm = sourceRefsAsParams(
          this.sourceId(),
          0,
          sourceRefParam,
          submissionTimestampParam,
        );
        this.termModel.set({ term: submissionSearchTerm });
      } else if (sourceRefParam) {
        // ------------------------ Source References ------------------------
        this.pageTitle.set("Source Reference Set");
        this.api
          .sourceRefsRead(this.sourceId(), "")
          .pipe(ops.take(1))
          .subscribe((allSourceRefs) => {
            for (const ref of allSourceRefs) {
              if (ref.track_source_references === sourceRefParam) {
                this.getReferencesFromValues(ref.values);
                break;
              }
            }
          });
        // setting term value
        const sourceRefTerm = sourceRefsAsParams(
          this.sourceId(),
          0,
          sourceRefParam,
          null,
        );
        this.termModel.set({ term: sourceRefTerm });
      } else if (sourceRefGroupParam) {
        // ------------------------ Source Reference Groups ------------------------
        this.pageTitle.set("Grouped Source Reference Set");
        this.api
          .groupedSourceRefsRead(this.sourceId(), "")
          .pipe(ops.take(1))
          .subscribe((sourceRef) => {
            for (const ref of sourceRef) {
              if (ref.track_source_references_grouped === sourceRefGroupParam) {
                this.getReferencesFromValues(ref.values);
                break;
              }
            }
          });
        // setting term value
        const sourceRefGroupedTerm = groupedSourceRefsAsParams(
          this.sourceId(),
          0,
          sourceRefGroupParam,
          null,
        );
        this.termModel.set({ term: sourceRefGroupedTerm });
      }
      this.exploreSearchFormSignal.set(preParamForm);
      this.entityService.entityTriggerSearch();
    });
  }

  // Determine the reference values from the reference values.
  getReferencesFromValues(refValues: { readonly [key: string]: string }) {
    const references: Map<string, string> = new Map<string, string>();
    for (const [refKey, refValue] of Object.entries(refValues)) {
      references.set(refKey, refValue);
    }
    this.references.set(references);
  }

  getSourceInstanceQueryParams() {
    const ret = { source: this.sourceId() };
    for (const [refKey, refValue] of this.references()) {
      ret["ref_" + refKey] = refValue;
    }
    return ret;
  }

  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();
  }

  protected onSubmit() {
    this.entityService.entityTriggerSearch();
  }
}
