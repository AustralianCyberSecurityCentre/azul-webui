import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

import { NgxSliderModule } from "@angular-slider/ngx-slider";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { AzCommonModule } from "src/app/common/common.module";
import { AzCoreModule } from "src/app/core/core.module";
import { AzEntityCardsModule } from "src/app/entity-cards/entity-cards.module";
import { FlowModule } from "src/lib/flow/flow.module";
import { TextIconComponent } from "../common/text-icon/text-icon.component";
import { EntityTabsModule } from "../entity-tabs/entity-tabs";
import { CallbackComponent } from "./callback/callback.component";
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
import { PagesRoutingModule } from "./pages-routing.module";
import { PagesComponent } from "./pages.component";
import { PluginsCurrentComponent } from "./plugins-current/plugins-current.component";
import { PluginsExploreComponent } from "./plugins-explore/plugins-explore.component";
import { SourcesCurrentComponent } from "./sources-current/sources-current.component";
import { SourcesExploreComponent } from "./sources-explore/sources-explore.component";
import { TestbedComponent } from "./testbed/testbed.component";
import { UnauthorizedComponent } from "./unauthorized/unauthorized.component";

@NgModule({
  declarations: [
    PagesComponent,
    BinariesExploreComponent,
    BinariesCurrentComponent,
    SourcesExploreComponent,
    FeaturesExploreComponent,
    FeaturesCurrentComponent,
    FeaturesPivotComponent,
    BinariesUploadComponent,
    SourcesCurrentComponent,
    FrontComponent,
    BinariesTagsExploreComponent,
    BinariesCompareComponent,
    BinariesPurgeComponent,
    PluginsExploreComponent,
    PluginsCurrentComponent,
    TestbedComponent,
    FeaturesTagsExploreComponent,
    FeaturesTagsCurrentComponent,
    BinariesHashLookupComponent,
    UnauthorizedComponent,
    CallbackComponent,
  ],
  imports: [
    CommonModule,
    PagesRoutingModule,
    AzCoreModule,
    AzCommonModule,
    AzEntityCardsModule,
    FormsModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    FlowModule,
    EntityTabsModule,
    TextIconComponent,
    ScrollingModule,
    NgxSliderModule,
  ],
  exports: [CallbackComponent, BinariesExploreComponent],
})
export class PagesModule {}
