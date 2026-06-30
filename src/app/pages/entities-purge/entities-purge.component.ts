import { Location } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Navigation, Router } from "@angular/router";
import { ApiService } from "@app/core/api/api.service";
import { components } from "@app/core/api/openapi";
import { EntityService } from "@app/core/entity.service";
import { UserService } from "@app/core/user.service";
import { allowedToPurge } from "@app/core/util";
import { ButtonType } from "@lib/flow/button/button.component";
import { Observable, of, Subscription } from "rxjs";
import * as ops from "rxjs/operators";

/**
 * Various states for the purge state machine.
 */
const enum PurgeActionState {
  Loading = "loading",

  // Standard states
  AdminValidation = "admin_validation",
  InputOptions = "input_options",
  Simulate = "simulate",
  Purge = "purge",

  // Error states
  InvalidParams = "invalid_params",
  Unauthorized = "unauthorized",
  BadResponse = "bad_response",
}

const enum PurgeRequestType {
  ReferenceSet = "reference_set",
  Relation = "relation",
}

type ReferenceSetPurgeRequest = {
  type: PurgeRequestType.ReferenceSet;
  track_source_references: string;
  timestamp: string;
  referenceValues?: Record<string, string>;
  source?: string;
};

type RelationPurgeRequest = {
  type: PurgeRequestType.Relation;
  track_link: string;
  child?: string;
  parent?: string;
  author?: string;
};

type PurgeRequest = ReferenceSetPurgeRequest | RelationPurgeRequest;

@Component({
  selector: "app-entities-purge",
  templateUrl: "./entities-purge.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesPurgeComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private user = inject(UserService);
  private entity = inject(EntityService);
  private router = inject(Router);
  private location = inject(Location);
  private api = inject(ApiService);

  protected setStateSignal: WritableSignal<PurgeActionState> = signal(
    PurgeActionState.Loading,
  );
  protected computedStateSignal: Signal<PurgeActionState> = computed(() => {
    const state = this.setStateSignal();
    const isAdmin = this.user.isUserAdminSignal();
    switch (state) {
      case PurgeActionState.AdminValidation: {
        const purgeTarget = this.purgeTargetSignal();
        let canPurge = false;
        switch (purgeTarget.type) {
          case PurgeRequestType.ReferenceSet:
            canPurge = allowedToPurge(
              isAdmin,
              purgeTarget.track_source_references,
              undefined,
            );
            break;
          case PurgeRequestType.Relation:
            canPurge = allowedToPurge(
              isAdmin,
              undefined,
              purgeTarget.track_link,
            );
            break;
        }

        if (canPurge) {
          return PurgeActionState.InputOptions;
        } else {
          return PurgeActionState.Unauthorized;
        }
      }
      default:
        return state;
    }
  });

  protected purgeTargetSignal: WritableSignal<PurgeRequest | undefined> =
    signal(undefined);
  protected purgeTargetLabelSignal: Signal<string> = computed(() => {
    const target = this.purgeTargetSignal();
    switch (target.type) {
      case PurgeRequestType.ReferenceSet:
        return `reference set ${target.track_source_references}`;
      case PurgeRequestType.Relation:
        return "relation between binaries";
    }
  });

  protected acknowledgedPreview = new FormControl<boolean>(false);

  protected apiSimulation$?: Observable<
    components["schemas"]["PurgeSimulation"]
  >;
  protected apiPurge$?: Observable<
    components["schemas"]["azul_metastore__restapi__quick__Response_azul_bedrock__models_restapi__purge__PurgeSimulation___azul_bedrock__models_restapi__purge__PurgeResults"]
  >;
  protected cacheClear$?: Observable<boolean>;

  readonly ButtonType = ButtonType;

  protected purgeErrorSignal: WritableSignal<string | undefined> =
    signal(undefined);

  /** A user readable name for the current purge target. */

  private routeSub?: Subscription;
  private stateSub?: Subscription;

  private previousPage?: Navigation;

  constructor() {
    this.previousPage = this.router.currentNavigation()?.previousNavigation;
  }

  ngOnInit() {
    this.routeSub = this.route.queryParams.subscribe((params) => {
      // Reassemble key:value pairs
      const referenceValues = {};
      let index = 0;

      while (true) {
        const key = params["reference_key[" + index + "]"];
        const value = params["reference_value[" + index + "]"];

        if (key !== undefined) {
          referenceValues[key] = value || "-";
          index++;
        } else {
          break;
        }
      }

      // Determine what kind of purge this is
      const track_source_references = params["track_source_references"];
      const track_link = params["track_link"];
      const timestamp = params["timestamp"];

      if (track_source_references !== undefined && timestamp !== undefined) {
        this.purgeTargetSignal.set({
          type: PurgeRequestType.ReferenceSet,
          track_source_references,
          timestamp: params["timestamp"],
          referenceValues,
          source: params["source"],
        });

        this.setStateSignal.set(PurgeActionState.AdminValidation);
      } else if (track_link !== undefined) {
        this.purgeTargetSignal.set({
          type: PurgeRequestType.Relation,
          track_link,
          child: params["child"],
          parent: params["parent"],
          author: params["author"],
        });

        this.setStateSignal.set(PurgeActionState.AdminValidation);
      } else {
        this.setStateSignal.set(PurgeActionState.InvalidParams);
      }
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.stateSub?.unsubscribe();
  }

  /** Exit the purge entirely. */
  protected cancelPurge() {
    if (this.previousPage !== undefined) {
      this.location.back();
    } else {
      this.router.navigate(["/"], { replaceUrl: true });
    }
  }

  /** Back out from a preview, but return to the options screen. */
  protected backPurgeFromSimulation() {
    this.acknowledgedPreview.setValue(false);
    this.setStateSignal.set(PurgeActionState.InputOptions);
  }

  protected purge(doDelete = false) {
    const target = this.purgeTargetSignal();

    if (doDelete) {
      this.cacheClear$ = this.api.clearCache().pipe(
        // Make this truthy so that Angular will return in a ngIf
        ops.map((_) => true),
      );
    }

    switch (target.type) {
      case PurgeRequestType.ReferenceSet: {
        const req = this.entity
          .purgeReferenceSet(
            target.track_source_references,
            target.timestamp,
            doDelete,
          )
          .pipe(
            ops.catchError((err) => {
              this.purgeErrorSignal.set(err);
              this.setStateSignal.set(PurgeActionState.BadResponse);
              return of(err);
            }),
          );

        if (doDelete) {
          this.apiPurge$ = req;
        } else {
          this.apiSimulation$ = req;
        }
        break;
      }
      case PurgeRequestType.Relation: {
        const req = this.entity.purgeLink(target.track_link, doDelete).pipe(
          ops.catchError((err) => {
            this.purgeErrorSignal.set(err);
            this.setStateSignal.set(PurgeActionState.BadResponse);
            return of(err);
          }),
          ops.tap((_) => this.api.clearCache()),
        );

        if (doDelete) {
          this.apiPurge$ = req;
        } else {
          this.apiSimulation$ = req;
        }
        break;
      }
    }

    if (doDelete) {
      this.setStateSignal.set(PurgeActionState.Purge);
    } else {
      this.setStateSignal.set(PurgeActionState.Simulate);
    }
  }
}
