import { Component, OnInit, inject } from "@angular/core";
import { combineLatest, Observable } from "rxjs";
import * as ops from "rxjs/operators";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { STATUS_DESCRIPTIONS } from "src/app/core/plugin-status-descriptions";
import { BaseCard } from "../base-card.component";
import { components } from "src/app/core/api/openapi";

type LatestStatus = {
  timestamp?: string;
  dataLength?: number;
};

type CombinedAuthorStatus = {
  [key: string]: {
    [version: string]: {
      status?: components["schemas"]["StatusEvent"];
      featureEvents: components["schemas"]["EntityInstance"][];
      author: components["schemas"]["EntityInstanceAuthor"];
      classification: string;
    };
  };
};

@Component({
  selector: "azec-statuses",
  templateUrl: "./status.component.html",
  styleUrls: ["./status.component.css"],
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

  protected ACTION_NAMES = {
    enriched: "Enriched",
    mapped: "Mapped",
    sourced: "Inserted",
    derived: "Derived",
  };

  protected STATUS_DESCRIPTIONS = STATUS_DESCRIPTIONS;

  combinedStatuses$: Observable<CombinedAuthorStatus>;
  private currentDialog?: DialogRef;

  ngOnInit() {
    let latestStatus: LatestStatus = null;

    const filteredStatuses$ = this._current_entity$.pipe(
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
      this._current_entity$.pipe(ops.mergeMap((d) => d.instances$)),
      filteredStatuses$,
    ]).pipe(
      ops.map(([instances, statuses]) => {
        // Merge statuses and feature authors (instances) on a key of the author's name
        const combinedDict: CombinedAuthorStatus = {};

        // Iterate over statuses and initally create them dictionaries in combinedDict
        // keyed by the author name then author version
        for (const status of statuses) {
          if (!(status.author.name in combinedDict)) {
            combinedDict[status.author.name] = {};
          }

          if (!(status.author.version in combinedDict[status.author.name])) {
            combinedDict[status.author.name][status.author.version] = {
              featureEvents: [],
              author: status.author,
              status: status,
              classification: status.security,
            };
          } else {
            combinedDict[status.author.name][status.author.version]["status"] =
              status;
          }
        }

        // Merge in feature creation events, creating new dictionaries if a status
        // message for a plugin doesn't exist
        for (const featureEvent of instances) {
          if (!(featureEvent.author.name in combinedDict)) {
            combinedDict[featureEvent.author.name] = {};
          }

          if (
            !(
              featureEvent.author.version in
              combinedDict[featureEvent.author.name]
            )
          ) {
            combinedDict[featureEvent.author.name][
              featureEvent.author.version
            ] = {
              featureEvents: [featureEvent],
              author: featureEvent.author,
              // Default the classification in case a status message was not found
              classification: featureEvent.author.security,
            };
          } else {
            combinedDict[featureEvent.author.name][featureEvent.author.version][
              "featureEvents"
            ].push(featureEvent);
          }
        }

        // Add a 'undefined' element to feature events if one does not exist (to allow for at least one
        // row to be rendered)
        for (const [_pluginName, pluginResults] of Object.entries(
          combinedDict,
        )) {
          for (const [_versionName, versionResults] of Object.entries(
            pluginResults,
          )) {
            if (versionResults.featureEvents.length == 0) {
              versionResults.featureEvents.push(undefined);
            }
          }
        }

        return combinedDict;
      }),
      ops.shareReplay(1),
    );
  }

  protected openDialog(dialog, extra?) {
    this.currentDialog = this.dialogService.open(dialog, extra);
  }

  protected readonly console = console;
}
