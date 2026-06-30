import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  TemplateRef,
  ViewChild,
  inject,
  output,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { HostControlDirective } from "@lib/host-control/host-control.directive";

// https://flowbite.com/docs/forms/input-field/

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "datetime-local";

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

  @Input() id: string | null = null;
  @Input() required: boolean = false;
  @Input() placeholder: string = "";
  @Input() invalid: boolean = false;
  @Input() helpText?: string;
  @Input() fieldType: FieldType = "text";
  @Input() fieldSize: "large" | "medium" | "small" = "medium";
  @Input() icon?: IconProp;
  @Input() ariaAutocomplete?: string | null = "none";
  @Input() min?: number | null = null;
  @Input() max?: number | null = null;
  @Input() step?: number | null = null;
  @Input() size?: number | null = null;
  @Input() suffixTpl?: TemplateRef<unknown>;

  inputFocus = output<FocusEvent>();
  inputFocusOut = output<FocusEvent>();
  inputBlur = output<FocusEvent>();
  inputSelectionChange = output<Event>();

  @Input() value?: string | number;
  hcd = inject(HostControlDirective);
}
