import { CommonModule, KeyValuePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

import { AzCoreModule } from "@app/core/core.module";

import { NgxSliderModule } from "@angular-slider/ngx-slider";
import { EntityContentSearchComponent } from "./entity-content-search/entity-content-search.component";
import { EntityResultsComponent } from "./entity-results/entity-results.component";
import { EntityTableRowComponent } from "./entity-table-row/entity-table-row.component";
import { EntityTableComponent } from "./entity-table/entity-table.component";
import { EntityTagsComponent } from "./entity-tags/entity-tags.component";
import { EntropyComponent } from "./entropy/entropy.component";
import { FeatureValueTagsComponent } from "./feature-value-tags/feature-value-tags.component";
import { LoadingCardComponent } from "./loading-card/loading-card.component";
import { MonacoEditorComponent } from "./monaco-editor/monaco-editor.component";
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

import { OverlayModule } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { FormsModule } from "@angular/forms";
import { FormField } from "@angular/forms/signals";
import { FlowModule } from "@lib/flow/flow.module";
import { MonacoEditorModule } from "ngx-monaco-editor-v2";
import { BannersComponent } from "./banners/banners.component";
import { EntitySearchComponent } from "./entity-search/entity-search.component";
import { EntitySummaryComponent } from "./entity-summary/entity-summary.component";
import { HoverTextableComponent } from "./hover-textable/hover-textable.component";
import { LoadingContentComponent } from "./loading-content/loading-content.component";
import { LoadingIndicatorFailedComponent } from "./loading-indicator-failed/loading-indicator-failed.component";
import { LoadingIndicatorComponent } from "./loading-indicator/loading-indicator.component";
import { OffsetPickerComponent } from "./offset-picker/offset-picker.component";
import { SettingsOverlayComponent } from "./settings-overlay/settings-overlay.component";
import { SourcePickerComponent } from "./source-picker/source-picker.component";
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
    SourcePickerComponent,
    HoverTextableComponent,
  ],
  imports: [
    CommonModule,
    ScrollingModule,
    FormField,
    AzCoreModule,
    RouterModule,
    FontAwesomeModule,
    KeyValuePipe,
    FlowModule,
    OverlayModule,
    FormsModule,
    TagPickerComponent,
    NgxSliderModule,
    MonacoEditorComponent,
    MonacoEditorModule.forRoot({
      baseUrl: "./assets/monaco/min/vs",
    }),
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
    SourcePickerComponent,
    EntityResultsComponent,
    LoadingIndicatorFailedComponent,
    LoadingIndicatorComponent,
    LoadingContentComponent,
    OffsetPickerComponent,
    SettingsOverlayComponent,
    HoverTextableComponent,
    MonacoEditorComponent,
  ],
})
export class AzCommonModule {}
