import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ModelSignal,
  TemplateRef,
  ViewChild,
  input,
  model,
  output,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { FormValueControl } from "@angular/forms/signals";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

// https://flowbite.com/docs/forms/input-field/

export type FieldType =
  "text" | "email" | "password" | "number" | "datetime-local";

@Component({
  selector: "flow-signal-input",
  templateUrl: "./input-signal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, FontAwesomeModule],
})
export class SignalInputComponent implements FormValueControl<string | number> {
  @ViewChild("inputElement") inputElement: ElementRef<HTMLInputElement>;

  id = input<string | null>(null);
  required = input<boolean>(false);
  invalid = input<boolean>(false);
  dirty = input<boolean>(false);
  // Is a model so it can be updated by blur.
  touched = model<boolean>(false);
  isForceShowInvalid = input<boolean>(false);
  placeholder = input<string>("");

  helpText = input<string | undefined>(undefined);
  fieldType = input<FieldType>("text");
  fieldSize = input<"large" | "medium" | "small">("medium");
  icon = input<IconProp | undefined>(undefined);
  ariaAutocomplete = input<string | undefined>("none");
  min = input<NonNullable<string | number> | undefined>(undefined);
  max = input<NonNullable<string | number> | undefined>(undefined);
  step = input<number | null>(null);
  size = input<number | null>(null);
  suffixTpl = input<TemplateRef<unknown> | undefined>(undefined);

  inputFocus = output<FocusEvent>();
  inputFocusOut = output<FocusEvent>();
  inputBlur = output<FocusEvent>();
  inputSelectionChange = output<Event>();

  value: ModelSignal<string | number> = model<string | number>("");
}
