import { Component, Input } from "@angular/core";

@Component({
  selector: "az-loading-indicator",
  templateUrl: "./loading-indicator.component.html",
  styleUrls: ["./loading-indicator.component.css"],
  standalone: false,
})
export class LoadingIndicatorComponent {
  @Input()
  animated = true;
  @Input()
  height: string = "100px";
}
