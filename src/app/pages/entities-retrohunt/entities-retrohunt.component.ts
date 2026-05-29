import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  effect,
} from "@angular/core";
import { Subscription, BehaviorSubject, take } from "rxjs";
import { ActivatedRoute } from "@angular/router";
import { RetrohuntService } from "src/app/core/retrohunt.service";
import { ButtonType } from "src/lib/flow/button/button.component";
import { FormControl } from "@angular/forms";
import { EntityFindWithPurgeExtras } from "src/app/core/api/state";
import { faTrash, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { UserService } from "src/app/core/user.service";
import type { components } from "src/app/core/api/openapi";
import { ColorTheme } from "src/app/core/store/global-settings/global-state.types";
import { Store } from "@ngrx/store";
import { colorThemeConfig } from "src/app/core/store/global-settings/global-selector";

type RetrohuntEntity = components["schemas"]["RetrohuntEntity"];

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

  private refreshTimer: number | null = null;
  private paramsSub: Subscription;
  private hasSelectedInitialHunt = false;

  protected user = inject(UserService);
  protected SEARCH_TYPE_MAP: Record<string, string> = {
    yara: "Yara",
  };

  protected sizes = [25, 40, 35];
  protected ButtonType = ButtonType;
  protected username = signal<string | null>(null);

  protected refreshInterval = signal(0);

  protected faTrash = faTrash;
  protected faTrashAlt = faTrashAlt;
  protected ruleControl = new FormControl("");
  protected selectedLanguage = "yara";
  protected hunts = this.retro.retrohunts;

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

  selectHunt(hunt: RetrohuntEntity) {
    this.selectedHunt.set(hunt);

    const rows: EntityFindWithPurgeExtras["items"] = (
      hunt.results?.retrohunt_test ?? []
    ).map((r) => ({
      key: r.sample as string,
      sha256: r.sample as string,
      exists: true,
      has_content: true,
      is_duplicate_find: false,
      sources: [],
    }));

    this.huntFind$.next({
      items: rows,
      items_count: rows.length,
    });

    this.ruleControl.setValue(hunt.search ?? "");
  }

  ngOnInit(): void {
    this.user.username$.subscribe((name) => {
      this.username.set(name ?? null);
    });

    this.paramsSub = this.route.queryParamMap.pipe(take(1)).subscribe(() => {
      this.retro.refresh();
    });
    this.store.select(colorThemeConfig).subscribe((theme) => {
      if (theme) {
        this.currentTheme = theme;
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  reload() {
    this.retro.refresh();
  }

  deleteHunt(hunt: RetrohuntEntity) {
    this.retro.cancelHunt(hunt.id).subscribe({
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
      this.ruleControl.setValue(this.selectedHunt()?.search ?? "");
    }
  }

  submitNewHunt() {
    const rules = this.ruleControl.value ?? "";

    const body = {
      search_type: this.SEARCH_TYPE_MAP[this.selectedLanguage],
      search: rules,
      submitter: this.username(),
      security: "",
    };

    this.retro.submitHunt(body).subscribe({
      next: () => {
        this.retro.refresh();
      },
      error: (err) => console.error("Failed to submit hunt:", err),
    });
  }

  closeCreateHunt() {
    this.showCreateHunt.set(false);
    this.newHuntCode.set("");
  }

  submitNewHuntFromModal() {
    const body = {
      search_type: this.SEARCH_TYPE_MAP[this.newHuntLanguage()],
      search: this.newHuntCode(),
      submitter: this.username(),
      security: "",
    };

    this.retro.submitHunt(body).subscribe({
      next: () => {
        this.retro.refresh();
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
}
