import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { ScrollingModule } from "@angular/cdk/scrolling";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

import { NgxSliderModule } from "@angular-slider/ngx-slider";
import { FormsModule } from "@angular/forms";
import { AzCommonModule } from "@app/common/common.module";
import { AzCoreModule } from "@app/core/core.module";
import { FlowModule } from "@lib/flow/flow.module";
import { MonacoEditorModule } from "ngx-monaco-editor-v2";
import { EntropyGraphComponent } from "./entropy-graph/entropy-graph.component";
import { FamilyComponent } from "./family/family.component";
import { FeatureTableComponent } from "./feature-table/feature-table.component";
import { HexviewComponent } from "./hexview/hexview.component";
import { ImagePreviewComponent } from "./image-preview/image-preview.component";
import { PdfPreviewComponent } from "./pdf-preview/pdf-preview.component";
import { RelationGraphComponent } from "./relation-graph/relation-graph.component";
import { SandboxResultsComponent } from "./sandbox-results/sandbox-results.component";
import { SimilarEntropyComponent } from "./similar-entropy/similar-entropy.component";
import { SimilarFeatureComponent } from "./similar-features/similar-features.component";
import { SimilarfuzzyhashComponent } from "./similarfuzzyhash/similarfuzzyhash.component";
import { SourceTableComponent } from "./source-table/source-table.component";
import { StatusComponent } from "./status/status.component";
import { StreamMergedTextTabMonacoComponent } from "./stream-merged-text-tab-monaco/stream-merged-text-tab-monaco.component";
import { StreamTextTabMonacoComponent } from "./stream-text-tab-monaco/stream-text-tab-monaco.component";
import { StringsComponent } from "./strings/strings.component";
import { EntitySummaryComponent } from "./entity-summary/entity-summary.component";
import { FormField } from "@angular/forms/signals";

@NgModule({
  declarations: [
    FeatureTableComponent,
    RelationGraphComponent,
    EntropyGraphComponent,
    FamilyComponent,
    PdfPreviewComponent,
    StreamTextTabMonacoComponent,
    StreamMergedTextTabMonacoComponent,
    SourceTableComponent,
    HexviewComponent,
    StringsComponent,
    StatusComponent,
    SimilarFeatureComponent,
    SandboxResultsComponent,
    SimilarfuzzyhashComponent,
    SimilarEntropyComponent,
    ImagePreviewComponent,
    EntitySummaryComponent,
  ],
  imports: [
    FormField,
    CommonModule,
    RouterModule,
    ScrollingModule,
    FontAwesomeModule,
    AzCoreModule,
    AzCommonModule,
    FlowModule,
    FormsModule,
    MonacoEditorModule,
    NgxSliderModule,
  ],
  exports: [
    FeatureTableComponent,
    RelationGraphComponent,
    EntropyGraphComponent,
    FamilyComponent,
    PdfPreviewComponent,
    StreamTextTabMonacoComponent,
    StreamMergedTextTabMonacoComponent,
    SourceTableComponent,
    HexviewComponent,
    StringsComponent,
    StatusComponent,
    SimilarFeatureComponent,
    SimilarfuzzyhashComponent,
    SimilarEntropyComponent,
    SandboxResultsComponent,
    ImagePreviewComponent,
    EntitySummaryComponent,
  ],
})
export class AzEntityCardsModule {}
