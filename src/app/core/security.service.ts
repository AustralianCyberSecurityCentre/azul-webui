import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, of } from "rxjs";
import * as ops from "rxjs/operators";

import { ApiService } from "src/app/core/api/api.service";

import { OidcSecurityService } from "angular-auth-oidc-client";
import { config } from "../settings";
import { components } from "./api/openapi";
import { MutableSettings } from "./api/state";

@Injectable({
  providedIn: "root",
})
export class SecurityService {
  private api = inject(ApiService);
  private oidc = inject(OidcSecurityService);

  dbg = (...d) => console.debug("SecurityService:", ...d);
  err = (...d) => console.error("SecurityService:", ...d);

  /**presets and configuration data for security*/
  settings$: Observable<components["schemas"]["Settings"]>;
  userSpecificSecuritySettings$: Observable<MutableSettings>;
  /**current session security object in banner*/
  displayMaxSecurity$: Observable<string>;

  // these are labels we want to restrict to what the user can actually access, when picking security
  restrictedSecurityLabels: string[] = ["classification", "caveat", "tlp"];

  private reauthenticating = false;

  constructor() {
    this.settings$ = this.api.securitySettings().pipe(
      ops.retry({ count: 5, delay: 2000 }),
      ops.catchError(() => {
        this.dbg(
          "Security service swallowing error, probably due to no auth yet.",
        );
        return of(null);
      }),
      ops.shareReplay(1),
    );

    this.initalise_user_settings();
    this.displayMaxSecurity$ = this.api.receivedSecurities$.pipe(
      ops.map((value) => {
        if (value instanceof Set) {
          return Array.from(value).join(", ");
        }
        return value;
      }),
      ops.shareReplay(1),
    );
  }

  private initalise_user_settings() {
    /* Merges data from two api endpoints to work out what security labels the user should see.
    This removes unwanted security presets and labels and puts the result in the observable
    userSpecificSecuritySettings$.
    */
    this.userSpecificSecuritySettings$ = combineLatest([
      this.settings$,
      this.api.userDetailOpensearch(),
    ]).pipe(
      ops.map(([rawSettings, userDetails]) => {
        // Take a deep copy to prevent modifying original settings.
        const settings = structuredClone(rawSettings) as MutableSettings;
        // filter presets
        settings.presets = userDetails.security.allowed_presets;

        // filter certain label groups so user can only select items they can access
        for (const k of this.restrictedSecurityLabels) {
          settings.labels[k].options = settings.labels[k].options.filter(
            (x) => userDetails.security.labels.indexOf(x.name) >= 0,
          );
        }
        this.dbg("User filtered security settings are:", settings);
        return settings;
      }),
      ops.shareReplay(1),
    );
  }

  /**return normalised security string from list of security labels*/
  render$(secs: string[]) {
    return this.api
      .securityNormalise({ security: secs.join(" ") })
      .pipe(ops.map((d) => d));
  }

  /**Reauthenticate with the OIDC provider, backing out of invalid URLs as required */
  reauthenticate() {
    if (this.reauthenticating) {
      return;
    }

    this.reauthenticating = true;

    if (config.oauth_enabled) {
      this.oidc.logoffLocal();
    }

    // Check if the page we are currently on is a valid refresh target (i.e not /callback, which
    // requires query params, or /unauthorized, which we don't want to send the user back to)
    if (!this.isOnInvalidPage()) {
      // We are on a valid target; just refresh
      window.location.reload();
      return;
    }

    // We want to navigate backwards in history if possible, as
    // We cannot directly interrogate the web browser's history, and instead have to walk
    // the history entry by entry
    if (window.history.length <= 1) {
      // We are starting at the top of the stack (a user has linked to /unauthorized directly, for
      // example)
      window.location.replace("/");
      return;
    }

    // Add a interceptor to discard /callback & /unauthorized requests in the history - these are now invalid
    window.addEventListener("popstate", () => {
      if (window.history.length <= 1) {
        // We have reached the top of the stack and have no history to go back on
        // Navigate to the home page instead
        window.location.replace("/");
        return;
      }

      if (this.isOnInvalidPage()) {
        // Keep going back in history
        // if we have hit a /callback URL, the JWT for this is now invalid (as local storage has
        // been wiped). if this is /unauthorized, we have just hit a duplicate /unauthorized URL (likely
        // due to a user navigating to this page)
        window.history.back();
        return;
      }

      // We've hit a valid path which should land the user on a valid Azul page after reauthenticating.
      // Force a refresh of the page to restart auth:
      window.location.reload();
    });

    // Spam history.back() until we hit somewhere we like in the stack
    window.history.back();
  }

  /** Determines if the page that we are currently on is an invalid refresh target. */
  private isOnInvalidPage() {
    return (
      window.location.pathname == "/callback" ||
      window.location.pathname == "/unauthorized" ||
      window.location.pathname == "/ui/callback" ||
      window.location.pathname == "/ui/unauthorized"
    );
  }

  /** If we are currently reauthenticating to Azul. */
  isReauthenticating() {
    return this.reauthenticating;
  }
}
