import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  model,
  output,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
// https://flowbite.com/docs/forms/textarea/

@Component({
  selector: "flow-textarea",
  templateUrl: "./textarea.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
})
export class TextareaComponent implements ControlValueAccessor {
  rows = input<number>(4);
  spellcheck = input<boolean | null>(null);
  invalid = input<boolean>(false);
  valueChanged = output<string>();

  value = model("");
  disabled = input(false);

  private onChange = (value: string) => {
    this.valueChanged.emit(value);
  };
  protected onTouched = () => {};

  writeValue(newValue: string): void {
    this.value.set(newValue ?? "");
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
