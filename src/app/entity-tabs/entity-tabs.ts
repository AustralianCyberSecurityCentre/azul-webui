import { NgModule } from "@angular/core";

import { DataTabPanesComponent } from "./data-tab-panes/data-tab-panes.component";
import { DataTabComponent } from "./data-tab/data-tab.component";
import { RelationsTabComponent } from "./relations-tab/relations-tab.component";
import DebugTabComponent from "./debug-tab/debug-tab.component";
import { DebugTabPaneComponent } from "./debug-tab-pane/debug-tab-pane.component";
import { JsonDebugViewerComponent } from "./json-debug-viewer/json-debug-viewer.component";

@NgModule({
  imports: [
    DataTabComponent,
    DataTabPanesComponent,
    RelationsTabComponent,
    DebugTabComponent,
    DebugTabPaneComponent,
    JsonDebugViewerComponent,
  ],
  exports: [
    DataTabComponent,
    DataTabPanesComponent,
    RelationsTabComponent,
    DebugTabComponent,
    DebugTabPaneComponent,
    JsonDebugViewerComponent,
  ],
})
export class EntityTabsModule {}
