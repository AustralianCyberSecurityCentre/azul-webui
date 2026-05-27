import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
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
  private cdr = inject(ChangeDetectorRef);
  private refreshTimer: number | null = null;
  private paramsSub: Subscription;
  private SEARCH_TYPE_MAP: Record<string, string> = {
    yara: "Yara",
    suricata: "Suricata",
    // add more in future
  };
  private hasSelectedInitialHunt = false;

  protected userService = inject(UserService);
  protected sizes = [20, 45, 35];
  protected ButtonType = ButtonType;
  protected entitySearchTerm = new FormControl("");
  protected user = inject(UserService);
  protected username: string = "";
  protected refreshInterval = 0; // default: Off
  protected faTrash = faTrash;
  protected faTrashAlt = faTrashAlt;
  protected ruleControl = new FormControl("");
  protected selectedLanguage = "yara";
  protected hunts$ = this.retro.retrohunts$;
  protected huntFind$ = new BehaviorSubject<EntityFindWithPurgeExtras | null>(
    null,
  );
  protected selectedHunt: RetrohuntEntity | null = null;
  protected showCreateHunt = false;
  protected newHuntCode = "";
  protected newHuntLanguage = "yara";
  protected modalWidth = "800px";
  protected modalHeight = "80vh";
  protected showLogsModal = false;
  protected logsText = "";

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

  selectHunt(hunt: RetrohuntEntity) {
    this.selectedHunt = hunt;

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

  dbg = (...d) => console.info("BinariesRetrohuntComponent:", ...d);
  err = (...d) => console.error("BinariesRetrohuntComponent:", ...d);

  ngOnInit(): void {
    this.userService.username$.subscribe((name) => {
      this.username = name ?? "";
      this.cdr.markForCheck();
    });

    this.paramsSub = this.route.queryParamMap.pipe(take(1)).subscribe(() => {
      this.retro.refresh();
      this.cdr.markForCheck();
    });

    this.hunts$.subscribe((hunts) => {
      if (!hunts || hunts.length === 0) return;

      // Only auto-select on first load
      if (!this.hasSelectedInitialHunt) {
        this.hasSelectedInitialHunt = true;
        this.selectHunt(hunts[0]);
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  reload() {
    this.retro.refresh();
    this.cdr.markForCheck();
  }

  deleteHunt(hunt: RetrohuntEntity) {
    this.retro.cancelHunt(hunt.id).subscribe({
      next: () => {
        this.retro.removeHuntLocally(hunt.id);

        if (this.selectedHunt?.id === hunt.id) {
          this.selectedHunt = null;
          this.huntFind$.next({
            items: [],
            items_count: 0,
          });
        }
      },
      error: (err) => {
        console.error("Failed to cancel hunt:", err);
      },
    });
  }

  resetRules() {
    if (this.selectedHunt) {
      this.ruleControl.setValue(this.selectedHunt.search ?? "");
    }
  }

  submitNewHunt() {
    const rules = this.ruleControl.value ?? "";

    const body = {
      search_type: this.SEARCH_TYPE_MAP[this.selectedLanguage], // "Yara only. Possible to support more languages in future"
      search: rules,
      submitter: this.username,
      security: "", // leave blank for now
    };

    this.retro.submitHunt(body).subscribe({
      next: () => {
        this.retro.refresh();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to submit hunt:", err);
      },
    });
  }

  onRefreshIntervalChange() {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // If Off (0), stop here
    if (this.refreshInterval === 0) {
      return;
    }

    // Start new interval
    this.refreshTimer = setInterval(() => {
      this.retro.refresh();
      this.cdr.markForCheck();
    }, this.refreshInterval);
  }

  closeCreateHunt() {
    this.showCreateHunt = false;
    this.newHuntCode = "";
  }

  submitNewHuntFromModal() {
    const body = {
      search_type: this.SEARCH_TYPE_MAP[this.newHuntLanguage],
      search: this.newHuntCode,
      submitter: this.username,
      security: "",
    };

    this.retro.submitHunt(body).subscribe({
      next: () => {
        this.retro.refresh();
        this.closeCreateHunt();
        this.cdr.markForCheck();
      },
      error: (err) => console.error("Failed to submit hunt:", err),
    });
  }

  openCreateModal() {
    this.newHuntCode = "";
    this.newHuntLanguage = "yara";
    this.showCreateHunt = true;
  }

  openEditModal() {
    if (!this.selectedHunt) return;

    // Load the existing hunt’s rule into the modal editor
    this.newHuntCode = this.selectedHunt?.search ?? "";
    this.newHuntLanguage = this.selectedLanguage;

    // Open the same modal
    this.showCreateHunt = true;
  }

  openLogsModal(hunt: RetrohuntEntity) {
    console.log("opening logs modal");
    this.logsText = hunt.logs ?? "No logs available.";
    this.showLogsModal = true;
  }

  closeLogsModal() {
    this.showLogsModal = false;
    this.logsText = "";
  }
}
