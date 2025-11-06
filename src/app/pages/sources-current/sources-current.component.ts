import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  faMagnifyingGlass,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";

import { Api } from "src/app/core/services";
import { UserService } from "src/app/core/user.service";
import {
  allowedToPurge,
  getPurgeQueryParams,
  sourceRefsAsParams,
} from "src/app/core/util";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

/**page for displaying info on current source*/
@Component({
  selector: "app-sources-current",
  templateUrl: "./sources-current.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourcesCurrentComponent implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected user = inject(UserService);

  protected faMagnifyingGlass = faMagnifyingGlass;
  protected faTriangleExclamation = faTriangleExclamation;

  protected sourceRefsAsParams = sourceRefsAsParams;
  protected getPurgeQueryParams = getPurgeQueryParams;
  protected allowedToPurge = allowedToPurge;

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  protected sources$: Observable<
    components["schemas"]["Response_str_Source_"]["data"]
  >;
  protected sourceId$: Observable<string>;
  protected source$: Observable<
    components["schemas"]["azul_bedrock__models_restapi__sources__Source"]
  >;
  protected sourceRefs$: Observable<
    readonly components["schemas"]["ReferenceSet"][]
  >;
  protected sourceSubmissions$: Observable<
    readonly components["schemas"]["ReferenceSet"][]
  >;

  protected term: string;

  protected showSubmissionView: boolean = false;

  ngOnInit(): void {
    this.sources$ = this.api.sourceReadAll();

    this.sourceId$ = this.route.params.pipe(
      ops.map((p) => p.sourceId),
      ops.shareReplay(1),
    );
    this.source$ = this.sourceId$.pipe(
      ops.switchMap((d) => this.api.sourceRead(d)),
    );

    this.sourceRefs$ = this.route.queryParamMap.pipe(
      ops.tap((d) => (this.term = d.get("term") || "")),
      ops.debounceTime(200), // delay term query.
      ops.switchMap(() => this.sourceId$),
      ops.switchMap((d) => this.api.sourceRefsRead(d, this.term)),
      ops.shareReplay(1),
    );

    this.sourceSubmissions$ = this.route.queryParamMap.pipe(
      ops.switchMap(() => this.sourceId$),
      ops.switchMap((d) => this.api.sourceSubmissionsRead(d)),
      ops.shareReplay(1),
    );
  }

  searchChange() {
    this.router.navigate([], { queryParams: { term: this.term } });
  }

  getSourceInstanceQueryParams(
    source: string,
    refsList: readonly components["schemas"]["SourceReference"][],
    valueMap: { [d: string]: string },
  ) {
    const ret = { source: source };
    for (const ref of refsList) {
      ret["ref_" + ref.name] = valueMap[ref.name];
    }
    return ret;
  }

  getSourceReferences(
    refsList: readonly components["schemas"]["SourceReference"][],
    valueMap: { [d: string]: string },
  ): { [d: string]: string } {
    const ret = {};
    for (const ref of refsList) {
      ret[ref.name] = valueMap[ref.name];
    }
    return ret;
  }
}
