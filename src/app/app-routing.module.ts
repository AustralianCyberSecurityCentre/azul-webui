import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AutoLoginPartialRoutesGuard } from "angular-auth-oidc-client";

import { config } from "src/app/settings";
import { CallbackComponent } from "./pages/callback/callback.component";
import { UnauthorizedComponent } from "./pages/unauthorized/unauthorized.component";

// Optional oidc auth
const pagesRoute: Routes = [];
if (config.oauth_enabled) {
  pagesRoute.push({
    path: "pages",
    loadChildren: () =>
      import("src/app/pages/pages.module").then((m) => m.PagesModule),
    canLoad: [AutoLoginPartialRoutesGuard],
  });
} else {
  pagesRoute.push({
    path: "pages",
    loadChildren: () =>
      import("src/app/pages/pages.module").then((m) => m.PagesModule),
  });
}
// Additional routes should also be added to nginx.conf to avoid 404s
const routes: Routes = [
  { path: "", redirectTo: "pages", pathMatch: "full" },
  { path: "callback", component: CallbackComponent },
  {
    path: "unauthorized",
    component: UnauthorizedComponent,
  },
  ...pagesRoute,
  { path: "**", redirectTo: "pages" },
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forRoot(routes, {
      anchorScrolling: "enabled",
    }),
  ],
  declarations: [],
  exports: [RouterModule],
})
export class AppRoutingModule {}
