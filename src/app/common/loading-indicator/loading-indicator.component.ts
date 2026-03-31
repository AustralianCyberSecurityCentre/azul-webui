import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  selector: "az-loading-indicator",
  templateUrl: "./loading-indicator.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingIndicatorComponent {
  @Input()
  animated = true;
  @Input()
  height: string = "125px";
}
