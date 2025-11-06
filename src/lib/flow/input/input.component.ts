import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  inject,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { HostControlDirective } from "src/lib/host-control/host-control.directive";

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
  @ViewChild("inputElement") inputElement: ElementRef<HTMLInputElement>;

  @Input() id: string = null;
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

  @Output() inputFocus: EventEmitter<FocusEvent> = new EventEmitter();
  @Output() inputFocusOut: EventEmitter<FocusEvent> = new EventEmitter();
  @Output() inputBlur: EventEmitter<FocusEvent> = new EventEmitter();
  @Output() inputSelectionChange: EventEmitter<Event> = new EventEmitter();

  @Input() value?: string | number;
  hcd = inject(HostControlDirective);
}
