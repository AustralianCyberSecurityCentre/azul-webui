import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  ViewChild,
  inject,
  input,
  output,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { HostControlDirective } from "@lib/host-control/host-control.directive";

// https://flowbite.com/docs/forms/input-field/

export type FieldType =
  "text" | "email" | "password" | "number" | "datetime-local";

@Component({
  selector: "flow-input",
  templateUrl: "./input.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, FontAwesomeModule],
  hostDirectives: [HostControlDirective],
})
export class InputComponent {
  @ViewChild("inputElement") inputElement: ElementRef<HTMLInputElement> | null =
    null;

  id = input<string | null>(null);
  required = input<boolean>(false);
  placeholder = input<string>("");
  invalid = input<boolean>(false);
  helpText = input<string | undefined>(undefined);
  fieldType = input<FieldType>("text");
  fieldSize = input<"large" | "medium" | "small">("medium");
  icon = input<IconProp | undefined>(undefined);
  ariaAutocomplete = input<string | null>("none");
  min = input<number | null>(null);
  max = input<number | null>(null);
  step = input<number | null>(null);
  size = input<number | null>(null);
  suffixTpl = input<TemplateRef<unknown> | undefined>(undefined);

  inputFocus = output<FocusEvent>();
  inputFocusOut = output<FocusEvent>();
  inputBlur = output<FocusEvent>();
  inputSelectionChange = output<Event>();

  value = input<string | number>();
  hcd = inject(HostControlDirective);
}
