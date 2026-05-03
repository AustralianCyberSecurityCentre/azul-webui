import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  ModelSignal,
  Output,
  TemplateRef,
  ViewChild,
  input,
  model,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { FormValueControl } from "@angular/forms/signals";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

// https://flowbite.com/docs/forms/input-field/

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "datetime-local";

@Component({
  selector: "flow-signal-input",
  templateUrl: "./input-signal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, FontAwesomeModule],
})
export class SignalInputComponent implements FormValueControl<string | number> {
  @ViewChild("inputElement") inputElement: ElementRef<HTMLInputElement>;

  @Input() id: string = null;
  required = input<boolean>(false);
  invalid = input<boolean>(false);
  placeholder = input<string>("");

  @Input() helpText?: string;
  @Input() fieldType: FieldType = "text";
  @Input() fieldSize: "large" | "medium" | "small" = "medium";
  @Input() icon?: IconProp;
  @Input() ariaAutocomplete?: string | null = "none";
  min? = input<number | undefined>(undefined);
  max = input<number | undefined>(undefined);
  @Input() step?: number | null = null;
  @Input() size?: number | null = null;
  @Input() suffixTpl?: TemplateRef<unknown>;

  @Output() inputFocus: EventEmitter<FocusEvent> = new EventEmitter();
  @Output() inputFocusOut: EventEmitter<FocusEvent> = new EventEmitter();
  @Output() inputBlur: EventEmitter<FocusEvent> = new EventEmitter();
  @Output() inputSelectionChange: EventEmitter<Event> = new EventEmitter();

  value: ModelSignal<string | number> = model<string | number>("");
}
