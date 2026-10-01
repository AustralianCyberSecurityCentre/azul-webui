import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { Api, User } from "@app/core/services";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { toObservable } from "@angular/core/rxjs-interop";
import { form, minLength, required } from "@angular/forms/signals";
import { ApiAccessEnum, components } from "@app/core/api/openapi";
import { config, DynamicConfig } from "@app/settings";
import {
  faCircleXmark,
  faEye,
  faPlus,
  faSpinner,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import * as ops from "rxjs/operators";

interface CreateApiToken {
  name: string;
  description: string;
  api_access: components["schemas"]["ApiAccessEnum"][];
  roles: string[];
}

const API_ACCESS_VALUES: ApiAccessEnum[] = [
  "all",
  "binary-source-upload",
  "binary-child-upload",
  "binary-download-request",
  "binary-download-streams",
  "binary-hex-and-strings",
  "binary-expedite",
  "binary-modify-tags",
  "binary-search",
  "features-search",
  "feature-modify-tags",
  "plugin-search",
  "sources-search",
] as const;

const API_ACCESS_VALUE_ALL = "all";

@Component({
  selector: "app-api-token",
  templateUrl: "./api-token.component.html",
  styleUrls: ["./api-token.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiTokenComponent {
  private api = inject(Api);
  private dialogService = inject(Dialog);
  private user = inject(User);
  private config: DynamicConfig = config;

  @ViewChild("tplIssuedApiToken") tplIssuedApiToken;

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faSpinner = faSpinner;
  protected faTrash = faTrash;
  protected faPlus = faPlus;
  protected faCircleXmark = faCircleXmark;
  protected faTriangleExclamation = faTriangleExclamation;
  protected faEye = faEye;

  protected createApiTokenModel: WritableSignal<CreateApiToken> = signal({
    name: "",
    description: "",
    api_access: [],
    roles: [],
  });

  protected allTokens$: Observable<components["schemas"]["ListOfPAT"]>;
  protected lastDeleteStatus: WritableSignal<
    components["schemas"]["PATDeleteResponse"]
  > = signal(null);
  protected lastCreatedPAT: WritableSignal<components["schemas"]["PATIssue"]> =
    signal(null);
  protected availableRoles: WritableSignal<string[]> = signal([]);
  protected lastDeletedId: WritableSignal<string> = signal("");

  protected createApiTokenDialog?: DialogRef;
  protected deleteConfirmation?: DialogRef;
  protected viewIssuedApiTokenDialog?: DialogRef;

  protected tokenCreationInProgress: WritableSignal<boolean> = signal(false);
  protected triggerRefresh: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  protected pendingRefresh: ReturnType<typeof setTimeout> = null;
  protected lastTokenCreationError: WritableSignal<string> = signal("");

  protected API_ACCESS_VALUES = API_ACCESS_VALUES;

  createApiTokenForm = form(this.createApiTokenModel, (f) => {
    required(f.name);
    required(f.description);
    minLength(f.api_access, 1, {
      message: "Have to have at least one api access selected.",
    });
    minLength(f.roles, 1, {
      message: "Have to have at least one role selected.",
    });
  });

  constructor() {
    this.user.userDetails$.pipe(ops.take(1)).subscribe((details) => {
      const allRoles: string[] = [];
      details.roles.forEach((r) => {
        // Add all non-admin roles the user has access to.
        if (!this.config?.admin_roles?.includes(r)) {
          allRoles.push(r);
        }
      });
      this.availableRoles.set(allRoles);
    });

    const lastCreated = toObservable(this.lastCreatedPAT);
    const lastDeleted = toObservable(this.lastDeleteStatus);

    this.allTokens$ = combineLatest([
      lastCreated,
      lastDeleted,
      this.triggerRefresh.asObservable(),
    ]).pipe(
      ops.switchMap(() => {
        return this.api.listPATs();
      }),
      ops.tap((pats) => {
        // Trigger a refresh if the deletion hasn't cleared the id yet.
        if (this.lastDeletedId() !== "") {
          const matchingPats = pats.pats.filter(
            (p) => p.id === this.lastDeletedId(),
          );
          if (matchingPats.length > 0) {
            // close any pending timeouts
            if (this.pendingRefresh !== null) {
              clearTimeout(this.pendingRefresh);
            }
            this.pendingRefresh = setTimeout(() => {
              this.triggerRefresh.next(!this.triggerRefresh.value);
            }, 2000);
          }
        }
      }),
      ops.shareReplay(1),
    );
  }

  openCreateApiDialog(dialog) {
    this.createApiTokenDialog = this.dialogService.open(dialog);
  }

  protected deletePatConfirmation(
    dialog,
    pat: components["schemas"]["PATView"],
  ) {
    this.deleteConfirmation = this.dialogService.open(dialog, { data: pat });
  }

  deletePAT(patId: string) {
    this.api
      .deletePAT({ id: patId })
      .pipe(ops.take(1))
      .subscribe((lastDeleted) => {
        this.lastDeletedId.set(patId);
        this.lastDeleteStatus.set(lastDeleted);
        this.deleteConfirmation?.close();
      });
  }

  toggleAccess(toggledAccess: ApiAccessEnum) {
    this.createApiTokenModel.update((current) => {
      const existingAccess = current.api_access.includes(toggledAccess);
      // All should toggle all the values on or off.
      if (toggledAccess === API_ACCESS_VALUE_ALL) {
        if (existingAccess) {
          return { ...current, api_access: [] };
        } else {
          return { ...current, api_access: this.API_ACCESS_VALUES };
        }
      }
      let updatedAccess: ApiAccessEnum[];
      if (existingAccess) {
        updatedAccess = current.api_access.filter(
          (a) => a !== toggledAccess && a !== API_ACCESS_VALUE_ALL,
        );
      } else {
        updatedAccess = [...current.api_access, toggledAccess];
      }
      return { ...current, api_access: updatedAccess };
    });
  }

  toggleRole(toggledRole: string) {
    this.createApiTokenModel.update((current) => {
      const existingRoles = current.roles.includes(toggledRole);
      let updatedRoles: string[];
      if (existingRoles) {
        updatedRoles = current.roles.filter((r) => r !== toggledRole);
      } else {
        updatedRoles = [...current.roles, toggledRole];
      }
      return { ...current, roles: updatedRoles };
    });
  }

  cancelTokenCreation() {
    this.createApiTokenDialog?.close();
  }

  resetTokenCreationForm() {
    this.createApiTokenModel.set({
      name: "",
      description: "",
      api_access: [],
      roles: [],
    });
    this.lastTokenCreationError.set("");
  }

  createToken() {
    if (this.createApiTokenForm().invalid()) {
      console.error(
        "Attempting to create an API token with an invalid form submission!",
      );
      return;
    }
    this.tokenCreationInProgress.set(true);
    this.api
      .createPAT(this.createApiTokenModel())
      .pipe(ops.take(1))
      .subscribe((newPat) => {
        this.tokenCreationInProgress.set(false);
        if (typeof newPat === "string") {
          console.error(newPat);
          this.lastTokenCreationError.set(newPat);
        } else {
          this.lastCreatedPAT.set(newPat);
          this.resetTokenCreationForm();
          this.createApiTokenDialog?.close();
          this.openNewTokenDialog();
        }
      });
  }

  openNewTokenDialog() {
    this.viewIssuedApiTokenDialog = this.dialogService.open(
      this.tplIssuedApiToken,
    );
  }
}
