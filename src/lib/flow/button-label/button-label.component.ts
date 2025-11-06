import { ChangeDetectionStrategy, Component } from "@angular/core";

// https://flowbite.com/docs/components/buttons/#button-with-label

@Component({
  selector: "flow-button-label",
  templateUrl: "./button-label.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class ButtonLabelComponent {}
