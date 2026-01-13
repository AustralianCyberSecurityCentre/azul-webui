import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from "@angular/core";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";
import {
  EntityFindRow,
  EntityFindWithPurgeExtras,
} from "src/app/core/api/state";
import { EntityWrap } from "src/app/core/entity.service";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

/**Displays a set of binaries in a table, as the result of a entityFind call

Includes highlighting data from elasticsearch.
*/

@Component({
  selector: "az-entity-table",
  templateUrl: "./entity-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntityTableComponent implements OnChanges {
  private router = inject(Router);

  @HostBinding("hidden") isHidden = false;
  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;
  protected filteredFind$: Observable<EntityFindRow[]>;
  protected etype$ = new Observable<string | null>(null);
  protected itemsCount$: Observable<number>;
  protected selectedRowMap = new Map<string, EntityFindRow>();

  @Input() externalPagination: boolean = false;
  @Input() tablename: string = null;
  @Input() scroll: boolean = true;
  @Input() find$: Observable<EntityFindWithPurgeExtras> | undefined;
  @Input() originalSha256?: string | undefined;
  @Input() eType: "parents" | "children" | undefined;
  @Input() entity?: EntityWrap | undefined;

  @Input() purgeQueryParams: Record<string, string> | undefined;

  ngOnChanges(changes: SimpleChanges) {
    this.itemsCount$ = this.find$.pipe(
      ops.map((d) => d.items_count),
      ops.shareReplay(1),
    );
    // grab row data while unchecking checked rows
    if (changes.find$ && this.find$ !== undefined) {
      this.filteredFind$ = this.find$.pipe(
        ops.map((d) =>
          d.items
            .filter((val) => val.exists)
            .map((val) => ({ ...val, checked: false })),
        ),
        ops.shareReplay(1),
      );
      //check any rows that should be checked
      this.filteredFind$ = this.find$.pipe(
        ops.map((d) =>
          d.items
            .filter((val) => val.exists)
            .map((val) => {
              const selected = this.selectedRowMap.get(val.sha256);
              return {
                ...val,
                checked: selected ? true : false,
              };
            }),
        ),
        ops.shareReplay(1),
      );
    }
  }

  protected onCompareClick(): void {
    const selectedRows = Array.from(this.selectedRowMap.values());
    const selectedHashes = selectedRows
      .map((row) => row.sha256)
      .filter((hash): hash is string => !!hash); // filter out null/undefined

    const allHashes = this.originalSha256
      ? [...selectedHashes, this.originalSha256]
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
