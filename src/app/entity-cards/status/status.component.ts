import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  WritableSignal,
} from "@angular/core";
import { combineLatest, Observable, of } from "rxjs";
import * as ops from "rxjs/operators";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { signal } from "@angular/core";
import { components } from "@app/core/api/openapi";
import { STATUS_DESCRIPTIONS } from "@app/core/plugin-status-descriptions";
import {
  faBolt,
  faChevronDown,
  faChevronRight,
  faDownload,
  faFileCirclePlus,
  faInfoCircle,
  faRotate,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { BaseCard } from "../base-card.component";
type LatestStatus = {
  timestamp?: string;
  dataLength?: number;
};

type CombinedAuthorStatus = {
  [version: string]: {
    status?: components["schemas"]["azul_bedrock__models_restapi__binaries__StatusEvent"];
    featureEvents: components["schemas"]["EntityInstance"][];
    author: components["schemas"]["EntityInstanceAuthor"];
    classification: string;
    shortName?: string;
    multiPluginKey?: string;
    isRootPlugin?: boolean;
  };
};

@Component({
  selector: "azec-statuses",
  templateUrl: "./status.component.html",
  styleUrls: ["./status.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StatusComponent extends BaseCard implements OnInit {
  private dialogService = inject(Dialog);

  help = `
This panel lists the status of plugins running over the file.

It can only track the states of plugins that have started running over the file or have completed recently.

For plugins that have completed and published results, refer to the 'Authors' panel.

`;
  protected faInfoCircle = faInfoCircle;
  protected faDownload = faDownload;
  protected faFileCirclePlus = faFileCirclePlus;
  protected faRotate = faRotate;
  protected faSpinner = faSpinner;
  protected faBolt = faBolt;
  protected faChevronRight = faChevronRight;
  protected faChevronDown = faChevronDown;

  protected expedite$: Observable<number>;

  protected ACTION_NAMES = {
    enriched: "Enriched",
    mapped: "Mapped",
    sourced: "Inserted",
    derived: "Derived",
  };

  protected STATUS_DESCRIPTIONS = STATUS_DESCRIPTIONS;

  combinedStatuses$: Observable<Map<string, CombinedAuthorStatus>>;
  private currentDialog?: DialogRef;
  protected hiddenMultiPlugins: WritableSignal<string[]> = signal([]);
  whatPluginIsBeingExpeditedSignal: WritableSignal<string> = signal("");

  ngOnInit() {
    let latestStatus: LatestStatus = null;

    const filteredStatuses$ = this.currentEntity$.pipe(
      ops.mergeMap((d) => d.statuses$),
      // if latest hasn't changed don't update DOM
      ops.filter((d) => {
        if (d.length == 0) {
          return true;
        }
        const latest = d.reduce((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? a : b,
        ).timestamp;
        // check if no statuses have been set, lastest timestamp or number of statuses hasn't changed
        if (
          latest &&
          latestStatus &&
          latest == latestStatus.timestamp &&
          d.length == latestStatus.dataLength
        ) {
          return false;
        }
        latestStatus = { timestamp: latest, dataLength: d.length };
        return true;
      }),
    );

    this.combinedStatuses$ = combineLatest([
      this.currentEntity$.pipe(ops.mergeMap((d) => d.instances$)),
      filteredStatuses$,
    ]).pipe(
      ops.map(([instances, statuses]) => {
        // Merge statuses and feature authors (instances) on a key of the author's name
        const combinedDict: Map<string, CombinedAuthorStatus> = new Map<
          string,
          CombinedAuthorStatus
        >();

        // Iterate over statuses and initally create them dictionaries in combinedDict
        // keyed by the author name then author version
        for (const status of statuses) {
          if (!combinedDict.has(status.author.name)) {
            combinedDict.set(status.author.name, {});
          }

          if (
            !(status.author.version in combinedDict.get(status.author.name))
          ) {
            combinedDict.get(status.author.name)[status.author.version] = {
              featureEvents: [],
              author: status.author,
              status: status,
              classification: status.security,
              shortName: "",
            };
          } else {
            combinedDict.get(status.author.name)[status.author.version][
              "status"
            ] = status;
          }
        }

        // Merge in feature creation events, creating new dictionaries if a status
        // message for a plugin doesn't exist
        for (const featureEvent of instances) {
          if (!combinedDict.has(featureEvent.author.name)) {
            combinedDict.set(featureEvent.author.name, {});
          }

          if (
            !(
              featureEvent.author.version in
              combinedDict.get(featureEvent.author.name)
            )
          ) {
            combinedDict.get(featureEvent.author.name)[
              featureEvent.author.version
            ] = {
              featureEvents: [featureEvent],
              author: featureEvent.author,
              // Default the classification in case a status message was not found
              classification: featureEvent.author.security,
              shortName: "",
            };
          } else {
            const tempAuthorRef = combinedDict.get(featureEvent.author.name);
            tempAuthorRef[featureEvent.author.version]["featureEvents"].push(
              featureEvent,
            );
          }
        }

        const sortedCombinedDict: Map<string, CombinedAuthorStatus> = new Map<
          string,
          CombinedAuthorStatus
        >([...combinedDict].sort((a, b) => a[0].localeCompare(b[0])));

        // Add a 'undefined' element to feature events if one does not exist (to allow for at least one
        // row to be rendered)
        // And add
        let lastSeenMultiPlugin = "";
        let lastSeenMultiPluginWithDash = "";
        for (const [currentPluginName, pluginResults] of sortedCombinedDict) {
          for (const [_versionName, versionResults] of Object.entries(
            pluginResults,
          )) {
            // fixup feature events to have undefinied
            if (versionResults.featureEvents.length == 0) {
              versionResults.featureEvents.push(undefined);
            }

            // Determine multi-plugin status.
            if (
              lastSeenMultiPlugin.length > 0 &&
              currentPluginName.startsWith(lastSeenMultiPluginWithDash) &&
              currentPluginName !== lastSeenMultiPlugin
            ) {
              versionResults.multiPluginKey = lastSeenMultiPluginWithDash;
              versionResults.shortName = currentPluginName.slice(
                lastSeenMultiPlugin.length + 1, // +1 includes the dash
              );
              for (const [_rootVersion, rootVersionResults] of Object.entries(
                sortedCombinedDict.get(lastSeenMultiPlugin),
              )) {
                rootVersionResults.isRootPlugin = true;
                rootVersionResults.multiPluginKey = lastSeenMultiPluginWithDash;
              }
            } else {
              lastSeenMultiPlugin = currentPluginName;
              lastSeenMultiPluginWithDash = `${lastSeenMultiPlugin}-`;
            }
          }
        }

        return sortedCombinedDict;
      }),
      ops.shareReplay(1),
    );
  }

  doExpeditePlugin(pluginName: string) {
    if (!pluginName) {
      return;
    }
    this.whatPluginIsBeingExpeditedSignal.set(pluginName);

    this.expedite$ = this.currentEntity$.pipe(
      ops.first(),
      ops.switchMap((ent) => {
        return ent.expeditePlugin(pluginName).pipe(
          ops.delay(1000 * 10),
          ops.catchError((_e) => {
            this.whatPluginIsBeingExpeditedSignal.set("");
            return of(0);
          }),
        );
      }),
      ops.shareReplay(1),
    );
  }
  // Load changes
  doRefresh() {
    window.location.reload();
  }

  protected openDialog(dialog, extra?) {
    this.currentDialog = this.dialogService.open(dialog, extra);
  }

  hideMultiPlugin(mpName: string) {
    this.hiddenMultiPlugins.update((v) => [mpName, ...v]);
  }

  showMultiPlugin(mpName: string) {
    this.hiddenMultiPlugins.update((v) => v.filter((v) => v !== mpName));
  }
}
