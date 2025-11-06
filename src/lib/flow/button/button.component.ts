import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// https://flowbite.com/docs/components/buttons/

export enum ButtonType {
  Light = "light",
  Dark = "dark",
  Primary = "primary",
  Disabled = "disabled",
  Transparent = "transparent",
  Danger = "danger",
  Yellow = "yellow",
  Green = "green",
  Purple = "purple",
}

export enum ButtonSize {
  Tiny = "tiny",
  Icon = "icon",
  Small = "small",
  Medium = "medium",
  Large = "large",
}

@Component({
  selector: "flow-button",
  templateUrl: "./button.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ButtonComponent {
  @Input()
  type = ButtonType.Primary;

  @Input()
  size = ButtonSize.Medium;

  @Input()
  submit: boolean = false;

  // If the button should be outlined when selected. Useful for
  // tab navigation/accessibility, but doesn't work well in tables.
  @Input()
  outline: boolean = true;

  @Input()
  fullWidth?: boolean;

  @Input()
  rounded: boolean = true;

  @Input()
  blockCentered: boolean = false;
}
