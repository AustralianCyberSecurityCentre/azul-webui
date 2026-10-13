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
import { concat, Observable } from "rxjs";
import * as ops from "rxjs/operators";

import {
  faChevronDown,
  faChevronRight,
  faAngleDown,
} from "@fortawesome/free-solid-svg-icons";
import { form } from "@angular/forms/signals";
import { PluginExploreShowColumnModel } from "@app/core/signal-store/global-state.types";
import { GlobalSettingStore } from "@app/core/signal-store/global-settings.store";

type PluginSummaryFast = components["schemas"]["PluginSummary"] & {
  last_completion?: string;
  completion_count?: number;
  error_count?: number;
  completion_percent?: number;
  multiPluginKey?: string;
  isRootPlugin?: boolean;
  shortName?: string;
};

type PluginSummaryComplete = components["schemas"]["PluginSummaryStats"] & {
  multiPluginKey?: string;
  isRootPlugin?: boolean;
  shortName?: string;
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

  plugins$: Observable<PluginSummaryFast[]>;

  constructor() {
    effect(() => {
      this.store.updatePluginExploreViewableColumns(this.showColumns());
    });
  }

  private processPlugins<T extends PluginSummaryFast>(pluginList: T[]): T[] {
    if (pluginList.length === 0) {
      return pluginList;
    }

    pluginList.sort((a, b) => a.name.localeCompare(b.name));

    let lastSeenMultiPlugin = `${pluginList[0].name}-`;
    let lastSeenMultiPluginIndex = 0;

    pluginList.forEach((currentPlugin, index) => {
      const currentPluginName = currentPlugin.name;

      // Calculating on clientside because its just easier and more consistent
      if (
        currentPlugin.completion_count !== undefined &&
        currentPlugin.completion_count !== 0
      ) {
        currentPlugin.completion_percent =
          Math.round(
            1000 *
              (currentPlugin.completion_count /
                (currentPlugin.completion_count + currentPlugin.error_count)),
          ) / 10;
      }

      // ensure it doesn't show 100% if there is a single error
      if (currentPlugin.error_count > 0) {
        currentPlugin.completion_percent = Math.min(
          currentPlugin.completion_percent,
          99.9,
        );
      }

      if (currentPluginName.startsWith(lastSeenMultiPlugin)) {
        currentPlugin.multiPluginKey = lastSeenMultiPlugin;
        currentPlugin.shortName = currentPluginName.slice(
          lastSeenMultiPlugin.length,
        );

        pluginList[lastSeenMultiPluginIndex].isRootPlugin = true;
        pluginList[lastSeenMultiPluginIndex].multiPluginKey =
          lastSeenMultiPlugin;
      } else {
        lastSeenMultiPlugin = `${currentPluginName}-`;
        lastSeenMultiPluginIndex = index;
      }
    });

    return pluginList;
  }

  private clearStats(plugins: PluginSummaryFast[]): void {
    plugins.forEach((plugin) => {
      plugin.last_completion = null;
      plugin.completion_count = null;
      plugin.error_count = null;
      plugin.completion_percent = null;
    });
  }

  ngOnInit(): void {
    this.plugins$ = concat(
      this.api.pluginSummaryGetAllFast().pipe(
        ops.map((plugins) => {
          const pluginList = plugins as PluginSummaryFast[];

          this.clearStats(pluginList);

          return this.processPlugins(pluginList);
        }),
      ),

      this.api
        .pluginSummaryGetAllComplete()
        .pipe(
          ops.map((plugins) =>
            this.processPlugins(plugins as unknown as PluginSummaryComplete[]),
          ),
        ),
    );
  }

  hideMultiPlugin(mpName: string) {
    this.hiddenMultiPlugins.update((v) => [mpName, ...v]);
  }

  showMultiPlugin(mpName: string) {
    this.hiddenMultiPlugins.update((v) => v.filter((v) => v !== mpName));
  }
}
