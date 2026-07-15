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
} from "@fortawesome/free-solid-svg-icons";

type PluginSummaryWithMultiPluginIndicator =
  components["schemas"]["PluginStatusSummary"] & {
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
  api = inject(Api);

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faChevronDown = faChevronDown;
  protected faChevronRight = faChevronRight;

  hiddenMultiPlugins: WritableSignal<string[]> = signal([]);

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
        let currentPluginName = "";
        mpUpdatedList.forEach((currentPlugin, index) => {
          currentPluginName = currentPlugin?.newest_version?.name;
          if (
            currentPlugin?.newest_version?.name.startsWith(lastSeenMultiPlugin)
          ) {
            currentPlugin.multiPluginKey = lastSeenMultiPlugin;
            currentPlugin.shortName = currentPlugin?.newest_version?.name.slice(
              lastSeenMultiPlugin.length,
            );
            mpUpdatedList[lastSeenMultiPluginIndex].isRootPlugin = true;
            mpUpdatedList[lastSeenMultiPluginIndex].multiPluginKey =
              lastSeenMultiPlugin;
          } else {
            lastSeenMultiPlugin = `${currentPlugin?.newest_version?.name}-`;
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
