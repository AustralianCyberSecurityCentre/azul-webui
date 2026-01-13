import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

import { AzCoreModule } from "src/app/core/core.module";

import { EntityContentSearchComponent } from "./entity-content-search/entity-content-search.component";
import { EntityTableComponent } from "./entity-table/entity-table.component";
import { EntityTableRowComponent } from "./entity-table-row/entity-table-row.component";
import { EntityTagsComponent } from "./entity-tags/entity-tags.component";
import { EntropyComponent } from "./entropy/entropy.component";
import { EntityResultsComponent } from "./entity-results/entity-results.component";
import { FeatureValueTagsComponent } from "./feature-value-tags/feature-value-tags.component";
import { LoadingCardComponent } from "./loading-card/loading-card.component";
import { SecurityLimitComponent } from "./security-limit/security-limit.component";
import { SecurityPickerComponent } from "./security-picker/security-picker.component";

import {
  AuthorPipe,
  FilesizePipe,
  FriendlyTimePipe,
  HexPipe,
  JoinPipe,
  SincePipe,
  UserInitialsPipe,
} from "./reflow.pipe";

import { HoverTextableComponent } from "./hover-textable/hover-textable.component";
import { LoadingIndicatorComponent } from "./loading-indicator/loading-indicator.component";
import { LoadingIndicatorFailedComponent } from "./loading-indicator-failed/loading-indicator-failed.component";
import { LoadingContentComponent } from "./loading-content/loading-content.component";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { SettingsOverlayComponent } from "./settings-overlay/settings-overlay.component";
import { FlowModule } from "src/lib/flow/flow.module";
import { OverlayModule } from "@angular/cdk/overlay";
import { EntitySummaryComponent } from "./entity-summary/entity-summary.component";
import { EntitySearchComponent } from "./entity-search/entity-search.component";
import { OffsetPickerComponent } from "./offset-picker/offset-picker.component";
import { BannersComponent } from "./banners/banners.component";
import { FormsModule } from "@angular/forms";
import { TagPickerComponent } from "./tag-picker/tag-picker.component";

@NgModule({
  declarations: [
    SincePipe,
    FilesizePipe,
    FriendlyTimePipe,
    JoinPipe,
    HexPipe,
    AuthorPipe,
    UserInitialsPipe,
    BannersComponent,
    EntityTableComponent,
    EntityTableRowComponent,
    SecurityLimitComponent,
    LoadingCardComponent,
    FeatureValueTagsComponent,
    SecurityPickerComponent,
    EntityContentSearchComponent,
    EntityTagsComponent,
    EntitySearchComponent,
    EntitySummaryComponent,
    EntropyComponent,
    EntityResultsComponent,
    LoadingIndicatorFailedComponent,
    LoadingIndicatorComponent,
    LoadingContentComponent,
    OffsetPickerComponent,
    SettingsOverlayComponent,
    HoverTextableComponent,
  ],
  imports: [
    CommonModule,
    ScrollingModule,
    AzCoreModule,
    RouterModule,
    FontAwesomeModule,
    FlowModule,
    OverlayModule,
    FormsModule,
    TagPickerComponent,
  ],
  exports: [
    SincePipe,
    FilesizePipe,
    FriendlyTimePipe,
    JoinPipe,
    HexPipe,
    AuthorPipe,
    UserInitialsPipe,
    BannersComponent,
    EntityTableComponent,
    EntityTableRowComponent,
    SecurityLimitComponent,
    LoadingCardComponent,
    FeatureValueTagsComponent,
    SecurityPickerComponent,
    EntityContentSearchComponent,
    EntityTagsComponent,
    EntitySearchComponent,
    EntitySummaryComponent,
    EntropyComponent,
    EntityResultsComponent,
    LoadingIndicatorFailedComponent,
    LoadingIndicatorComponent,
    LoadingContentComponent,
    OffsetPickerComponent,
    SettingsOverlayComponent,
    HoverTextableComponent,
  ],
})
export class AzCommonModule {}
