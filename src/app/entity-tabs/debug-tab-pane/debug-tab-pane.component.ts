import { Component, Input } from "@angular/core";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { AzCommonModule } from "src/app/common/common.module";
import { CommonModule } from "@angular/common";
import { FlowModule } from "src/lib/flow/flow.module";
import { JsonDebugViewerComponent } from "../json-debug-viewer/json-debug-viewer.component";
import { BaseCard } from "src/app/entity-cards/base-card.component";
import { QueryInfoExpanded } from "src/app/core/api/state";

@Component({
  selector: "azco-debug-tab-pane",
  templateUrl: "./debug-tab-pane.component.html",
  imports: [AzCommonModule, CommonModule, FlowModule, JsonDebugViewerComponent],
})
export class DebugTabPaneComponent extends BaseCard {
  help = `This panel shows all the queries made to Opensearch to load the main binary data.
  (note the context menu options in the text editor can be helpful)`;
  queriesStringified$: Observable<readonly QueryInfoExpanded[]>;
  _queriesData$: Observable<readonly QueryInfoExpanded[]>;

  @Input() set queries$(q) {
    this._queriesData$ = q;

    this.queriesStringified$ = q.pipe(
      ops.map((qin: QueryInfoExpanded[]) => {
        if (!qin) {
          return [];
        }
        qin.forEach((curQuery) => {
          curQuery.queryAsString = JSON.stringify(curQuery?.query, null, 2);
          curQuery.responseAsString = JSON.stringify(
            curQuery?.response,
            null,
            2,
          );
          curQuery.kwargsAsString = JSON.stringify(curQuery?.kwargs, null, 2);
          curQuery.argsAsString = curQuery?.args
            ? curQuery?.args.join(",")
            : null;
        });
        return qin;
      }),
      ops.shareReplay(1),
    );
  }
  get queries$() {
    return this._queriesData$;
  }
}
