import { Component, OnInit, inject } from "@angular/core";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { Api } from "src/app/core/services";
import { components } from "src/app/core/api/openapi";

@Component({
  selector: "app-plugins-explore",
  templateUrl: "./plugins-explore.component.html",
  styleUrls: ["./plugins-explore.component.css"],
  standalone: false,
})
export class PluginsExploreComponent implements OnInit {
  api = inject(Api);

  plugins$: Observable<readonly components["schemas"]["PluginStatusSummary"][]>;
  ngOnInit(): void {
    this.plugins$ = this.api.pluginGetAllStatuses().pipe(ops.shareReplay(1));
  }
}
