import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  Signal,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { ApiService } from "@app/core/api/api.service";
import { Entropy } from "@app/core/api/info";
import { components } from "@app/core/api/openapi";
import {
  EntityFindRow,
  EntityFindRowWithUpdatedTags,
} from "@app/core/api/state";
import { FeatureService } from "@app/core/feature.service";
import { IconService } from "@app/core/icon.service";
import { Entity } from "@app/core/services";
import * as fromGlobalSettings from "@app/core/store/global-settings/global-selector";
import { UserService } from "@app/core/user.service";
import { allowedToPurge } from "@app/core/util";
import {
  faCircleXmark,
  faClock,
  faEye,
  faEyeSlash,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Store } from "@ngrx/store";
import { BehaviorSubject, Observable } from "rxjs";
import * as ops from "rxjs/operators";

/**Displays a set of binaries in a table, as the result of a entityFind call

Includes highlighting data from elasticsearch.
*/
@Component({
  selector: "az-entity-table-row",
  templateUrl: "./entity-table-row.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntityTableRowComponent {
  entityService = inject(Entity);
  iconService = inject(IconService);
  userService = inject(UserService);
  featureService = inject(FeatureService);
  apiService = inject(ApiService);
  private api = inject(ApiService);
  private store = inject(Store);
  private cdr = inject(ChangeDetectorRef);

  @HostBinding("hidden") isHidden = false;

  protected showEntropySignal: Signal<boolean>;
  protected showMimetypeSignal: Signal<boolean>;
  protected showMagicSignal: Signal<boolean>;

  protected showGraphLevelsSignal: Signal<boolean> = signal(false);

  protected faEye = faEye;
  protected faEyeSlash = faEyeSlash;

  protected entropy$: Observable<Entropy>;

  protected _row: EntityFindRowWithUpdatedTags;

  protected user = inject(UserService);
  protected allowedToPurge = allowedToPurge;
  protected faTrash = faTrash;
  protected faClock = faClock;
  protected faCircleXmark = faCircleXmark;

  @Input()
  get row(): EntityFindRowWithUpdatedTags {
    return this._row;
  }
  set row(data: EntityFindRow) {
    this._row = {
      ...(data as EntityFindRowWithUpdatedTags),
    };
    this.entropy$ = this.api
      .entityReadMain(data.sha256, {
        detail: ["info"],
        author: "Entropy",
      })
      .pipe(
        ops.map((x) => {
          if (
            x !== undefined &&
            x.data !== undefined &&
            x.data.info.length > 0
          ) {
            return x.data.info[0].info["entropy"] as Entropy;
          }
          return null;
        }),
      );
  }

  externalPagination = input<boolean>(false);
  showSources = input<boolean>(true);
  originalSha256 = input<string | undefined>(undefined);
  eType = input<"parents" | "children" | undefined>(undefined);
  retroHuntSearchNames = input<string[] | undefined>(undefined);

  checkChanged = output<boolean>();

  protected onCheckboxChange(checked: boolean) {
    this.checkChanged.emit(checked ?? false);
    this._row.checked = checked;
    this.cdr.markForCheck();
  }

  constructor() {
    this.showEntropySignal = this.store.selectSignal(
      fromGlobalSettings.selectBinaryExploreShowEntropy,
    );
    this.showMimetypeSignal = this.store.selectSignal(
      fromGlobalSettings.selectBinaryExploreShowMimetype,
    );
    this.showMagicSignal = this.store.selectSignal(
      fromGlobalSettings.selectBinaryExploreShowMagic,
    );
  }

  genSourceText(sources: string[]): string {
    if (!sources || sources?.length <= 0) {
      return "";
    }
    let ret = `From ${sources[0]}`;
    if (sources.length > 1) {
      ret += `, ${sources[1]}`;
    }
    if (sources.length > 2) {
      ret += ` and ${sources.length - 2} other`;
    }
    if (sources.length > 3) {
      ret += `s`;
    }
    return ret;
  }

  refreshRowTags(ref: EntityFindRowWithUpdatedTags) {
    if (ref?.tags$ == null) {
      ref.tags$ = new BehaviorSubject<
        readonly components["schemas"]["EntityTag"][]
      >(ref.tags);
    }
    this.entityService.refreshTags(ref.tags$, ref.sha256);
  }

  protected getLinkPurgeParams(
    relationType: "parents" | "children",
    track_link: string,
    thisHash: string,
    relatedHash: string,
    author: string,
  ): Record<string, string> {
    let parentHash = thisHash;
    let childHash = relatedHash;

    if (relationType === "parents") {
      parentHash = relatedHash;
      childHash = thisHash;
    }

    return {
      track_link: track_link,
      author: author,
      parent: parentHash,
      child: childHash,
    };
  }
}
