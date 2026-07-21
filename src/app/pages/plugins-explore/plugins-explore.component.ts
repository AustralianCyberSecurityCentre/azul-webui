import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  WritableSignal,
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

type PluginSummaryWithMultiPluginIndicator =
  components["schemas"]["PluginStatusSummary"] & {
    multiPluginKey?: string;
    isRootPlugin?: boolean;
    shortName?: string;
    successPercentage?: number;
  };

interface PluginExploreShowColumnModel {
  version: boolean;
  security: boolean;
  description: boolean;
  last_completed: boolean;
  features: boolean;
  completed: boolean;
  errors: boolean;
  completed_percent: boolean;
}

@Component({
  selector: "app-plugins-explore",
  templateUrl: "./plugins-explore.component.html",
  styleUrls: ["./plugins-explore.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PluginsExploreComponent implements OnInit {
  api = inject(Api);

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faChevronDown = faChevronDown;
  protected faChevronRight = faChevronRight;
  protected faAngleDown = faAngleDown;

  hiddenMultiPlugins: WritableSignal<string[]> = signal([]);
  showColumns: WritableSignal<PluginExploreShowColumnModel> = signal({
    version: true,
    security: true,
    description: true,
    last_completed: true,
    features: true,
    completed: true,
    errors: true,
    completed_percent: true,
  });
  showColumnsForm = form(this.showColumns);

  plugins$: Observable<PluginSummaryWithMultiPluginIndicator[]>;
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
