import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { BinariesCompareComponent } from "./entities-compare/entities-compare.component";
import { BinariesCurrentComponent } from "./entities-current/entities-current.component";
import { BinariesExploreComponent } from "./entities-explore/entities-explore.component";
import { BinariesHashLookupComponent } from "./entities-hash-lookup/entities-hash-lookup.component";
import { BinariesPurgeComponent } from "./entities-purge/entities-purge.component";
import { BinariesTagsExploreComponent } from "./entities-tags-explore/entities-tags-explore.component";
import { BinariesUploadComponent } from "./entities-upload/entities-upload.component";
import { FeaturesCurrentComponent } from "./features-current/features-current.component";
import { FeaturesExploreComponent } from "./features-explore/features-explore.component";
import { FeaturesPivotComponent } from "./features-pivot/features-pivot.component";
import { FeaturesTagsCurrentComponent } from "./features-tags-current/features-tags-current.component";
import { FeaturesTagsExploreComponent } from "./features-tags-explore/features-tags-explore.component";
import { FrontComponent } from "./front/front.component";
import { PagesComponent } from "./pages.component";
import { PluginsCurrentComponent } from "./plugins-current/plugins-current.component";
import { PluginsExploreComponent } from "./plugins-explore/plugins-explore.component";
import { SourcesCurrentComponent } from "./sources-current/sources-current.component";
import { SourcesExploreComponent } from "./sources-explore/sources-explore.component";
import { TestbedComponent } from "./testbed/testbed.component";

const routes: Routes = [
  {
    path: "",
    component: PagesComponent,
    children: [
      { path: "home", component: FrontComponent },
      {
        path: "binaries",
        children: [
          { path: "", redirectTo: "explore", pathMatch: "full" },
          { path: "upload", component: BinariesUploadComponent },
          {
            path: "upload/child/:sha256",
            component: BinariesUploadComponent,
          },
          { path: "explore", component: BinariesExploreComponent },
          {
            // Redirect old current/binary/:sha256 to new current/:sha256 for peoples old links.
            path: "current/:entityType/:sha256",
            redirectTo: "current/:sha256",
          },
          {
            path: "current/:sha256",
            component: BinariesCurrentComponent,
            data: { noMargin: true, noScroll: true },
          },
          { path: "tags", component: BinariesTagsExploreComponent },
          { path: "compare", component: BinariesCompareComponent },
          { path: "hash_lookup", component: BinariesHashLookupComponent },
          { path: "purge", component: BinariesPurgeComponent },
        ],
      },
      // 'entities' used to be what we would path to for all binaries
      // to prevent dead links, this is redirected since 2022-02
      { path: "entities", redirectTo: "binaries", pathMatch: "prefix" },
      {
        path: "sources",
        children: [
          { path: "", redirectTo: "explore", pathMatch: "full" },
          { path: "explore", component: SourcesExploreComponent },
          { path: "current/:sourceId", component: SourcesCurrentComponent },
        ],
      },
      {
        path: "features",
        children: [
          { path: "", redirectTo: "explore", pathMatch: "full" },
          { path: "explore", component: FeaturesExploreComponent },
          { path: "pivot", component: FeaturesPivotComponent, data: { noScroll: true }, },
          { path: "tags", component: FeaturesTagsExploreComponent },
          { path: "tags/:tag", component: FeaturesTagsCurrentComponent },
          { path: "current/:feature", component: FeaturesCurrentComponent },
        ],
      },
      {
        path: "plugins",
        children: [
          { path: "", redirectTo: "explore", pathMatch: "full" },
          { path: "explore", component: PluginsExploreComponent },
          {
            path: "current/:name/versions/:version",
            component: PluginsCurrentComponent,
          },
        ],
      },
      { path: "test", component: TestbedComponent },
      { path: "", redirectTo: "home", pathMatch: "full" },
      { path: "**", redirectTo: "home", pathMatch: "full" },
    ],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  declarations: [],
  exports: [RouterModule],
})
export class PagesRoutingModule {}
