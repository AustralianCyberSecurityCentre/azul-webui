import { DialogModule } from "@angular/cdk/dialog";
import { OverlayModule } from "@angular/cdk/overlay";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { base_url, config } from "./settings";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { IconService } from "./core/icon.service";

import {
  NavigationActionTiming,
  RouterState,
  StoreRouterConnectingModule,
} from "@ngrx/router-store";
import { StoreModule } from "@ngrx/store";
import { provideHotToastConfig } from "@ngxpert/hot-toast";
import { MonacoEditorModule } from "ngx-monaco-editor-v2";
import { AuthConfigModule } from "./auth/auth-config.module";
import { reducers } from "./core/store/main-store";
import { PagesModule } from "./pages/pages.module";

const extraModules: NgModule["imports"] = [];

if (config.oauth_enabled) {
  extraModules.push(AuthConfigModule);
  console.log("add extra module: AuthConfigModule");
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    ...extraModules,
    BrowserModule,
    AppRoutingModule,
    PagesModule,
    DialogModule,
    OverlayModule,
    StoreModule.forRoot(reducers),
    StoreRouterConnectingModule.forRoot({
      routerState: RouterState.Minimal,
      navigationActionTiming: NavigationActionTiming.PostActivation,
    }),
    MonacoEditorModule.forRoot({
      // The Angular router can inject paths that can confuse Monaco
      baseUrl: new URL("./assets/monaco/min/vs", base_url).href,
    }),
  ],
  providers: [
    IconService,
    provideHotToastConfig({
      visibleToasts: 10,
      autoClose: true,
      position: "bottom-right",
      className:
        "custom-hot-toast block rounded-lg border textx-black shadow-sm dark:text-white",
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor() {
    console.debug(
      "app.module: extra modules loaded",
      extraModules!.map((d) => d["name"]),
    );
  }
}
