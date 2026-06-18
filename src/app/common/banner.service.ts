import { Injectable, signal, WritableSignal } from "@angular/core";

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
  public banners: WritableSignal<Banner[]> = signal([]);

  constructor() {}

  addBanner(newBanner: Banner) {
    this.banners.update((existingBanners) => {
      // Ensure any existing banners with the same Id so there is only one banner per id.
      existingBanners = existingBanners.filter((b) => {
        b.id !== newBanner.id;
      });
      return [...existingBanners, newBanner];
    });
  }

  removeBanner(bannerId: string) {
    this.banners.update((existingBanners) => {
      return [
        ...existingBanners.filter((b) => {
          b.id !== bannerId;
        }),
      ];
    });
  }
}
