import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  Signal,
  TemplateRef,
  ViewChild,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { Subscription } from "rxjs";
import * as ops from "rxjs/operators";

import { components } from "@app/core/api/openapi";
import { UserService } from "@app/core/user.service";
import {
  allowedToPurge,
  getPurgeQueryParams,
  sourceRefsAsParams,
} from "@app/core/util";
import {
  faBucket,
  faMagnifyingGlass,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { BaseCard } from "../base-card.component";

type SourceInfo = components["schemas"]["BinarySource"] & {
  refKeys?: string[];
};
const sortString = (a: string, b: string) => (b == a ? 0 : b < a ? 1 : -1);

/**card displaying sources for current entity*/
@Component({
  selector: "azec-source-table",
  templateUrl: "./source-table.component.html",
  styleUrls: ["./source-table.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourceTableComponent extends BaseCard implements OnDestroy {
  protected user = inject(UserService);

  help = `
This panel list all sources that the file has been uploaded to in the past.

It is divided into tabs for each source, with number to represent number of direct and indirect occurrences for each source.

* direct - the file was uploaded to the source in Azul by a user or external system
* indirect - the file was extracted from another file in Azul

Each source will have a table showing the references supplied during an upload, and the ability to view other files uploaded as part of the same submission (if any).
  `;
  showHelp = input<boolean>(true);
  summary = input<boolean>(false);
  @ViewChild("tplSource") public tplSource: TemplateRef<unknown>;

  protected faMagnifyingGlass = faMagnifyingGlass;
  protected faTrash = faTrash;
  protected faBucket = faBucket;

  protected sourceRefsAsParams = sourceRefsAsParams;
  protected getPurgeQueryParams = getPurgeQueryParams;
  protected allowedToPurge = allowedToPurge;

  protected sourceSub: Subscription;
  protected sourceMap: WritableSignal<Map<string, SourceInfo>> = signal(
    new Map<string, SourceInfo>(),
  );
  protected sortedSourceKeys: Signal<string[]> = computed(() => {
    const sortedSources = Array.from(this.sourceMap().keys());
    return sortedSources.sort((f1, f2) => sortString(f1, f2));
  });

  protected override onEntityChange() {
    this.sourceSub?.unsubscribe();
    this.sourceSub = this.currentEntity$
      .pipe(ops.switchMap((d) => d.sources$))
      .subscribe((allSources) => {
        const newSourceList = new Map<string, SourceInfo>();
        // setup each individual source
        for (const curSource of allSources) {
          const variants = curSource.direct.concat(curSource.indirect);
          const refKeys = new Set<string>();
          for (const row of variants) {
            for (const k in row.references) {
              refKeys.add(k);
            }
          }
          const infoConversion: SourceInfo = {
            source: curSource.source,
            direct: curSource.direct,
            indirect: curSource.indirect,
            refKeys: Array.from(refKeys),
          };
          newSourceList.set(curSource.source, infoConversion);
        }

        this.sourceMap.set(newSourceList);
      });
  }

  protected limitMinLength(refLength: number) {
    if (refLength === 0) {
      return 1;
    }
    return refLength;
  }

  ngOnDestroy(): void {
    this.sourceSub?.unsubscribe();
  }
}
