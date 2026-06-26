import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "az-loading-indicator",
  templateUrl: "./loading-indicator.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingIndicatorComponent {
  animated = input<boolean>(true);
  height = input<string>("125px");
}
