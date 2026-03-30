import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  selector: "az-loading-indicator-failed",
  templateUrl: "./loading-indicator-failed.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingIndicatorFailedComponent {
  @Input()
  height: string = "125px";
}
