import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  QueryList,
  ViewChildren,
  inject,
} from "@angular/core";
import { BehaviorSubject, Observable, Subscription, combineLatest } from "rxjs";
import * as ops from "rxjs/operators";
import { ApiService } from "src/app/core/api/api.service";
import { AzEntityCardsModule } from "src/app/entity-cards/entity-cards.module";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import {
  DataTabPanesComponent,
  TabSpec,
} from "src/app/entity-tabs/data-tab-panes/data-tab-panes.component";
import { BaseCard } from "../../entity-cards/base-card.component";
import { DebugTabPaneComponent } from "../debug-tab-pane/debug-tab-pane.component";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { DebugTabQueryPaneComponent } from "../debug-tab-query-pane/debug-tab-query-pane.component";
import { FlowModule } from "src/lib/flow/flow.module";
import { components } from "src/app/core/api/openapi";

export enum EventTypeEnum {
  SOURCED = "sourced",
  EXTRACTED = "extracted",
  MAPPED = "mapped",
  ENRICHED = "enriched",
  AUGMENTED = "augmented",
}

export type QueryResult = {
  name: string;
  query$: Observable<components["schemas"]["OpensearchDocuments"]>;
};

@Component({
  selector: "azco-debug-tab",
  templateUrl: "./debug-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AzEntityCardsModule,
    CommonModule,
    DataTabPanesComponent,
    FaIconComponent,
    DebugTabPaneComponent,
    DebugTabQueryPaneComponent,
    FlowModule,
  ],
})
export default class DebugTabComponent
  extends BaseCard
  implements OnDestroy, AfterViewInit
{
  private api = inject(ApiService);

  help = `This panel provides detailed information about the Opensearch queries used to acquire the binary data.`;
  dbg = (...d) => console.debug("DebugTabComponent:", ...d);
  err = (...d) => console.error("DebugTabComponent:", ...d);

  @ViewChildren("tabTemplate")
  private templates: QueryList<ElementRef<HTMLDivElement>>;
  protected faPlus = faPlus;
  protected eventTypeList: Array<EventTypeEnum> = new Array<EventTypeEnum>(
    EventTypeEnum.AUGMENTED,
    EventTypeEnum.ENRICHED,
    EventTypeEnum.EXTRACTED,
    EventTypeEnum.MAPPED,
    EventTypeEnum.SOURCED,
  );
  protected areExtraQueriesDone: boolean = false;

  protected tabs$: BehaviorSubject<TabSpec[]> = new BehaviorSubject<TabSpec[]>(
    [],
  );
  protected queries$: BehaviorSubject<QueryResult[]> = new BehaviorSubject<
    QueryResult[]
  >([]);

  @Output()
  badgeCount = new EventEmitter<number>();
  private tabBadgeSubscription?: Subscription;
  private tabCreationSubscription?: Subscription;

  ngAfterViewInit(): void {
    this.updateTabs();
  }

  ngOnDestroy(): void {
    this.tabBadgeSubscription?.unsubscribe();
    this.tabCreationSubscription?.unsubscribe();
  }

  protected onEntityChange(): void {
    this.updateTabs();
  }

  /** Resolves a DOM template from the visually invisible container. */
  private resolveTemplate(name: string): ElementRef<HTMLElement> | undefined {
    for (const template of this.templates) {
      if (template.nativeElement.getAttribute("key") == name) {
        return template;
      }
    }
    return undefined;
  }

  protected getTabKey(keyField: string) {
    return keyField;
  }

  /** Updates listeners for the entities properties. */
  private updateTabs() {
    if (!this.entity || !this.templates) {
      return;
    }
    this.dbg("Setting up templates now");
    const template$ = this.templates.changes.pipe(
      ops.startWith(this.templates),
    );
    this.tabCreationSubscription?.unsubscribe();
    this.tabCreationSubscription = combineLatest([
      this.entity.queriesSummary$,
      // this.queries$ // Don't include this query it'll cause a race condition between template rendering and this triggering.
      template$,
    ])
      .pipe(
        ops.map(([entityQuery, _templateChanges]) => {
          const tabs: TabSpec[] = [];
          if (entityQuery) {
            tabs.push({
              tabId: "binaryMeta",
              name: "Binary Metadata Queries",
              openInPane: 0,
              interesting: false,
              template: this.resolveTemplate("binaryMeta"),
            });
          }
          // Note queries$ is not in the combineLatest in this code because not having it means the templates render.
          // And then this code triggers and the template needs to render before this will work.
          this.queries$.value.forEach((queryResult) => {
            tabs.push({
              tabId: queryResult.name,
              name: queryResult.name,
              betterName$: queryResult.query$.pipe(
                ops.map(
                  (q) =>
                    `${queryResult.name} (${
                      q?.total_docs ? q?.total_docs : 0
                    })`,
                ),
              ),
              openInPane: 0,
              interesting: false,
              template: this.resolveTemplate(queryResult.name),
            });
          });
          return tabs;
        }),
      )
      .subscribe((tabs) => {
        this.dbg("Tabs have been created", tabs);
        this.tabs$.next(tabs);
      });
  }

  protected performQueries() {
    this.areExtraQueriesDone = true;
    const tempQueries = [...this.queries$.value];
    let addedAtLeastOne = false;

    this.eventTypeList.forEach((eventType) => {
      const eventNotQueriedYet =
        this.queries$.value.filter((v) => v.name === eventType).length === 0;
      if (eventNotQueriedYet) {
        const query: QueryResult = {
          name: eventType,
          query$: this.api.entityQueryEvents(this.entity.sha256, eventType),
        };
        tempQueries.push(query);
        addedAtLeastOne = true;
      }
    });
    if (addedAtLeastOne) {
      this.queries$.next(tempQueries);
    }
  }
}
