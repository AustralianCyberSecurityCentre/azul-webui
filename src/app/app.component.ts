import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  WritableSignal,
  effect,
  inject,
  signal,
} from "@angular/core";
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from "@angular/router";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { Subscription } from "rxjs";
import { GlobalSettingStore } from "./core/signal-store/global-settings.store";
import { ColorTheme } from "./core/signal-store/global-state.types";
import { config } from "./settings";

@Component({
  selector: "app-root",
  template: `<router-outlet></router-outlet>
    @if (!isLoadingCompleteSignal()) {
      <div class="m-16 text-center text-xl dark:text-white">
        Loading Angular components...
      </div>
    }`,
  styleUrls: ["./app.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private injector = inject(Injector);
  protected store = inject(GlobalSettingStore);
  private router = inject(Router);

  title = "azul-webui";

  private appTerminationController = new AbortController();
  private storeSubscription: Subscription;
  protected isLoadingCompleteSignal: WritableSignal<boolean> = signal(false);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isLoadingCompleteSignal.set(false);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isLoadingCompleteSignal.set(true);
      }
    });

    if (!this.store.theme()) {
      // No Azul theme set, set this according to the current browser preference
      const theme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? ColorTheme.Dark
          : ColorTheme.Light;
      console.log("Configuring initial Azul theme:", theme);

      this.store.updateTheme(theme);
    }

    effect(() => {
      console.log("Changing DOM Azul theme to", this.store.theme());
      // We have a color theme; apply it to the DOM
      if (this.store.theme() == ColorTheme.Dark) {
        if (!document.documentElement.classList.contains("dark")) {
          document.documentElement.classList.add("dark");
        }
      } else {
        document.documentElement.classList.remove("dark");
      }
    });
  }

  ngOnInit(): void {
    if (config.oauth_enabled) {
      const oidcSecurityService = this.injector.get(OidcSecurityService);
      oidcSecurityService.checkAuth().subscribe(({ isAuthenticated }) => {
        console.log("callback authenticated", isAuthenticated);
      });
    }

    // Watch the browser for updates to the color theme
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      (event) => {
        const theme = event.matches ? ColorTheme.Dark : ColorTheme.Light;
        this.store.updateTheme(theme);
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
