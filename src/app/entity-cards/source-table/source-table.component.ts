import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  AfterViewInit,
  Input,
  inject,
} from "@angular/core";
import { ReplaySubject, Subscription, combineLatest } from "rxjs";
import * as ops from "rxjs/operators";

import { BaseCard } from "../base-card.component";
import {
  faMagnifyingGlass,
  faTrash,
  faBucket,
} from "@fortawesome/free-solid-svg-icons";
import {
  allowedToPurge,
  getPurgeQueryParams,
  sourceRefsAsParams,
} from "src/app/core/util";
import { UserService } from "src/app/core/user.service";
import { Tab } from "src/lib/flow/tablist/tablist.component";
import { components } from "src/app/core/api/openapi";

type SourceInfo = components["schemas"]["BinarySource"] & {
  refKeys?: string[];
};
const sortString = (a: string, b: string) => (b == a ? 0 : b < a ? 1 : -1);

/**card displaying sources for current entity*/
@Component({
  selector: "azec-source-table",
  templateUrl: "./source-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourceTableComponent extends BaseCard implements AfterViewInit {
  protected user = inject(UserService);

  help = `
This panel list all sources that the file has been uploaded to in the past.

It is divided into tabs for each source, with number to represent number of direct and indirect occurrences for each source.

* direct - the file was uploaded to the source in Azul by a user or external system
* indirect - the file was extracted from another file in Azul

Each source will have a table showing the references supplied during an upload, and the ability to view other files uploaded as part of the same submission (if any).
  `;
  @ViewChild("tplSource") public tplSource: TemplateRef<unknown>;

  @Input()
  restrictedHeight: boolean;

  protected faMagnifyingGlass = faMagnifyingGlass;
  protected faTrash = faTrash;
  protected faBucket = faBucket;

  protected sourceRefsAsParams = sourceRefsAsParams;
  protected getPurgeQueryParams = getPurgeQueryParams;
  protected allowedToPurge = allowedToPurge;

  protected sourceTabs$ = new ReplaySubject<Tab[]>();
  protected sourceSub: Subscription;

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this.sourceSub?.unsubscribe();
      this.sourceSub = combineLatest([
        this._current_entity$.pipe(ops.switchMap((d) => d.sources$)),
      ]).subscribe(([t]) => {
        let sourceTabs: Tab[] = [];
        const d = t as SourceInfo[];
        for (const sourceInfo of d) {
          const variants = sourceInfo.direct.concat(sourceInfo.indirect);
          const refKeys = new Set<string>();
          for (const row of variants) {
            for (const k in row.references) {
              refKeys.add(k);
            }
            sourceInfo.refKeys = Array.from(refKeys);
          }
          sourceTabs.push({
            name: sourceInfo.source,
            template: this.tplSource,
            count:
              sourceInfo.direct.length + " | " + sourceInfo.indirect.length,
            context: { row: sourceInfo },
          });
        }
        // sort tabs by source name
        sourceTabs = sourceTabs.sort((f1, f2) => sortString(f1.name, f2.name));
        this.sourceTabs$.next(sourceTabs);
      });
    }, 0);
  }
}
