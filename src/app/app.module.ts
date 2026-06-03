import { DialogModule } from "@angular/cdk/dialog";
import { OverlayModule } from "@angular/cdk/overlay";
import { NgModule, provideZonelessChangeDetection } from "@angular/core";
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
import { MonacoEditorModule } from "ngx-monaco-editor-v2";
import { ToastrModule } from "ngx-toastr";
import { ToastComponent } from "../lib/flow/toast/toast.component";
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
    ToastrModule.forRoot({
      newestOnTop: false,
      toastComponent: ToastComponent,
      timeOut: 3000,
    }),
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
  providers: [IconService, provideZonelessChangeDetection()],
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
