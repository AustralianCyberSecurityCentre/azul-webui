import { NgModule } from "@angular/core";
import {
  AbstractSecurityStorage,
  AuthModule,
  LogLevel,
} from "angular-auth-oidc-client";

import { base_url, config } from "../../app/settings";
import { LocalStorageService } from "./auth-storage";

@NgModule({
  imports: [
    AuthModule.forRoot({
      config: {
        authority: config.oidc_url,
        unauthorizedRoute: base_url.replace(/\/+$/g, "") + "/unauthorized",
        redirectUrl: base_url.replace(/\/+$/g, "") + "/callback",
        postLogoutRedirectUri: base_url.replace(/\/+$/g, "") + "/",
        clientId: config.oidc_client || "web",
        scope: config.oidc_scopes || "openid profile email offline_access",
        responseType: "code",
        silentRenew: true,
        useRefreshToken: true,
        renewTimeBeforeTokenExpiresInSeconds: 30,
        disableIatOffsetValidation: true,
        autoUserInfo: false,
        ignoreNonceAfterRefresh: true,
        secureRoutes: ["/api/"],
        logLevel: config.oidc_debug ? LogLevel.Debug : LogLevel.Warn,
        customParamsRefreshTokenRequest: {
          scope: config.oidc_scopes,
          resouces: config.oidc_client,
        },
      },
    }),
  ],
  providers: [
    { provide: AbstractSecurityStorage, useClass: LocalStorageService },
  ],
  exports: [AuthModule],
})
export class AuthConfigModule {}
