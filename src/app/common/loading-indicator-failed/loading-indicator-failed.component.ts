import { Component, Input } from "@angular/core";

@Component({
  selector: "az-loading-indicator-failed",
  templateUrl: "./loading-indicator-failed.component.html",
  standalone: false,
})
export class LoadingIndicatorFailedComponent {
  @Input()
  height: string = "100px";
}
