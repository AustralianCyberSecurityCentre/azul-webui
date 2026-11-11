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
import { BehaviorSubject, forkJoin, Observable } from "rxjs";
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

      :host ::ng-deep .bulk-action-button button.bg-blue-700,
      :host ::ng-deep .bulk-action-button button.bg-red-700 {
        border-style: solod;
        border-width: 1px;
        border-color: transparent;
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

  // Bulk tag removal
  protected showBulkRemoveForm: WritableSignal<boolean> = signal(false);
  protected availableRemovableTags: WritableSignal<
    { tag: string; count: number }[]
  > = signal([]);
  protected selectedTagsToRemove: WritableSignal<Set<string>> = signal(
    new Set(),
  );

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

  protected canCompareBinaries(): boolean {
    return (
      this.selectedRowMap.size > 1 ||
      (this.selectedRowMap.size >= 1 && this.originalSha256() !== undefined)
    );
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
        this.showBulkRemoveForm.set(false);
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

  protected hasAnyRemovableTags(): boolean {
    for (const row of this.selectedRowMap.values()) {
      if ((row.tags ?? []).length > 0) {
        return true;
      }
    }
    return false;
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

  protected openBulkRemoveForm(): void {
    const tagCounts = new Map<string, number>();
    for (const row of this.selectedRowMap.values()) {
      const tagsOnThisRow = new Set((row.tags ?? []).map((t) => t.tag));
      for (const tag of tagsOnThisRow) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const sortedTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    this.availableRemovableTags.set(sortedTags);
    this.selectedTagsToRemove.set(new Set());
    this.showBulkRemoveForm.set(true);
  }

  protected cancelBulkRemoveForm(): void {
    this.showBulkRemoveForm.set(false);
  }

  protected onRemoveTagToggle(tag: string, checked: boolean): void {
    this.selectedTagsToRemove.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(tag);
      } else {
        next.delete(tag);
      }
      return next;
    });
  }

  protected onBulkRemoveSubmit(): void {
    const tagsToRemove = Array.from(this.selectedTagsToRemove());
    if (tagsToRemove.length === 0) {
      return;
    }

    let confirmText: string;
    if (tagsToRemove.length == 1) {
      confirmText = `Are you sure you want to remove 1 tag from selected binary?`;
    } else {
      confirmText = `Are you sure you want to remove ${tagsToRemove.length} tags from selected binaries?`;
    }
    const confirmed = window.confirm(confirmText);
    if (!confirmed) {
      return;
    }

    const hashes = new Set(this.selectedRowMap.keys());
    const deleteCalls = [];
    for (const row of this.selectedRowMap.values()) {
      const tagsOnThisRow = new Set((row.tags ?? []).map((t) => t.tag));
      for (const tag of tagsOnThisRow) {
        if (tagsOnThisRow.has(tag)) {
          deleteCalls.push(this.entityService.deleteTag(row.sha256, tag));
        }
      }
    }

    if (deleteCalls.length === 0) {
      this.showBulkRemoveForm.set(false);
      return;
    }

    forkJoin(deleteCalls)
      .pipe(ops.first())
      .subscribe(() => {
        this.showBulkRemoveForm.set(false);
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
