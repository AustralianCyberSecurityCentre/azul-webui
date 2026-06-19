import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { ApiService } from "src/app/core/api/api.service";
import { config } from "src/app/settings";
import { BannerService } from "../banner.service";
/** Displays banners for system warnings */
@Component({
  selector: "az-banners",
  templateUrl: "./banners.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BannersComponent {
  apiService = inject(ApiService);
  bannerService = inject(BannerService);

  protected faIcons = {
    info: faCircleInfo,
    warning: faCircleExclamation,
    error: faCircleXmark,
  };
  protected faXmark = faXmark;

  constructor() {
    if (config.banner_message) {
      this.bannerService.addBanner({
        id: "config",
        severity: config.banner_severity,
        message: config.banner_message,
        dismissable: !!config.banner_dismissable,
      });
    }
  }

  protected dismissBanner(id: string) {
    this.bannerService.removeBanner(id);
  }
}
