import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { ScrollingModule } from "@angular/cdk/scrolling";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

import { AzCommonModule } from "src/app/common/common.module";
import { AzCoreModule } from "src/app/core/core.module";

import { FormsModule } from "@angular/forms";
import { MonacoEditorModule } from "ngx-monaco-editor-v2";
import { FlowModule } from "src/lib/flow/flow.module";
import { EntropyGraphComponent } from "./entropy-graph/entropy-graph.component";
import { FamilyComponent } from "./family/family.component";
import { FeatureTableComponent } from "./feature-table/feature-table.component";
import { HexviewComponent } from "./hexview/hexview.component";
import { ImagePreviewComponent } from "./image-preview/image-preview.component";
import { PdfPreviewComponent } from "./pdf-preview/pdf-preview.component";
import { RelationGraphComponent } from "./relation-graph/relation-graph.component";
import { SandboxResultsComponent } from "./sandbox-results/sandbox-results.component";
import { SimilarComponent } from "./similar/similar.component";
import { SimilarfuzzyhashComponent } from "./similarfuzzyhash/similarfuzzyhash.component";
import { SourceTableComponent } from "./source-table/source-table.component";
import { StatusComponent } from "./status/status.component";
import { StreamTextTabMonacoComponent } from "./stream-text-tab-monaco/stream-text-tab-monaco.component";
import { StringsComponent } from "./strings/strings.component";

@NgModule({
  declarations: [
    FeatureTableComponent,
    RelationGraphComponent,
    EntropyGraphComponent,
    FamilyComponent,
    PdfPreviewComponent,
    StreamTextTabMonacoComponent,
    SourceTableComponent,
    HexviewComponent,
    StringsComponent,
    StatusComponent,
    SimilarComponent,
    SandboxResultsComponent,
    SimilarfuzzyhashComponent,
    ImagePreviewComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    ScrollingModule,
    FontAwesomeModule,
    AzCoreModule,
    AzCommonModule,
    FlowModule,
    FormsModule,
    MonacoEditorModule,
  ],
  exports: [
    FeatureTableComponent,
    RelationGraphComponent,
    EntropyGraphComponent,
    FamilyComponent,
    PdfPreviewComponent,
    StreamTextTabMonacoComponent,
    SourceTableComponent,
    HexviewComponent,
    StringsComponent,
    StatusComponent,
    SimilarComponent,
    SimilarfuzzyhashComponent,
    SandboxResultsComponent,
    ImagePreviewComponent,
  ],
})
export class AzEntityCardsModule {}
