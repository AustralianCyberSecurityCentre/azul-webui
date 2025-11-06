import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from "@angular/core";
import {
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { BehaviorSubject, combineLatest, Observable, of } from "rxjs";

import { ApiService } from "src/app/core/api/api.service";
import { SecurityService } from "src/app/core/security.service";

import * as ops from "rxjs/operators";
import { config } from "src/app/settings";

type Banner = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  dismissable: boolean;
};

/** Displays banners for system warnings */
@Component({
  selector: "az-banners",
  templateUrl: "./banners.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BannersComponent {
  securityService = inject(SecurityService);
  api = inject(ApiService);
  changeDetectorRef = inject(ChangeDetectorRef);

  protected faIcons = {
    info: faCircleInfo,
    warning: faCircleExclamation,
    error: faCircleXmark,
  };
  protected faXmark = faXmark;

  private dismissedBanners$ = new BehaviorSubject<string[]>([]);

  protected banners$: Observable<Banner[]>;

  constructor() {
    const staticBanners: Banner[] = [];

    if (config.banner_message) {
      staticBanners.push({
        id: "config",
        severity: config.banner_severity,
        message: config.banner_message,
        dismissable: !!config.banner_dismissable,
      });
    }

    const source: Observable<Banner[]> = of(staticBanners);

    this.banners$ = combineLatest([source, this.dismissedBanners$]).pipe(
      ops.map(([banners, dismissed]) =>
        banners.filter((x) => dismissed.indexOf(x.id) === -1),
      ),
    );
  }

  protected dismissBanner(id: string) {
    const banners = this.dismissedBanners$.value;
    banners.push(id);
    this.dismissedBanners$.next(banners);
  }
}
