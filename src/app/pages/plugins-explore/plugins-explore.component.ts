import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  WritableSignal,
  effect,
  inject,
  signal,
} from "@angular/core";
import { components } from "@app/core/api/openapi";
import { Api } from "@app/core/services";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";

import {
  faChevronDown,
  faChevronRight,
  faAngleDown,
} from "@fortawesome/free-solid-svg-icons";
import { form } from "@angular/forms/signals";
import { PluginExploreShowColumnModel } from "@app/core/signal-store/global-state.types";
import { GlobalSettingStore } from "@app/core/signal-store/global-settings.store";

type PluginSummaryWithMultiPluginIndicator =
  components["schemas"]["PluginStatusSummary"] & {
    multiPluginKey?: string;
    isRootPlugin?: boolean;
    shortName?: string;
    successPercentage?: number;
  };

@Component({
  selector: "app-plugins-explore",
  templateUrl: "./plugins-explore.component.html",
  styleUrls: ["./plugins-explore.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PluginsExploreComponent implements OnInit {
  private api = inject(Api);
  private store = inject(GlobalSettingStore);

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faChevronDown = faChevronDown;
  protected faChevronRight = faChevronRight;
  protected faAngleDown = faAngleDown;

  hiddenMultiPlugins: WritableSignal<string[]> = signal([]);
  showColumns: WritableSignal<PluginExploreShowColumnModel> = signal({
    version: this.store.pluginPageColumns().version,
    security: this.store.pluginPageColumns().security,
    description: this.store.pluginPageColumns().description,
    last_completed: this.store.pluginPageColumns().last_completed,
    features: this.store.pluginPageColumns().features,
    completed: this.store.pluginPageColumns().completed,
    errors: this.store.pluginPageColumns().errors,
    completed_percent: this.store.pluginPageColumns().completed_percent,
  });
  showColumnsForm = form(this.showColumns);

  plugins$: Observable<PluginSummaryWithMultiPluginIndicator[]>;

  constructor() {
    effect(() => {
      this.store.updatePluginExploreViewableColumns(this.showColumns());
    });
  }

  ngOnInit(): void {
    this.plugins$ = this.api.pluginGetAllStatuses().pipe(
      ops.map((pluginList) => {
        const mpUpdatedList =
          pluginList as PluginSummaryWithMultiPluginIndicator[];
        if (pluginList.length === 0) {
          return mpUpdatedList;
        }
        // Ensure plugins are alphabetically ordered (although they should be)
        mpUpdatedList.sort((a, b) =>
          a?.newest_version?.name?.localeCompare(b?.newest_version?.name),
        );
        let lastSeenMultiPlugin = `${mpUpdatedList[0]?.newest_version?.name}-`;
        let lastSeenMultiPluginIndex = 0;
        mpUpdatedList.forEach((currentPlugin, index) => {
          const success_count = currentPlugin?.success_count;
          let error_count = currentPlugin?.error_count;
          if (error_count === undefined) {
            error_count = 0;
          }
          if (success_count === undefined || success_count === 0) {
            currentPlugin.successPercentage = 0;
          } else {
            currentPlugin.successPercentage =
              Math.round(
                1000 * (success_count / (success_count + error_count)),
              ) / 10;
            if (error_count > 0) {
              currentPlugin.successPercentage = Math.min(
                currentPlugin.successPercentage,
                99.9,
              );
            }
          }

          // Determine multi-plugin status.
          const currentPluginName = currentPlugin?.newest_version?.name;
          if (currentPluginName.startsWith(lastSeenMultiPlugin)) {
            currentPlugin.multiPluginKey = lastSeenMultiPlugin;
            currentPlugin.shortName = currentPluginName.slice(
              lastSeenMultiPlugin.length,
            );
            mpUpdatedList[lastSeenMultiPluginIndex].isRootPlugin = true;
            mpUpdatedList[lastSeenMultiPluginIndex].multiPluginKey =
              lastSeenMultiPlugin;
          } else {
            lastSeenMultiPlugin = `${currentPluginName}-`;
            lastSeenMultiPluginIndex = index;
          }
        });
        return mpUpdatedList;
      }),
      ops.shareReplay(1),
    );
  }

  hideMultiPlugin(mpName: string) {
    this.hiddenMultiPlugins.update((v) => [mpName, ...v]);
  }

  showMultiPlugin(mpName: string) {
    this.hiddenMultiPlugins.update((v) => v.filter((v) => v !== mpName));
  }
}
