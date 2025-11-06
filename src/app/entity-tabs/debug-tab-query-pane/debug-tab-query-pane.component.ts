import { Component, Input } from "@angular/core";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { AzCommonModule } from "src/app/common/common.module";
import { CommonModule } from "@angular/common";
import { FlowModule } from "src/lib/flow/flow.module";
import { JsonDebugViewerComponent } from "../json-debug-viewer/json-debug-viewer.component";
import { BaseCard } from "src/app/entity-cards/base-card.component";
import { components } from "src/app/core/api/openapi";

@Component({
  selector: "azco-debug-tab-query-pane",
  templateUrl: "./debug-tab-query-pane.component.html",
  imports: [AzCommonModule, CommonModule, FlowModule, JsonDebugViewerComponent],
})
export class DebugTabQueryPaneComponent extends BaseCard {
  help = `This panel shows the documents that were returned by opensearch after filtering.
  (note the context menu options in the text editor can be helpful)`;
  queryStringified$: Observable<string>;
  _queryData$: Observable<components["schemas"]["OpensearchDocuments"]>;

  @Input() set query$(q) {
    this._queryData$ = q;
    this.queryStringified$ = q.pipe(
      ops.map((qin: components["schemas"]["OpensearchDocuments"]) => {
        if (!qin) {
          return "";
        }
        return (
          `The query has returned '${qin.items.length}/${qin.total_docs}'documents.\n` +
          JSON.stringify(qin.items, null, 2)
        );
      }),
      ops.shareReplay(1),
    );
  }
  get query$() {
    return this._queryData$;
  }
}
