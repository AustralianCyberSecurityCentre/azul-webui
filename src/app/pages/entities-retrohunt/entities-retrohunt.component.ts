import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Injector,
  OnDestroy,
  OnInit,
  Signal,
  effect,
  inject,
  runInInjectionContext,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { ApiService } from "@app/core/api/api.service";
import type { components } from "@app/core/api/openapi";
import { EntityFindWithPurgeExtras } from "@app/core/api/state";
import { RetrohuntService } from "@app/core/retrohunt.service";
import { colorThemeConfig } from "@app/core/store/global-settings/global-selector";
import { ColorTheme } from "@app/core/store/global-settings/global-state.types";
import { UserService } from "@app/core/user.service";
import { faTrash, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { ButtonType } from "@lib/flow/button/button.component";
import { Store } from "@ngrx/store";
import { BehaviorSubject, forkJoin, take } from "rxjs";
import { map, switchMap } from "rxjs/operators";

interface StreamMetadata {
  file_format?: string;
  mime?: string;
  magic?: string;
  file_extension?: string;
  size?: number;
  ssdeep?: string;
  tlsh?: string;
}

type RetrohuntEntity = components["schemas"]["RetrohuntEntity"];
type RetrohuntCreateResponse = {
  retrohunt_id: string;
};

@Component({
  selector: "app-binaries-retrohunt",
  templateUrl: "./entities-retrohunt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesRetrohuntComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private retro = inject(RetrohuntService);
  private store = inject(Store);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private api = inject(ApiService);

  private refreshTimer: number | null = null;
  private hasSelectedInitialHunt = false;

  protected user = inject(UserService);
  protected SEARCH_TYPE_MAP: Record<string, string> = {
    yara: "Yara",
  };

  protected sizes = [25, 40, 35];
  protected ButtonType = ButtonType;
  protected username = toSignal(this.user.username$, { initialValue: null });
  protected refreshInterval = signal(0);

  protected faTrash = faTrash;
  protected faTrashAlt = faTrashAlt;
  protected ruleText = signal("");
  protected selectedLanguage = "yara";
  protected hunts: Signal<readonly RetrohuntEntity[]> = this.retro.retrohunts;

  protected huntFind$ = new BehaviorSubject<EntityFindWithPurgeExtras | null>(
    null,
  );

  protected selectedHunt = signal<RetrohuntEntity | null>(null);

  protected showCreateHunt = signal(false);
  protected newHuntCode = signal("");
  protected newHuntLanguage = signal("yara");
  protected logsText = signal("");
  protected modalWidth = "2000px";
  protected modalHeight = "100vh";

  protected showLogsModal = false;

  protected currentTheme: ColorTheme = ColorTheme.Dark;

  protected helpHuntsList = `
    The panel below displays the list of hunts currently in the database.
    It includes the submit user, the hunt status and the submit time.
    Click Create Hunt to submit a new hunt.
    Hit the refresh button to get the latest list from the database.
    You can select a refresh time from the dropdown to refresh automatically every selected period.`;
  protected helpResults = `
    This panel displays the binary results for the selected hunt.
    You can navigate to a binary by clicking the link or compare binaries by checking the boxes on the left of each binary and clicking Compare.`;
  protected helpYara = `
    The pane below shows the search rules for the selected hunt.
    Click the Edit Hunt button if you need to resubmit the hunt with changes to the search rules.`;

  public searchNamesMap: Record<string, string[]> = {};

  private refreshIntervalEffect = effect(() => {
    const interval = this.refreshInterval();

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (interval === 0) return;

    this.refreshTimer = setInterval(() => {
      this.retro.refresh();
    }, interval);
  });

  private autoSelectEffect = effect(() => {
    const hunts = this.hunts();
    if (!hunts || hunts.length === 0) return;

    if (!this.hasSelectedInitialHunt) {
      this.hasSelectedInitialHunt = true;
      this.selectHunt(hunts[0]);
    }
  });

  private refreshSelectedHuntEffect = effect(() => {
    const hunts = this.hunts();
    const selected = this.selectedHunt();

    if (!hunts || !selected) return;

    const updated = hunts.find((h) => h.id === selected.id);
    if (!updated) return;

    // Re-select to refresh huntFind$
    this.selectHunt(updated);
  });

  private syncLogsEffect = effect(() => {
    const hunts = this.hunts();
    const selected = this.selectedHunt();

    if (!hunts || !selected) return;

    const updated = hunts.find((h) => h.id === selected.id);
    if (!updated) return;

    // Only update logsText if logs actually changed
    if (updated.logs !== this.logsText()) {
      this.logsText.set(updated.logs ?? "");
    }
  });

  selectHunt(hunt: RetrohuntEntity) {
    this.selectedHunt.set(hunt);

    const results = hunt.results ?? {};
    const keys = Object.keys(results);

    if (keys.length === 0) {
      this.huntFind$.next({ items: [], items_count: 0 });
      this.ruleText.set(hunt.search ?? "");
      this.searchNamesMap = {};
      return;
    }

    const rowMap = new Map<
      string,
      EntityFindWithPurgeExtras["items"][number]
    >();

    // Use Sets to dedupe search names
    const searchNamesMap: Record<string, Set<string>> = {};

    for (const searchName of keys) {
      const raw = results[searchName] ?? [];

      for (const r of raw) {
        const sample = r.sample as string;

        // Build searchNamesMap (deduped)
        if (!searchNamesMap[sample]) {
          searchNamesMap[sample] = new Set<string>();
        }
        searchNamesMap[sample].add(searchName);

        // Build rowMap (dedupe rows)
        if (!rowMap.has(sample)) {
          rowMap.set(sample, {
            key: sample,
            sha256: sample,
            exists: true,
            has_content: true,
            is_duplicate_find: false,
            sources: [],
          });
        }
      }
    }

    // Convert map → array
    const rows = Array.from(rowMap.values());

    const metadataRequests = rows.map((row) =>
      this.api
        .entityReadMain(row.sha256, { detail: ["info", "datastreams"] })
        .pipe(
          map((res) => {
            const streams = (res?.data?.streams ??
              []) as unknown as StreamMetadata[];
            const primary = streams[0] ?? {};

            const enriched: EntityFindWithPurgeExtras["items"][number] = {
              ...row,
              file_format: primary.file_format,
              mime: primary.mime,
              magic: primary.magic,
              has_content: true,
            };

            return enriched;
          }),
        ),
    );

    forkJoin(metadataRequests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enrichedRows: EntityFindWithPurgeExtras["items"]) => {
        this.huntFind$.next({
          items: enrichedRows,
          items_count: enrichedRows.length,
        });

        // Convert Sets → arrays for UI
        this.searchNamesMap = Object.fromEntries(
          Object.entries(searchNamesMap).map(([k, v]) => [k, Array.from(v)]),
        );

        this.ruleText.set(hunt.search ?? "");
        this.logsText.set(hunt.logs ?? "");
      });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.retro.refresh());

    this.store
      .select(colorThemeConfig)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((theme) => {
        if (theme) {
          this.currentTheme = theme;
        }
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  reload() {
    this.retro.refresh();
  }

  deleteHunt(hunt: RetrohuntEntity) {
    this.retro
      .cancelHunt(hunt.id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.retro.removeHuntLocally(hunt.id);

          if (this.selectedHunt()?.id === hunt.id) {
            this.selectedHunt.set(null);
            this.huntFind$.next({ items: [], items_count: 0 });
          }
        },
        error: (err) => console.error("Failed to cancel hunt:", err),
      });
  }

  resetRules() {
    if (this.selectedHunt()) {
      this.ruleText.set(this.selectedHunt()?.search ?? "");
    }
  }

  closeCreateHunt() {
    this.showCreateHunt.set(false);
    this.newHuntCode.set("");
  }

  submitNewHuntFromModal() {
    this.user.username$
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        switchMap((username) => {
          const body = {
            search_type: this.SEARCH_TYPE_MAP[this.newHuntLanguage()],
            search: this.newHuntCode(),
            submitter: username ?? "",
            security: "",
          };

          return this.retro.submitHunt(body);
        }),
      )
      .subscribe({
        next: (created: RetrohuntCreateResponse) => {
          const newId = created?.retrohunt_id;
          if (!newId) {
            this.retro.refresh();
            this.closeCreateHunt();
            return;
          }

          this.retro.refresh();

          // Wait for hunts to refresh, then select the new one
          runInInjectionContext(this.injector, () => {
            const stop = effect(() => {
              const hunts = this.hunts();
              const found = hunts.find((h) => h.id === newId);
              if (found) {
                this.selectHunt(found);
                stop.destroy();
              }
            });
          });

          this.closeCreateHunt();
        },
        error: (err) => console.error("Failed to submit hunt:", err),
      });
  }

  openCreateModal() {
    this.newHuntCode.set("");
    this.newHuntLanguage.set("yara");
    this.showCreateHunt.set(true);
  }

  openEditModal() {
    if (!this.selectedHunt()) return;

    this.newHuntCode.set(this.selectedHunt()?.search ?? "");
    this.newHuntLanguage.set(this.selectedLanguage);
    this.showCreateHunt.set(true);
  }

  openLogsModal(hunt: RetrohuntEntity) {
    this.logsText.set(hunt.logs ?? "No logs available.");
    this.showLogsModal = true;
  }

  closeLogsModal() {
    this.showLogsModal = false;
    this.logsText.set("");
  }

  isEmptyResults(hunt: RetrohuntEntity): boolean {
    return !hunt.results || Object.keys(hunt.results).length === 0;
  }

  public hasBinaryResults(find: EntityFindWithPurgeExtras | null): boolean {
    return !!find && find.items && find.items.length > 0;
  }
}
