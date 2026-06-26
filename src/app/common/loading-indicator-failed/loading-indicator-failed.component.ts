import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "az-loading-indicator-failed",
  templateUrl: "./loading-indicator-failed.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingIndicatorFailedComponent {
  height = input<string>("125px");
}
