import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

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
  type = input<ButtonType>(ButtonType.Primary);
  size = input<ButtonSize>(ButtonSize.Medium);
  submit = input<boolean>(false);

  // If the button should be outlined when selected. Useful for
  // tab navigation/accessibility, but doesn't work well in tables.
  outline = input<boolean>(true);
  fullWidth = input<boolean>(false);
  rounded = input<boolean>(true);
  blockCentered = input<boolean>(false);
  disabled = input<boolean>(false);
  noPadding = input<boolean>(false);
}
