import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subscription,
  combineLatest,
  of,
  timer,
} from "rxjs";
import * as ops from "rxjs/operators";

import {
  faBolt,
  faDownload,
  faFileCirclePlus,
  faRotate,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { Store } from "@ngrx/store";
import { ActiveToast, ToastrService } from "ngx-toastr";
import { ApiService } from "src/app/core/api/api.service";
import { IconDefinition, IconService } from "src/app/core/icon.service";
import { Entity, EntityWrap, Nav } from "src/app/core/services";
import { getStatusColour, sourceRefsAsParams } from "src/app/core/util";

import { components } from "src/app/core/api/openapi";
import { selectShowDebugInfo } from "src/app/core/store/global-settings/global-selector";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

type Highlight = {
  label: string;
  track_source_references: string;
};

type SourceWithDefinitions = {
  source: string;
  highlight: Highlight[];
}[];

/**page for displaying the current entity*/
@Component({
  selector: "app-entities-current",
  templateUrl: "./entities-current.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesCurrentComponent implements OnDestroy {
  private entityService = inject(Entity);
  private route = inject(ActivatedRoute);
  private toastrService = inject(ToastrService);
  private navService = inject(Nav);
  private iconService = inject(IconService);
  private store = inject(Store);

  protected getStatusColour = getStatusColour;
  protected sourceRefsAsParams = sourceRefsAsParams;

  protected entity$ = new ReplaySubject<EntityWrap>(1);

  private refreshNewSub: Subscription;
  private downloadSub: Subscription;
  private toastrPauseCheckRef: ActiveToast<unknown>;
  private toastrNewResultsRef: ActiveToast<unknown>;

  protected resultCount: number = -1;

  // max source references to show in source breadcrumb
  protected maxBreadcrumbRefs: number = 5;

  protected icon$: Observable<IconDefinition>;

  protected faDownload = faDownload;
  protected faFileCirclePlus = faFileCirclePlus;
  protected faRotate = faRotate;
  protected faSpinner = faSpinner;
  protected faBolt = faBolt;

  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;

  protected downloading$: ReplaySubject<number>;
  protected expedite$: Observable<number>;
  protected isExpedited$ = new BehaviorSubject(false);

  protected showDebugInfo$: Observable<boolean> = of(false);

  protected tabNames = [
    "Overview",
    "Features",
    "Data",
    "Relations",
    "Status",
    "Debug",
  ];
  protected activeTab$ = new ReplaySubject(1);
  protected tabBadges$ = new BehaviorSubject(
    new Array<number>(this.tabNames.length).fill(0),
  );
  protected tabs$ = this.tabBadges$.pipe(
    ops.combineLatestWith(this.store.select(selectShowDebugInfo)),
    ops.map(([tabs, showDebugInfo]) => {
      let tabsWithBadges = tabs.map((value, index) => ({
        name: this.tabNames[index],
        badgeCount: value,
      }));
      // Filter out debug info if users don't want to see it.
      if (!showDebugInfo) {
        tabsWithBadges = tabsWithBadges.filter((val) => val.name !== "Debug");
      }

      return tabsWithBadges;
    }),
  );

  protected sourceInformation$: Observable<SourceWithDefinitions>;
  protected featureTags$: Observable<
    components["schemas"]["FeatureValueTag"][]
  >;
  protected diagnostics$: Observable<
    readonly components["schemas"]["BinaryDiagnostic"][]
  >;

  constructor() {
    const api = inject(ApiService);

    this.showDebugInfo$ = this.store.select(selectShowDebugInfo);
    this.route.params.subscribe((p) => {
      const ent = this.entityService.entity(p.sha256);
      this.entity$.next(ent);
    });

    const entitySource$ = this.entity$.pipe(
      ops.map((ent) => ent.sources$),
      ops.mergeAll(),
    );

    this.featureTags$ = this.entity$.pipe(
      ops.map((ent) => ent.features$),
      ops.mergeAll(),
      ops.map((sources) =>
        sources
          .filter((feature) => feature.tags)
          .map((feature) => feature.tags)
          .flat(),
      ),
    );

    this.diagnostics$ = this.entity$.pipe(
      ops.map((ent) => ent.diagnostics$),
      ops.mergeAll(),
    );

    this.sourceInformation$ = combineLatest([
      entitySource$,
      api.sourceReadAll(),
    ]).pipe(
      ops.map(([entitySource, sourceDefinitions]) =>
        entitySource.map((val) => {
          const dict = {
            source: val.source,
            highlight: [],
          };

          const source = sourceDefinitions[val.source];

          // Determine if there is a direct reference available for this source
          for (const direct of val.direct) {
            if ("references" in direct) {
              for (const sourceReference of source.references) {
                const label = direct.references[sourceReference.name] as string;
                if (label && sourceReference.highlight) {
                  dict.highlight.push({
                    label: label,
                    track_source_references: direct.track_source_references,
                  });
                }
              }
            }
          }
          return dict;
        }),
      ),
    );

    this.icon$ = this.entity$.pipe(
      ops.map((entity) => entity.summary$),
      ops.mergeAll(),
      ops.map((summ) =>
        this.iconService.get("binary", summ.file_format),
      ),
    );

    this.route.fragment
      .pipe(
        ops.combineLatestWith(
          this.entity$.pipe(ops.concatMap((ent) => ent.summary$)),
        ),
      )
      .subscribe(([f, entity]) => {
        if (entity?.exists && this.tabNames.includes(f)) {
          this.activeTab$.next(f);
        } else {
          this.activeTab$.next(this.tabNames[0]);
        }
      });

    // check for updated page information every few seconds if page is active
    let haveNew = false;
    this.refreshNewSub = this.entity$
      .pipe(
        ops.switchMap((ent) => {
          return this.navService.windowFocus$.pipe(
            ops.switchMap((d) => (d ? timer(500, 1000 * 10) : of(-1))),
            ops.tap((d) => {
              if (!haveNew) {
                if (d < 0) {
                  this.toastrPauseCheckRef?.toastRef.close();
                  this.toastrPauseCheckRef = this.toastrService.info(
                    `Page not active`,
                    `Result checking paused`,
                    { disableTimeOut: true },
                  );
                }
                if (d == 0) {
                  this.toastrPauseCheckRef?.toastRef.close();
                }
              }
            }),
            ops.filter((d) => d >= 0),
            ops.tap(() => ent.refreshNewer()),
            ops.mergeMap(() => ent.hasNewer$),
            ops.tap((d) => {
              if (d.count > 0 && d.count !== this.resultCount) {
                haveNew = true;
                this.resultCount = d.count;
                this.toastrNewResultsRef?.toastRef.close();
                this.toastrNewResultsRef = this.toastrService.info(
                  `Refresh the page to view`,
                  `There are ${d.count} new results for this binary`,
                  { disableTimeOut: true },
                );
              }
            }),
          );
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.refreshNewSub?.unsubscribe();
    this.toastrPauseCheckRef?.toastRef.close();
    // Cancel download if you navigate away.
    this.downloadSub?.unsubscribe();
  }

  doDownload(sha256: string, fileSize: number) {
    if (!sha256) {
      return;
    }
    this.downloading$ = new ReplaySubject<number>();
    // The filesize used here corresponds to the raw file; CaRTs are compressed
    // so it is likely this will finish early. Not an issue as we are just trying
    // to provide a guesstimate to the user.
    this.downloadSub = this.entityService.download(sha256, fileSize).subscribe({
      next: (percentage: number) => {
        this.downloading$.next(Math.round(percentage));
      },
      complete: () => {
        this.downloading$ = null;
      },
    });
  }

  doExpedite(sha256: string) {
    if (!sha256) {
      return;
    }
    this.isExpedited$.next(true);
    // Wait for one minute before allowing users to refresh the entity to give the plugins a chance to run.
    this.expedite$ = this.entity$.pipe(
      ops.first(),
      ops.map((ent) =>
        ent.expedite().pipe(
          ops.delay(1000 * 60),
          ops.catchError((_e) => {
            // If expedite fails reset the expedite button to how it was.
            this.isExpedited$.next(false);
            return of(0);
          }),
        ),
      ),
      ops.mergeAll(),
      ops.shareReplay(1),
    );
  }

  doRefresh() {
    window.location.reload();
  }

  setTabBadgeCount(name: string, count: number) {
    const nameIndex = this.tabNames.findIndex((elem) => elem === name);
    const badgeCount = this.tabBadges$.value;
    badgeCount[nameIndex] = count;
    this.tabBadges$.next(badgeCount);
  }
}
