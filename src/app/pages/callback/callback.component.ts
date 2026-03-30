import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-callback",
  templateUrl: "./callback.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CallbackComponent {}
