import { Component, Input } from "@angular/core";

@Component({
  selector: "az-loading-indicator",
  templateUrl: "./loading-indicator.component.html",
  standalone: false,
})
export class LoadingIndicatorComponent {
  @Input()
  animated = true;
  @Input()
  height: string = "125px";
}
