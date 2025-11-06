import { Component, Injector, OnDestroy, OnInit, inject } from "@angular/core";
import { Store } from "@ngrx/store";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { Subscription } from "rxjs";
import * as globalAction from "./core/store/global-settings/global-actions";
import { colorThemeConfig } from "./core/store/global-settings/global-selector";
import { ColorTheme } from "./core/store/global-settings/global-state.types";
import { config } from "./settings";

@Component({
  selector: "app-root",
  template: `<router-outlet></router-outlet>`,
  styleUrls: ["./app.component.css"],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private injector = inject(Injector);
  private store = inject(Store);

  title = "azul-webui";

  private appTerminationController = new AbortController();
  private storeSubscription: Subscription;

  ngOnInit(): void {
    if (config.oauth_enabled) {
      const oidcSecurityService = this.injector.get(OidcSecurityService);
      oidcSecurityService.checkAuth().subscribe(({ isAuthenticated }) => {
        console.log("callback authenticated", isAuthenticated);
      });
    }

    this.storeSubscription = this.store
      .select(colorThemeConfig)
      .subscribe((theme: ColorTheme) => {
        if (!theme) {
          // No Azul theme set, set this according to the current browser preference
          const theme =
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? ColorTheme.Dark
              : ColorTheme.Light;
          console.log("Configuring initial Azul theme:", theme);

          this.store.dispatch(
            globalAction.setColorTheme({ newColorTheme: theme }),
          );
        } else {
          console.log("Changing DOM Azul theme to", theme);
          // We have a color theme; apply it to the DOM
          if (theme == ColorTheme.Dark) {
            if (!document.documentElement.classList.contains("dark")) {
              document.documentElement.classList.add("dark");
            }
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      });

    // Watch the browser for updates to the color theme
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      (event) => {
        const theme = event.matches ? ColorTheme.Dark : ColorTheme.Light;
        this.store.dispatch(
          globalAction.setColorTheme({ newColorTheme: theme }),
        );
      },
      {
        signal: this.appTerminationController.signal,
      },
    );
  }

  ngOnDestroy(): void {
    this.appTerminationController.abort();
    this.storeSubscription?.unsubscribe();
  }
}
