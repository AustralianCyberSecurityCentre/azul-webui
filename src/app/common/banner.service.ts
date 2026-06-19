import { inject, Injectable, signal, WritableSignal } from "@angular/core";
import * as ops from "rxjs/operators";
import { ApiService } from "../core/api/api.service";
export type Banner = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  dismissable: boolean;
};

@Injectable({
  providedIn: "root",
})
export class BannerService {
  private apiService = inject(ApiService);

  public banners: WritableSignal<Banner[]> = signal([]);
  public isReadonly: WritableSignal<boolean> = signal(false);

  private intervalForCheck: number = 1000 * 60; // Check once a minute
  private checkReadonlyIntervalId: number;

  constructor() {
    // Add or remove the readonly banner for azul.
    this.checkReadonlyIntervalId = setInterval(
      this.checkForReadonly,
      this.intervalForCheck, // check once a minute
    );
    this.checkForReadonly();
  }

  addBanner(newBanner: Banner) {
    this.banners.update((existingBanners) => {
      // Ensure any existing banners with the same Id so there is only one banner per id.
      existingBanners = existingBanners.filter((b) => b.id !== newBanner.id);
      return [...existingBanners, newBanner];
    });
  }

  removeBanner(bannerId: string) {
    this.banners.update((existingBanners) => {
      return [...existingBanners.filter((b) => b.id !== bannerId)];
    });
  }

  private checkForReadonly() {
    this.apiService
      .isServerReadOnly()
      .pipe(ops.take(1))
      .subscribe((isReadOnly) => {
        if (isReadOnly) {
          this.isReadonly.set(true);
          this.addBanner({
            id: "readonly",
            severity: "warning",
            message: `Azul is in a readonly state and all uploads will fail!`,
            dismissable: false,
          });
        } else {
          this.isReadonly.set(false);
          // Only run once if the system is not in a readonly state.
          clearInterval(this.checkReadonlyIntervalId);
          this.removeBanner("readonly");
        }
      });
  }
}
