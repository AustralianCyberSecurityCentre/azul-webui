import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnChanges,
  QueryList,
  Signal,
  SimpleChanges,
  ViewChildren,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { form, required } from "@angular/forms/signals";
import { Router } from "@angular/router";
import { EntityFindRow, EntityFindWithPurgeExtras } from "@app/core/api/state";
import { Entity } from "@app/core/services";
import { GlobalSettingStore } from "@app/core/signal-store/global-settings.store";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { BehaviorSubject, Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { configureTagValidation } from "../tag-picker/tag-picker.component";
import { EntityTableRowComponent } from "../entity-table-row/entity-table-row.component";

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
  private entityService = inject(Entity);
  private cdr = inject(ChangeDetectorRef);

  @HostBinding("hidden") isHidden = false;
  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;
  protected filteredFind$: Observable<EntityFindRow[]>;
  protected etype$ = new Observable<string | null>(null);
  protected itemsCount$: Observable<number>;
  protected selectedRowMap = new Map<string, EntityFindRow>();

  @ViewChildren(EntityTableRowComponent)
  protected rowComponents: QueryList<EntityTableRowComponent>;

  protected showSimilarityHeader: WritableSignal<boolean> = signal(false);

  // Bulk tagging of selected rows
  protected showBulkTagForm: WritableSignal<boolean> = signal(false);
  protected refreshTags$: BehaviorSubject<boolean> = new BehaviorSubject(true);
  protected bulkTagModel: WritableSignal<{ tag: string; security: string }> =
    signal({ tag: "", security: "" });
  protected bulkTagForm = form(this.bulkTagModel, (f) => {
    configureTagValidation(f.tag);
    required(f.security);
  });

  displayText = input<string>("matching the search parameters.");
  useTableViewOverride = input<boolean | undefined>(undefined);
  externalPagination = input<boolean>(false);
  showSsdeep = input<boolean>(false);
  showTlsh = input<boolean>(false);
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
            // check if similarity exists to know if the similarity table header should be displayed.
            if (val["similarity"]) {
              this.showSimilarityHeader.set(true);
            }
            return val;
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

  protected onRowCheckedChange(row: EntityFindRow, checked: boolean) {
    if (checked) {
      this.selectedRowMap.set(row.sha256, row);
    } else {
      this.selectedRowMap.delete(row.sha256);
      if (this.selectedRowMap.size === 0) {
        this.showBulkTagForm.set(false);
      }
    }
  }

  protected isChecked(sha256: string): boolean {
    return this.selectedRowMap.has(sha256);
  }

  protected onDeselectAllToggle(checked: boolean): void {
    this.store.updateBulkTagDeselectAllOnSubmit(checked ?? false);
  }

  protected openBulkTagForm(): void {
    this.bulkTagModel.set({ tag: "", security: "" });
    this.showBulkTagForm.set(true);
  }

  protected cancelBulkTagForm(): void {
    this.showBulkTagForm.set(false);
  }

  protected formBulkTagSecurityUpdate(event: string): void {
    if (event == null) {
      return;
    }
    this.bulkTagModel.update((v) => {
      return { ...v, security: event };
    });
  }

  protected onBulkTagSubmit(): void {
    const hashes = new Set(this.selectedRowMap.keys());

    this.entityService
      .createTagBulk(
        Array.from(hashes),
        this.bulkTagModel().tag,
        this.bulkTagModel().security,
      )
      .pipe(ops.first())
      .subscribe(() => {
        this.showBulkTagForm.set(false);
        if (this.store.bulkTagDeselectAllOnSubmit()) {
          this.selectedRowMap.clear();
        }
        this.cdr.markForCheck();

        this.rowComponents
          .filter((rowComponent) => hashes.has(rowComponent.row?.sha256))
          .forEach((rowComponent) => {
            rowComponent.refreshRowTags(rowComponent.row);
          });
      });
  }
}
