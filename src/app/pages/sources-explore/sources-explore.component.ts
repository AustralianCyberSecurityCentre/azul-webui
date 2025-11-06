import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAmbulance,
  faBell,
  faBinoculars,
  faBomb,
  faBook,
  faBug,
  faCloudDownload,
  faCloudDownloadAlt,
  faGears,
  faHeartbeat,
  faScrewdriverWrench,
  faSearch,
  faShield,
  faShieldAlt,
  faTrash,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";

import { Api } from "src/app/core/services";

interface source_kv_with_observables {
  key: string;
  value: components["schemas"]["azul_bedrock__models_settings__Source"];
  number_binaries: Observable<number>;
  newest: Observable<string>;
  icon: IconDefinition;
}

/**
 * Mappings between icon_class magic values and FA icons.
 *
 * Updates to icon mappings MUST be reflected in documentation.
 */
const ICON_MAPPINGS = {
  gears: faGears,
  ambulance: faAmbulance,
  book: faBook,
  bug: faBug,
  search: faSearch,
  trash: faTrash,
  "trash-alt": faTrashAlt,
  "cloud-download": faCloudDownload,
  "cloud-download-alt": faCloudDownloadAlt,
  binoculars: faBinoculars,
  heartbeat: faHeartbeat,
  shield: faShield,
  "shield-alt": faShieldAlt,
  "screwdriver-wrench": faScrewdriverWrench,
  bell: faBell,
  bomb: faBomb,
};

/**page for displaying all sources currently registered in azul*/
@Component({
  selector: "app-sources-explore",
  templateUrl: "./sources-explore.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourcesExploreComponent implements OnInit {
  api = inject(Api);

  sources$: Observable<source_kv_with_observables[]>;

  ngOnInit(): void {
    this.sources$ = this.api.sourceReadAll().pipe(
      ops.map((sourceList) => {
        const result = new Array<source_kv_with_observables>();
        for (const source_key in sourceList) {
          const source_value = sourceList[source_key];
          const numBinaries$ = this.api.sourceRead(source_key).pipe(
            ops.map((row) =>
              row?.num_entities != undefined ? row.num_entities : 0,
            ),
            ops.shareReplay(),
          );
          const newest$ = this.api.sourceRead(source_key).pipe(
            ops.map((row) =>
              row?.newest != undefined ? `${row.newest}` : null,
            ),
            ops.shareReplay(),
          );

          // Lookup the icon for this source
          const iconName = source_value?.icon_class;

          const icon =
            iconName in ICON_MAPPINGS ? ICON_MAPPINGS[iconName] : faBug;

          result.push({
            key: source_key,
            value: source_value,
            number_binaries: numBinaries$,
            newest: newest$,
            icon,
          });
        }
        return result;
      }),
    );
  }
}
