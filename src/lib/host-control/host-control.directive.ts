import { Directive, Injector, OnDestroy, OnInit, inject } from "@angular/core";
import {
  ControlContainer,
  ControlValueAccessor,
  FormControl,
  FormControlDirective,
  FormControlName,
  NG_VALUE_ACCESSOR,
  NgControl,
  NgModel,
  UntypedFormGroup,
} from "@angular/forms";
import { Subscription } from "rxjs";

// Credit to https://gist.github.com/cyrillbrito/f387212029bcc97287088297492c54d8

@Directive({
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: HostControlDirective,
    },
  ],
})
export class HostControlDirective
  implements ControlValueAccessor, OnInit, OnDestroy
{
  control!: FormControl;

  private injector = inject(Injector);
  private subscription?: Subscription;

  ngOnInit(): void {
    const ngControl = this.injector.get(NgControl, null, {
      self: true,
      optional: true,
    });

    if (ngControl instanceof FormControlName) {
      const group = this.injector.get(ControlContainer)
        .control as UntypedFormGroup;
      this.control = group.controls[ngControl.name!] as FormControl;
      return;
    }

    if (ngControl instanceof FormControlDirective) {
      this.control = ngControl.control;
      return;
    }

    if (ngControl instanceof NgModel) {
      this.subscription = ngControl.control.valueChanges.subscribe(
        (newValue) => {
          // The viewToModelUpdate updates the directive and triggers the ngModelChange.
          // So we want to called it when the value changes except when it comes from the parent (ngModel input).
          // The `if` checks if the newValue is different from the value on the ngModel input or from the current value.
          if (
            ngControl.model !== newValue ||
            ngControl.viewModel !== newValue
          ) {
            ngControl.viewToModelUpdate(newValue);
          }
        },
      );
      this.control = ngControl.control;
      return;
    }

    // Fallback
    this.control = new FormControl();
  }

  writeValue(): void {}
  registerOnChange(): void {}
  registerOnTouched(): void {}

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
