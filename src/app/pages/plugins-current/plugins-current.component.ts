import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from "@angular/core";
import { ActivatedRoute, Params } from "@angular/router";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subscription,
  of,
} from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";
import {
  BulkEntitySummarySubmit,
  PluginItemWithSummary,
  PluginItemsWithSummary,
} from "src/app/core/api/state";
import { STATUS_DESCRIPTIONS } from "src/app/core/plugin-status-descriptions";
import { Api, Entity } from "src/app/core/services";
import { escapeValue } from "src/app/core/util";
import { Tab } from "src/lib/flow/tablist/tablist.component";

function toCapitalCase(input: string): string {
  // https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
  return input.replace(
    /\w\S*/g,
    (txt: string) =>
      txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
  );
}

@Component({
  selector: "app-plugins-current",
  templateUrl: "./plugins-current.component.html",
  standalone: false,
})
export class PluginsCurrentComponent implements OnInit, OnDestroy {
  api = inject(Api);
  private route = inject(ActivatedRoute);
  entityService = inject(Entity);

  protected escapeValue = escapeValue;
  protected STATUS_DESCRIPTIONS = STATUS_DESCRIPTIONS;
  protected faSpinner = faSpinner;
  ngOnDestroy(): void {
    this.entityDataSub$?.unsubscribe();
  }
  protected statusContentType: { row: PluginItemsWithSummary };
  @ViewChild("tplStatusContent")
  private statusContent: TemplateRef<PluginItemsWithSummary>;

  plugin$: Observable<components["schemas"]["PluginInfo"]>;
  pluginVersions$: Observable<Array<string>>;
  target$: Observable<Params>;
  pluginStatus$: Observable<PluginItemsWithSummary[]>;
  entityDataSub$: Subscription;

  showAllVersions$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  expandVersionsFuncRef: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.target$ = this.route.params.pipe(
      ops.map((d) => {
        return { name: d.name, version: d.version };
      }),
      ops.tap((d) => {
        this.plugin$ = this.getPluginObs(d);
        this.pluginVersions$ = this.api.pluginGetAll().pipe(
          ops.map((pluginList) => {
            const currentPlugin = pluginList.find(
              (val, _i, _arr) => val.newest_version.name == d.name,
            );
            return currentPlugin.versions.filter(
              (val, _i, _arr) => val != d.version,
            );
          }),
          ops.shareReplay(1),
        );
      }),
    );
  }

  private getPluginObs(routeParams: Params) {
    // Cancel previous request for entity summary data.
    this.entityDataSub$?.unsubscribe();
    // Prevent UI bug where the status tabset will de-select if plugin status isn't reset.
    this.pluginStatus$ = of();

    return this.api.pluginGet(routeParams.name, routeParams.version).pipe(
      ops.tap((p) => {
        const statuses = p.status as PluginItemsWithSummary[];
        const entities: BulkEntitySummarySubmit[] = [];
        // Add entitySummary$ to all plugin statuses.
        statuses.forEach((s) => {
          s.items.forEach((item: PluginItemWithSummary) => {
            const summarySubject$ = new ReplaySubject<
              components["schemas"]["EntityFindItem"]
            >(1);
            item.entitySummary$ = summarySubject$;
            entities.push({
              eid: item.entity.input.entity.sha256,
              sub$: summarySubject$,
            });
          });
        });
        // Query database for entitySummary information.
        this.entityDataSub$ =
          this.entityService.requestBulkEntitySummary(entities);
        this.pluginStatus$ = of(statuses);
      }),
      ops.shareReplay(1),
    );
  }

  protected convertStatusToTabs(statuses: PluginItemsWithSummary[]): Tab[] {
    return statuses.map((d) => {
      return {
        name: toCapitalCase(d.status),
        template: this.statusContent,
        count: "" + d.num_items,
        context: { row: d },
      };
    });
  }

  enterVersions() {
    // Delay for 1 second then show all of the versions
    this.expandVersionsFuncRef = setTimeout(
      function () {
        this.showAllVersions$.next(true);
      }.bind(this),
      1000,
    );
  }

  exitVersions() {
    // Prevent all versions from being shown and hide them if they are being shown.
    clearTimeout(this.expandVersionsFuncRef);
    this.showAllVersions$.next(false);
  }

  processConfig(dataType: unknown): string {
    // Convert the file type to an object from a string.
    const parsedData = JSON.parse(dataType as string);
    // Guess the type.
    const typedDataType = new Map<string, string[]>(Object.entries(parsedData));
    // Has not form of filtering
    if (typedDataType.size === 0) {
      return "This plugin will process files with content with any file format.";
    }
    // Has content filtering
    if (typedDataType.has("content")) {
      const contentList = typedDataType.get("content");
      return (
        "This plugin will process files with the content file format prefix: " +
        contentList.join(", ")
      );
    }
    const filterLabels = Array.from(typedDataType.keys());
    // Has filtering that isn't content
    return (
      "This plugin has custom filtering on the streams (refer to config for detail): " +
      filterLabels.join(",")
    );
  }
}
