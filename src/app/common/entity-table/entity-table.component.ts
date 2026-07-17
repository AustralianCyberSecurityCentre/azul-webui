import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnChanges,
  Signal,
  SimpleChanges,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { components } from "@app/core/api/openapi";
import { EntityFindRow, EntityFindWithPurgeExtras } from "@app/core/api/state";
import { GlobalSettingStore } from "@app/core/signal-store/global-settings.store";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";

/**Displays a set of binaries in a table, as the result of a entityFind call

Includes highlighting data from elasticsearch.
*/

@Component({
  selector: "az-entity-table",
  templateUrl: "./entity-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  styles: [
    `
      table {
        word-break: break-word;
      }
    `,
  ],
})
export class EntityTableComponent implements OnChanges {
  private router = inject(Router);
  protected store = inject(GlobalSettingStore);

  @HostBinding("hidden") isHidden = false;
  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;
  protected filteredFind$: Observable<EntityFindRow[]>;
  protected etype$ = new Observable<string | null>(null);
  protected itemsCount$: Observable<number>;
  protected selectedRowMap = new Map<string, EntityFindRow>();

  protected showSimilarityHeader: WritableSignal<boolean> = signal(false);

  useTableViewOverride = input<boolean | undefined>(undefined);

  externalPagination = input<boolean>(false);
  tablename = input<string | null>(null);
  tableScroll = input<boolean>(false);
  tableXScroll = input<boolean>(false);
  @Input() find$: Observable<EntityFindWithPurgeExtras> | undefined;
  originalSha256 = input<string | undefined>(undefined);
  eType = input<"parents" | "children" | undefined>(undefined);
  noResults = input<string>("No binaries match the search criteria");
  retroHuntSearchNames = input<Record<string, string[]>>({});
  retrohuntNumberOfSearchKeys: Signal<number> = computed(() => {
    if (this.retroHuntSearchNames()) {
      return Object.keys(this.retroHuntSearchNames())?.length;
    }
    return 0;
  });

  ngOnChanges(changes: SimpleChanges) {
    this.itemsCount$ = this.find$.pipe(
      ops.map((d) => d?.items_count ?? 0),
      ops.shareReplay(1),
    );
    // grab row data while unchecking checked rows
    if (changes.find$ && this.find$ !== undefined) {
      // check any rows that should be checked
      this.filteredFind$ = this.find$.pipe(
        ops.map((d) => {
          //d may be null — make it safe
          const items = d?.items ?? [];
          this.showSimilarityHeader.set(false);
          return items.map((val) => {
            const selected = this.selectedRowMap.get(val.sha256);
            // check if similarity exists to know if the similarity table header should be displayed.
            if (val["similarity"]) {
              this.showSimilarityHeader.set(true);
            }
            return {
              ...val,
              checked: selected ? true : false,
            };
          });
        }),
        ops.shareReplay(1),
      );
    }
  }

  protected onCompareClick(): void {
    const selectedRows = Array.from(this.selectedRowMap.values());
    const selectedHashes = selectedRows
      .map((row) => row.sha256)
      .filter((hash): hash is string => !!hash); // filter out null/undefined

    const allHashes = this.originalSha256()
      ? [...selectedHashes, this.originalSha256()]
      : selectedHashes;

    this.router.navigate(["/pages/binaries/compare"], {
      queryParams: {
        entity: allHashes,
      },
    });
  }

  protected onRowCheckedChange(
    row: components["schemas"]["EntityFindItem"] & {
      checked?: boolean;
    },
    checked: boolean,
  ) {
    row.checked = checked;
    this.trackChecked(row);
  }

  private trackChecked(
    row: components["schemas"]["EntityFindItem"] & {
      checked?: boolean;
    },
  ) {
    if (row.checked) {
      this.selectedRowMap.set(row.sha256, row);
    } else {
      this.selectedRowMap.delete(row.sha256);
    }
  }
}
